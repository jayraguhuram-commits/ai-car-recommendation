const express = require('express');
const router = express.Router();
const { get, all } = require('../db/database');
const authMiddleware = require('../middleware/auth');

/**
 * GET /api/dashboard/stats — admin KPI counts
 */
router.get('/stats', authMiddleware, (req, res) => {
  try {
    const totalEnquiries = get('SELECT COUNT(*) as count FROM enquiries').count;
    const confirmed     = get("SELECT COUNT(*) as count FROM enquiries WHERE status = 'confirmed'").count;
    const pending       = get("SELECT COUNT(*) as count FROM enquiries WHERE status = 'pending'").count;
    const cancelled     = get("SELECT COUNT(*) as count FROM enquiries WHERE status = 'cancelled'").count;
    const fleetTotal    = get('SELECT COUNT(*) as count FROM vehicles').count;
    const fleetActive   = get('SELECT COUNT(*) as count FROM vehicles WHERE is_available = 1').count;

    const recent = all(`
      SELECT e.enquiry_id, e.customer_name, e.status, e.trip_date, e.created_at,
             v.name as vehicle_name
      FROM enquiries e
      LEFT JOIN vehicles v ON e.recommended_vehicle_id = v.vehicle_id
      ORDER BY e.created_at DESC LIMIT 5
    `);

    res.json({
      success: true,
      data: { totalEnquiries, confirmed, pending, cancelled, fleetTotal, fleetActive, recentEnquiries: recent }
    });
  } catch (err) {
    console.error('[Route] GET /dashboard/stats error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch stats.' });
  }
});

module.exports = router;
