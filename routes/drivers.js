const express = require('express');
const router = express.Router();
const { get, all, insert } = require('../db/database');
const authMiddleware = require('../middleware/auth');

/**
 * GET /api/drivers — admin list all drivers
 */
router.get('/', authMiddleware, (req, res) => {
  try {
    const drivers = all('SELECT * FROM drivers ORDER BY name ASC');
    res.json({ success: true, data: drivers });
  } catch (err) {
    console.error('[Route] GET /drivers error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch drivers.' });
  }
});

/**
 * POST /api/drivers — admin add driver
 */
router.post('/', authMiddleware, (req, res) => {
  const { name, phone, license_no } = req.body;

  if (!name || !phone) {
    return res.status(400).json({ success: false, message: 'Name and phone are required.' });
  }

  try {
    const driverId = insert(
      'INSERT INTO drivers (name, phone, license_no) VALUES (?,?,?)',
      [name, phone, license_no || null]
    );
    res.status(201).json({ success: true, driver_id: driverId });
  } catch (err) {
    console.error('[Route] POST /drivers error:', err);
    res.status(500).json({ success: false, message: 'Failed to add driver.' });
  }
});

/**
 * DELETE /api/drivers/:id — admin delete driver
 */
router.delete('/:id', authMiddleware, (req, res) => {
  const { id } = req.params;

  try {
    const existing = get('SELECT driver_id FROM drivers WHERE driver_id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Driver not found.' });
    }

    run('DELETE FROM drivers WHERE driver_id = ?', [id]);
    res.json({ success: true, message: 'Driver deleted successfully.' });
  } catch (err) {
    console.error('[Route] DELETE /drivers/:id error:', err);
    res.status(500).json({ success: false, message: 'Failed to delete driver.' });
  }
});

module.exports = router;
