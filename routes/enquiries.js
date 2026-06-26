const express = require('express');
const router = express.Router();
const { get, run, all, insert } = require('../db/database');
const authMiddleware = require('../middleware/auth');

/**
 * POST /api/enquiries — public submission
 */
router.post('/', (req, res) => {
  const {
    customer_name, phone, email, trip_type, passengers, luggage,
    comfort_pref, budget_min, budget_max, pickup_location, drop_location,
    trip_date, return_date, special_requirements, ai_recommendation, recommended_vehicle_id
  } = req.body;

  if (!customer_name || !phone || !trip_type || !passengers || !luggage || !comfort_pref) {
    return res.status(400).json({ success: false, message: 'Missing required fields.' });
  }

  try {
    const aiJson = ai_recommendation ? JSON.stringify(ai_recommendation) : null;

    const enquiryId = insert(
      `INSERT INTO enquiries (
        customer_name, phone, email, trip_type, passengers, luggage,
        comfort_pref, budget_min, budget_max, pickup_location, drop_location,
        trip_date, return_date, special_requirements, ai_recommendation, recommended_vehicle_id
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        customer_name, phone, email || null, trip_type,
        parseInt(passengers), luggage, comfort_pref,
        budget_min || null, budget_max || null,
        pickup_location || null, drop_location || null,
        trip_date || null, return_date || null,
        special_requirements || null, aiJson,
        recommended_vehicle_id || null
      ]
    );

    run(
      `INSERT INTO action_history (enquiry_id, action, performed_by, notes) VALUES (?,?,?,?)`,
      [enquiryId, 'Enquiry Submitted', 'customer', 'New booking enquiry received']
    );

    res.status(201).json({
      success: true,
      enquiry_id: enquiryId,
      message: 'Enquiry submitted successfully!'
    });
  } catch (err) {
    console.error('[Route] POST /enquiries error:', err);
    res.status(500).json({ success: false, message: 'Failed to submit enquiry.' });
  }
});

/**
 * GET /api/enquiries — admin list with optional filters
 */
router.get('/', authMiddleware, (req, res) => {
  const { status, search, page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  try {
    let query = `
      SELECT e.*, v.name as vehicle_name
      FROM enquiries e
      LEFT JOIN vehicles v ON e.recommended_vehicle_id = v.vehicle_id
    `;
    const params = [];
    const conditions = [];

    if (status) { conditions.push('e.status = ?'); params.push(status); }
    if (search) {
      conditions.push('(e.customer_name LIKE ? OR e.phone LIKE ? OR e.email LIKE ?)');
      const s = `%${search}%`;
      params.push(s, s, s);
    }

    if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY e.created_at DESC LIMIT ? OFFSET ?';

    const enquiries = all(query, [...params, parseInt(limit), offset]);

    // Count total (without pagination)
    let countQuery = 'SELECT COUNT(*) as total FROM enquiries e';
    if (conditions.length) countQuery += ' WHERE ' + conditions.join(' AND ');
    const totalRow = get(countQuery, params);

    res.json({
      success: true,
      data: enquiries,
      pagination: { page: parseInt(page), limit: parseInt(limit), total: totalRow ? totalRow.total : 0 }
    });
  } catch (err) {
    console.error('[Route] GET /enquiries error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch enquiries.' });
  }
});

/**
 * GET /api/enquiries/my-history — passenger view history
 */
router.get('/my-history', authMiddleware.passengerAuth, (req, res) => {
  const { email, phone } = req.user;

  try {
    let query = `
      SELECT e.*, v.name as vehicle_name, v.price_per_day as vehicle_price, v.image_url as vehicle_image
      FROM enquiries e
      LEFT JOIN vehicles v ON e.recommended_vehicle_id = v.vehicle_id
      WHERE 1=0
    `;
    const params = [];
    if (email) {
      query += ' OR e.email = ?';
      params.push(email);
    }
    if (phone) {
      query += ' OR e.phone = ?';
      params.push(phone);
    }
    query += ' ORDER BY e.created_at DESC';

    const enquiries = all(query, params);
    const parsed = enquiries.map(e => ({
      ...e,
      ai_recommendation: e.ai_recommendation ? JSON.parse(e.ai_recommendation) : null
    }));

    res.json({ success: true, data: parsed });
  } catch (err) {
    console.error('[Route] GET /enquiries/my-history error:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve booking history.' });
  }
});

/**
 * GET /api/enquiries/:id — admin single enquiry + history
 */
router.get('/:id', authMiddleware, (req, res) => {
  try {
    const enquiry = get(
      `SELECT e.*, v.name as vehicle_name, v.category as vehicle_category,
              v.seats as vehicle_seats, v.price_per_day as vehicle_price
       FROM enquiries e
       LEFT JOIN vehicles v ON e.recommended_vehicle_id = v.vehicle_id
       WHERE e.enquiry_id = ?`,
      [req.params.id]
    );

    if (!enquiry) return res.status(404).json({ success: false, message: 'Enquiry not found.' });

    const history = all('SELECT * FROM action_history WHERE enquiry_id = ? ORDER BY timestamp ASC', [req.params.id]);

    if (enquiry.ai_recommendation) {
      try { enquiry.ai_recommendation = JSON.parse(enquiry.ai_recommendation); } catch (e) {}
    }

    res.json({ success: true, data: { ...enquiry, history } });
  } catch (err) {
    console.error('[Route] GET /enquiries/:id error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch enquiry.' });
  }
});

/**
 * PATCH /api/enquiries/:id/status — admin status update
 */
router.patch('/:id/status', authMiddleware, (req, res) => {
  const { status, notes } = req.body;

  if (!['pending', 'confirmed', 'cancelled'].includes(status)) {
    return res.status(400).json({ success: false, message: 'Invalid status value.' });
  }

  try {
    const existing = get('SELECT enquiry_id FROM enquiries WHERE enquiry_id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ success: false, message: 'Enquiry not found.' });

    run('UPDATE enquiries SET status = ? WHERE enquiry_id = ?', [status, req.params.id]);
    run(
      'INSERT INTO action_history (enquiry_id, action, performed_by, notes) VALUES (?,?,?,?)',
      [req.params.id, `Status changed to ${status}`, 'admin', notes || `Enquiry marked as ${status}`]
    );

    res.json({ success: true, message: `Status updated to ${status}` });
  } catch (err) {
    console.error('[Route] PATCH /enquiries/:id/status error:', err);
    res.status(500).json({ success: false, message: 'Failed to update status.' });
  }
});

/**
 * DELETE /api/enquiries/:id — cancel and erase enquiry + related bookings/history
 */
router.delete('/:id', authMiddleware.passengerAuth, (req, res) => {
  const { id } = req.params;
  const { email, phone, role } = req.user;

  try {
    const enquiry = get('SELECT * FROM enquiries WHERE enquiry_id = ?', [id]);
    if (!enquiry) {
      return res.status(404).json({ success: false, message: 'Enquiry not found.' });
    }

    // If passenger, verify ownership
    if (role === 'passenger') {
      const emailMatch = email && enquiry.email === email;
      const phoneMatch = phone && enquiry.phone === phone;
      if (!emailMatch && !phoneMatch) {
        return res.status(403).json({ success: false, message: 'Access denied. You do not own this enquiry.' });
      }
    }

    // Erase request and history and bookings
    run('DELETE FROM enquiries WHERE enquiry_id = ?', [id]);
    run('DELETE FROM action_history WHERE enquiry_id = ?', [id]);
    run('DELETE FROM bookings WHERE enquiry_id = ?', [id]);

    // Simulate Passenger Notification
    const targetEmail = enquiry.email || 'passenger@example.com';
    const targetPhone = enquiry.phone || 'N/A';
    const notificationMessage = `[NOTIFY] Dear ${enquiry.customer_name}, your car enquiry #${id} has been cancelled and completely erased from the system.`;
    
    console.log(`\n=================== PASSENGER NOTIFICATION ===================`);
    console.log(`To: ${targetEmail} | Phone: ${targetPhone}`);
    console.log(`Message: ${notificationMessage}`);
    console.log(`==============================================================\n`);

    res.json({
      success: true,
      message: 'Enquiry successfully cancelled and erased.',
      notification: {
        sent: true,
        to: targetEmail,
        phone: targetPhone,
        message: notificationMessage
      }
    });
  } catch (err) {
    console.error('[Route] DELETE /enquiries/:id error:', err);
    res.status(500).json({ success: false, message: 'Failed to erase enquiry.' });
  }
});

module.exports = router;
