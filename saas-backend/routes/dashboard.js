'use strict';

/**
 * routes/dashboard.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Multi-Tenant Isolated Dashboard APIs.
 *
 * Routes:
 *   GET  /api/v1/dashboard/enquiries   — Paginated, filtered enquiry list
 *   GET  /api/v1/dashboard/stats       — KPI aggregates for the dashboard header
 *   GET  /api/v1/dashboard/enquiries/:enquiry_id  — Single enquiry detail view
 *   PATCH /api/v1/dashboard/enquiries/:enquiry_id/status — Status transition
 *
 * ALL routes:
 *   1. Enforce JWT authentication via authenticate middleware.
 *   2. Enforce role-based access via requireRole.
 *   3. ALWAYS filter database queries by req.tenant_id — zero cross-tenant leakage.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const express = require('express');
const router  = express.Router();
const { pool } = require('../db/pool');
const { authenticate, requireRole } = require('../middleware/auth');

// ─── Roles that can access dashboard APIs ─────────────────────────────────────
// Drivers cannot access dashboards — they only see their own assigned trips.
const DASHBOARD_ROLES = ['SuperAdmin', 'FleetManager', 'BookingExecutive'];

// ─── Constants ────────────────────────────────────────────────────────────────
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE     = 100;

// Valid enquiry statuses (must match enquiry_status_enum in schema.sql)
const VALID_STATUSES  = new Set(['Pending', 'Recommended', 'Booked', 'Cancelled']);

// Valid trip types (must match trip_type_enum in schema.sql)
const VALID_TRIP_TYPES = new Set(['Airport', 'Outstation', 'Local', 'Corporate', 'Wedding', 'Tourism']);

// Allowed status transitions: from → [allowed next states]
const STATUS_TRANSITIONS = {
  Pending:     ['Recommended', 'Cancelled'],
  Recommended: ['Booked', 'Pending', 'Cancelled'],
  Booked:      ['Cancelled'],
  Cancelled:   [],  // Terminal state
};

// ─── Helper: Structured API Error ────────────────────────────────────────────

function apiError(res, status, code, message, details = null) {
  const body = { success: false, error: { code, message } };
  if (details) body.error.details = details;
  return res.status(status).json(body);
}

// ─── Helper: Safe integer parser ─────────────────────────────────────────────

function parseIntSafe(value, defaultValue, min, max) {
  const n = parseInt(value, 10);
  if (isNaN(n)) return defaultValue;
  return Math.min(Math.max(n, min), max);
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/dashboard/enquiries
// ─────────────────────────────────────────────────────────────────────────────
/**
 * List enquiries for the authenticated tenant with pagination and filtering.
 *
 * Query Params:
 *   status      (string)  — Filter by enquiry status: Pending|Recommended|Booked|Cancelled
 *   trip_type   (string)  — Filter by trip type: Airport|Outstation|Local|...
 *   search      (string)  — Fuzzy search on customer_name or phone
 *   page        (int)     — 1-based page number (default: 1)
 *   page_size   (int)     — Records per page (default: 20, max: 100)
 *   sort_by     (string)  — Column to sort: created_at|trip_date|status (default: created_at)
 *   sort_order  (string)  — asc|desc (default: desc)
 *
 * Response:
 *   { success, data: { enquiries, pagination: { page, page_size, total, total_pages } } }
 */
router.get(
  '/enquiries',
  authenticate,
  requireRole(...DASHBOARD_ROLES),
  async (req, res) => {
    const tenantId = req.tenant_id;

    // ── Parse and validate query parameters ────────────────────────────────

    const { status, trip_type, search, sort_by, sort_order } = req.query;
    const page      = parseIntSafe(req.query.page,      1,                1, 10000);
    const pageSize  = parseIntSafe(req.query.page_size, DEFAULT_PAGE_SIZE, 1, MAX_PAGE_SIZE);
    const offset    = (page - 1) * pageSize;

    // Validate status filter
    if (status && !VALID_STATUSES.has(status)) {
      return apiError(res, 400, 'INVALID_STATUS_FILTER',
        `"status" must be one of: ${[...VALID_STATUSES].join(', ')}.`);
    }

    // Validate trip_type filter
    if (trip_type && !VALID_TRIP_TYPES.has(trip_type)) {
      return apiError(res, 400, 'INVALID_TRIP_TYPE_FILTER',
        `"trip_type" must be one of: ${[...VALID_TRIP_TYPES].join(', ')}.`);
    }

    // Whitelist sort columns to prevent SQL injection
    const SORTABLE_COLS = new Set(['created_at', 'trip_date', 'status', 'customer_name', 'updated_at']);
    const sortCol   = SORTABLE_COLS.has(sort_by) ? sort_by : 'created_at';
    const sortDir   = sort_order?.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    // ── Build dynamic WHERE clause with parameterized bindings ─────────────

    const conditions = [`e.tenant_id = $1`];
    const params     = [tenantId];
    let   paramIdx   = 2;  // Next $N placeholder index

    if (status) {
      conditions.push(`e.status = $${paramIdx++}`);
      params.push(status);
    }

    if (trip_type) {
      conditions.push(`e.trip_type = $${paramIdx++}`);
      params.push(trip_type);
    }

    if (search && search.trim().length > 0) {
      // Search customer_name OR the phone field inside contact_info JSONB
      conditions.push(
        `(e.customer_name ILIKE $${paramIdx} OR e.contact_info->>'phone' ILIKE $${paramIdx})`
      );
      params.push(`%${search.trim()}%`);
      paramIdx++;
    }

    const whereClause = conditions.join(' AND ');

    // ── Execute count query (same filters, no pagination) ──────────────────

    let totalCount;
    try {
      const countResult = await pool.query(
        `SELECT COUNT(*) AS total
         FROM enquiries e
         WHERE ${whereClause}`,
        params
      );
      totalCount = parseInt(countResult.rows[0].total, 10);
    } catch (dbErr) {
      console.error('[DASHBOARD] DB error counting enquiries:', dbErr);
      return apiError(res, 500, 'DB_COUNT_ERROR', 'Failed to count enquiries.');
    }

    // ── Execute paginated data query ───────────────────────────────────────

    let enquiries;
    try {
      // LEFT JOIN to bring in assigned vehicle and latest recommendation
      const dataQuery = `
        SELECT
          e.enquiry_id,
          e.customer_name,
          e.contact_info->>'phone'  AS customer_phone,
          e.contact_info->>'email'  AS customer_email,
          e.trip_type,
          e.passenger_count,
          e.luggage_count,
          e.budget_min,
          e.budget_max,
          e.comfort_preference,
          e.pickup_location,
          e.drop_location,
          e.trip_date,
          e.return_date,
          e.special_requirements,
          e.status,
          e.created_at,
          e.updated_at,

          -- Assigned vehicle details (may be null if not yet assigned)
          v.vehicle_id         AS assigned_vehicle_id,
          v.make               AS vehicle_make,
          v.model              AS vehicle_model,
          v.tier               AS vehicle_tier,

          -- Assigned driver details (may be null)
          d.driver_id          AS assigned_driver_id,
          d.name               AS driver_name,
          d.phone              AS driver_phone,

          -- Latest recommendation meta (from the audit log)
          rh.rec_id            AS latest_rec_id,
          rh.model_used        AS ai_model_used,
          rh.generated_at      AS last_recommended_at

        FROM enquiries e

        LEFT JOIN vehicles v
          ON  v.vehicle_id = e.assigned_vehicle_id
          AND v.tenant_id  = e.tenant_id

        LEFT JOIN drivers d
          ON  d.driver_id  = e.assigned_driver_id
          AND d.tenant_id  = e.tenant_id

        -- Lateral join to get only the most recent recommendation per enquiry
        LEFT JOIN LATERAL (
          SELECT rec_id, model_used, generated_at
          FROM   recommendation_history rh2
          WHERE  rh2.enquiry_id = e.enquiry_id
            AND  rh2.tenant_id  = e.tenant_id
          ORDER BY rh2.generated_at DESC
          LIMIT 1
        ) rh ON TRUE

        WHERE ${whereClause}
        ORDER BY e.${sortCol} ${sortDir}
        LIMIT  $${paramIdx}
        OFFSET $${paramIdx + 1}
      `;

      const dataParams = [...params, pageSize, offset];
      const dataResult = await pool.query(dataQuery, dataParams);
      enquiries = dataResult.rows;
    } catch (dbErr) {
      console.error('[DASHBOARD] DB error fetching enquiries:', dbErr);
      return apiError(res, 500, 'DB_FETCH_ERROR', 'Failed to retrieve enquiries.');
    }

    // ── Map rows to clean frontend payload ────────────────────────────────

    const mapped = enquiries.map((row) => ({
      enquiry_id:          row.enquiry_id,
      customer: {
        name:              row.customer_name,
        phone:             row.customer_phone  || null,
        email:             row.customer_email  || null,
      },
      trip: {
        type:              row.trip_type,
        passenger_count:   row.passenger_count,
        luggage_count:     row.luggage_count,
        comfort:           row.comfort_preference,
        pickup_location:   row.pickup_location   || null,
        drop_location:     row.drop_location     || null,
        trip_date:         row.trip_date         || null,
        return_date:       row.return_date       || null,
      },
      budget: {
        min:               row.budget_min  ? parseFloat(row.budget_min)  : null,
        max:               row.budget_max  ? parseFloat(row.budget_max)  : null,
      },
      special_requirements: row.special_requirements || null,
      status:              row.status,
      assigned_vehicle:    row.assigned_vehicle_id ? {
        vehicle_id:        row.assigned_vehicle_id,
        name:              `${row.vehicle_make} ${row.vehicle_model}`,
        tier:              row.vehicle_tier,
      } : null,
      assigned_driver:     row.assigned_driver_id ? {
        driver_id:         row.assigned_driver_id,
        name:              row.driver_name,
        phone:             row.driver_phone,
      } : null,
      ai_recommendation: row.latest_rec_id ? {
        rec_id:            row.latest_rec_id,
        model_used:        row.ai_model_used,
        generated_at:      row.last_recommended_at,
      } : null,
      timestamps: {
        created_at:        row.created_at,
        updated_at:        row.updated_at,
      },
    }));

    return res.status(200).json({
      success: true,
      data: {
        enquiries: mapped,
        pagination: {
          page,
          page_size:   pageSize,
          total:       totalCount,
          total_pages: Math.ceil(totalCount / pageSize),
          has_next:    page * pageSize < totalCount,
          has_prev:    page > 1,
        },
        filters_applied: {
          status:    status    || null,
          trip_type: trip_type || null,
          search:    search    || null,
        },
      },
    });
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/dashboard/stats
// ─────────────────────────────────────────────────────────────────────────────
/**
 * KPI aggregates for the dashboard header strip.
 *
 * Returns counts and revenue metrics for the authenticated tenant only.
 * All aggregates use a single optimized query with conditional COUNT.
 */
router.get(
  '/stats',
  authenticate,
  requireRole(...DASHBOARD_ROLES),
  async (req, res) => {
    const tenantId = req.tenant_id;

    let stats;
    try {
      const result = await pool.query(
        `SELECT
           -- Enquiry counts by status
           COUNT(*) FILTER (WHERE e.status = 'Pending')     AS pending_count,
           COUNT(*) FILTER (WHERE e.status = 'Recommended') AS recommended_count,
           COUNT(*) FILTER (WHERE e.status = 'Booked')      AS booked_count,
           COUNT(*) FILTER (WHERE e.status = 'Cancelled')   AS cancelled_count,
           COUNT(*)                                          AS total_enquiries,

           -- Enquiries this month
           COUNT(*) FILTER (
             WHERE e.created_at >= date_trunc('month', NOW())
           ) AS enquiries_this_month,

           -- Fleet stats (subquery)
           (SELECT COUNT(*) FROM vehicles v
            WHERE v.tenant_id = $1 AND v.status = 'Available')       AS vehicles_available,
           (SELECT COUNT(*) FROM vehicles v
            WHERE v.tenant_id = $1)                                   AS vehicles_total,
           (SELECT COUNT(*) FROM drivers d
            WHERE d.tenant_id = $1 AND d.is_available = TRUE)         AS drivers_available,
           (SELECT COUNT(*) FROM drivers d
            WHERE d.tenant_id = $1)                                   AS drivers_total

         FROM enquiries e
         WHERE e.tenant_id = $1`,
        [tenantId]
      );

      // Also compute confirmed booking revenue in a separate query for clarity
      const revenueResult = await pool.query(
        `SELECT
           COALESCE(SUM(b.total_amount), 0)   AS total_revenue,
           COALESCE(SUM(b.advance_paid),  0)  AS total_advance_collected,
           COUNT(*)                            AS total_bookings,
           -- This month
           COALESCE(SUM(b.total_amount) FILTER (
             WHERE b.confirmed_at >= date_trunc('month', NOW())
           ), 0) AS revenue_this_month
         FROM bookings b
         WHERE b.tenant_id = $1
           AND b.status   != 'Cancelled'`,
        [tenantId]
      );

      const r = result.rows[0];
      const rev = revenueResult.rows[0];

      stats = {
        enquiries: {
          total:          parseInt(r.total_enquiries,   10),
          pending:        parseInt(r.pending_count,     10),
          recommended:    parseInt(r.recommended_count, 10),
          booked:         parseInt(r.booked_count,      10),
          cancelled:      parseInt(r.cancelled_count,   10),
          this_month:     parseInt(r.enquiries_this_month, 10),
        },
        fleet: {
          vehicles_available: parseInt(r.vehicles_available, 10),
          vehicles_total:     parseInt(r.vehicles_total,     10),
          drivers_available:  parseInt(r.drivers_available,  10),
          drivers_total:      parseInt(r.drivers_total,      10),
        },
        revenue: {
          total_revenue:           parseFloat(rev.total_revenue),
          advance_collected:       parseFloat(rev.total_advance_collected),
          total_bookings:          parseInt(rev.total_bookings, 10),
          revenue_this_month:      parseFloat(rev.revenue_this_month),
          currency:                'INR',
        },
        generated_at: new Date().toISOString(),
      };
    } catch (dbErr) {
      console.error('[DASHBOARD] DB error fetching stats:', dbErr);
      return apiError(res, 500, 'DB_STATS_ERROR', 'Failed to retrieve dashboard statistics.');
    }

    return res.status(200).json({ success: true, data: stats });
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/dashboard/enquiries/:enquiry_id
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Full detail view for a single enquiry, including recommendation history.
 * Used to power the booking detail / action page.
 */
router.get(
  '/enquiries/:enquiry_id',
  authenticate,
  requireRole(...DASHBOARD_ROLES),
  async (req, res) => {
    const tenantId  = req.tenant_id;
    const { enquiry_id } = req.params;

    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_RE.test(enquiry_id)) {
      return apiError(res, 400, 'INVALID_ENQUIRY_ID', 'enquiry_id must be a valid UUID.');
    }

    let enquiryRow, recommendationRows, bookingRow;

    try {
      // Core enquiry detail
      const eResult = await pool.query(
        `SELECT
           e.*,
           v.make          AS vehicle_make,
           v.model         AS vehicle_model,
           v.tier          AS vehicle_tier,
           v.daily_rate    AS vehicle_daily_rate,
           v.image_url     AS vehicle_image_url,
           d.name          AS driver_name,
           d.phone         AS driver_phone,
           d.license_no    AS driver_license_no,
           d.rating        AS driver_rating,
           u.name          AS created_by_name
         FROM enquiries e
         LEFT JOIN vehicles v
           ON v.vehicle_id = e.assigned_vehicle_id AND v.tenant_id = e.tenant_id
         LEFT JOIN drivers d
           ON d.driver_id  = e.assigned_driver_id  AND d.tenant_id = e.tenant_id
         LEFT JOIN users u
           ON u.user_id    = e.created_by           AND u.tenant_id = e.tenant_id
         WHERE e.enquiry_id = $1
           AND e.tenant_id  = $2
         LIMIT 1`,
        [enquiry_id, tenantId]
      );
      enquiryRow = eResult.rows[0];

      if (!enquiryRow) {
        return apiError(res, 404, 'ENQUIRY_NOT_FOUND',
          `Enquiry "${enquiry_id}" not found or does not belong to your organization.`);
      }

      // All recommendation history for this enquiry (most recent first)
      const rResult = await pool.query(
        `SELECT
           rec_id,
           recommended_vehicles,
           ai_explanation,
           model_used,
           prompt_tokens,
           completion_tokens,
           latency_ms,
           generated_at
         FROM recommendation_history
         WHERE enquiry_id = $1
           AND tenant_id  = $2
         ORDER BY generated_at DESC`,
        [enquiry_id, tenantId]
      );
      recommendationRows = rResult.rows;

      // Active booking if it exists
      const bResult = await pool.query(
        `SELECT
           booking_id,
           total_amount,
           advance_paid,
           currency,
           status     AS booking_status,
           notes,
           confirmed_at
         FROM bookings
         WHERE enquiry_id = $1
           AND tenant_id  = $2
         ORDER BY confirmed_at DESC
         LIMIT 1`,
        [enquiry_id, tenantId]
      );
      bookingRow = bResult.rows[0] || null;

    } catch (dbErr) {
      console.error('[DASHBOARD] DB error fetching enquiry detail:', dbErr);
      return apiError(res, 500, 'DB_FETCH_ERROR', 'Failed to retrieve enquiry details.');
    }

    // ── Shape the response ────────────────────────────────────────────────

    const detail = {
      enquiry_id:   enquiryRow.enquiry_id,
      status:       enquiryRow.status,
      customer: {
        name:       enquiryRow.customer_name,
        phone:      enquiryRow.contact_info?.phone || null,
        email:      enquiryRow.contact_info?.email || null,
      },
      trip: {
        type:              enquiryRow.trip_type,
        passenger_count:   enquiryRow.passenger_count,
        luggage_count:     enquiryRow.luggage_count,
        comfort_preference: enquiryRow.comfort_preference,
        pickup_location:   enquiryRow.pickup_location   || null,
        drop_location:     enquiryRow.drop_location     || null,
        trip_date:         enquiryRow.trip_date         || null,
        return_date:       enquiryRow.return_date       || null,
        special_requirements: enquiryRow.special_requirements || null,
      },
      budget: {
        min: enquiryRow.budget_min  ? parseFloat(enquiryRow.budget_min)  : null,
        max: enquiryRow.budget_max  ? parseFloat(enquiryRow.budget_max)  : null,
      },
      assigned_vehicle: enquiryRow.assigned_vehicle_id ? {
        vehicle_id:  enquiryRow.assigned_vehicle_id,
        name:        `${enquiryRow.vehicle_make} ${enquiryRow.vehicle_model}`,
        tier:        enquiryRow.vehicle_tier,
        daily_rate:  enquiryRow.vehicle_daily_rate ? parseFloat(enquiryRow.vehicle_daily_rate) : null,
        image_url:   enquiryRow.vehicle_image_url  || null,
      } : null,
      assigned_driver: enquiryRow.assigned_driver_id ? {
        driver_id:   enquiryRow.assigned_driver_id,
        name:        enquiryRow.driver_name,
        phone:       enquiryRow.driver_phone,
        license_no:  enquiryRow.driver_license_no,
        rating:      enquiryRow.driver_rating ? parseFloat(enquiryRow.driver_rating) : null,
      } : null,
      booking: bookingRow ? {
        booking_id:    bookingRow.booking_id,
        status:        bookingRow.booking_status,
        total_amount:  parseFloat(bookingRow.total_amount),
        advance_paid:  parseFloat(bookingRow.advance_paid),
        currency:      bookingRow.currency,
        notes:         bookingRow.notes || null,
        confirmed_at:  bookingRow.confirmed_at,
      } : null,
      recommendation_history: recommendationRows.map((rh) => ({
        rec_id:              rh.rec_id,
        model_used:          rh.model_used,
        ai_explanation:      rh.ai_explanation,
        recommended_vehicles: rh.recommended_vehicles,
        latency_ms:          rh.latency_ms,
        prompt_tokens:       rh.prompt_tokens,
        completion_tokens:   rh.completion_tokens,
        generated_at:        rh.generated_at,
      })),
      created_by:  enquiryRow.created_by_name || 'System',
      timestamps: {
        created_at: enquiryRow.created_at,
        updated_at: enquiryRow.updated_at,
      },
    };

    return res.status(200).json({ success: true, data: detail });
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/v1/dashboard/enquiries/:enquiry_id/status
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Transition an enquiry's status. Enforces valid state machine transitions.
 *
 * Body: { status: "Booked" | "Cancelled" | "Pending" | "Recommended" }
 *
 * Only FleetManager and SuperAdmin can perform status transitions.
 */
router.patch(
  '/enquiries/:enquiry_id/status',
  authenticate,
  requireRole('FleetManager', 'SuperAdmin'),
  async (req, res) => {
    const tenantId        = req.tenant_id;
    const { enquiry_id }  = req.params;
    const { status: newStatus } = req.body;

    // ── Validate input ────────────────────────────────────────────────────

    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_RE.test(enquiry_id)) {
      return apiError(res, 400, 'INVALID_ENQUIRY_ID', 'enquiry_id must be a valid UUID.');
    }

    if (!newStatus || !VALID_STATUSES.has(newStatus)) {
      return apiError(res, 400, 'INVALID_STATUS',
        `"status" must be one of: ${[...VALID_STATUSES].join(', ')}.`);
    }

    // ── Fetch current status with tenant guard ────────────────────────────

    let currentStatus;
    try {
      const result = await pool.query(
        `SELECT status FROM enquiries WHERE enquiry_id = $1 AND tenant_id = $2 LIMIT 1`,
        [enquiry_id, tenantId]
      );
      if (result.rows.length === 0) {
        return apiError(res, 404, 'ENQUIRY_NOT_FOUND',
          `Enquiry "${enquiry_id}" not found or does not belong to your organization.`);
      }
      currentStatus = result.rows[0].status;
    } catch (dbErr) {
      console.error('[DASHBOARD] DB error fetching status for transition:', dbErr);
      return apiError(res, 500, 'DB_FETCH_ERROR', 'Failed to fetch current enquiry status.');
    }

    // ── Enforce state machine ─────────────────────────────────────────────

    if (currentStatus === newStatus) {
      return apiError(res, 409, 'SAME_STATUS',
        `Enquiry is already in "${newStatus}" status. No change applied.`);
    }

    const allowed = STATUS_TRANSITIONS[currentStatus] || [];
    if (!allowed.includes(newStatus)) {
      return apiError(res, 422, 'INVALID_STATUS_TRANSITION',
        `Cannot transition from "${currentStatus}" to "${newStatus}". ` +
        `Allowed transitions: ${allowed.length > 0 ? allowed.join(', ') : 'none (terminal state)'}.`);
    }

    // ── Apply the transition ──────────────────────────────────────────────

    try {
      const result = await pool.query(
        `UPDATE enquiries
         SET status     = $1,
             updated_at = NOW()
         WHERE enquiry_id = $2
           AND tenant_id  = $3
         RETURNING enquiry_id, status, updated_at`,
        [newStatus, enquiry_id, tenantId]
      );

      const updated = result.rows[0];
      return res.status(200).json({
        success: true,
        data: {
          enquiry_id:  updated.enquiry_id,
          status:      updated.status,
          updated_at:  updated.updated_at,
          previous_status: currentStatus,
          transitioned_by: req.user.name,
        },
      });
    } catch (dbErr) {
      console.error('[DASHBOARD] DB error applying status transition:', dbErr);
      return apiError(res, 500, 'DB_UPDATE_ERROR', 'Failed to update enquiry status.');
    }
  }
);

module.exports = router;
