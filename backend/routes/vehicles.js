const express = require('express');
const router = express.Router();
const { get, run, all, insert } = require('../db/database');
const authMiddleware = require('../middleware/auth');

/**
 * GET /api/vehicles — public list
 */
router.get('/', (req, res) => {
  try {
    const { available } = req.query;
    let query = 'SELECT * FROM vehicles';
    if (available === 'true') query += ' WHERE is_available = 1';
    query += ' ORDER BY price_per_day ASC';

    const vehicles = all(query);
    const parsed = vehicles.map(v => ({
      ...v,
      features: v.features ? JSON.parse(v.features) : []
    }));
    res.json({ success: true, data: parsed });
  } catch (err) {
    console.error('[Route] GET /vehicles error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch vehicles.' });
  }
});

/**
 * POST /api/vehicles — admin add vehicle
 */
router.post('/', authMiddleware, (req, res) => {
  const { name, category, seats, luggage_capacity, price_per_day, quantity, features, image_url } = req.body;

  if (!name || !category || !seats || !luggage_capacity || !price_per_day) {
    return res.status(400).json({ success: false, message: 'Missing required fields.' });
  }

  try {
    const vehicleId = insert(
      'INSERT INTO vehicles (name, category, seats, luggage_capacity, price_per_day, quantity, features, image_url) VALUES (?,?,?,?,?,?,?,?)',
      [name, category, parseInt(seats), luggage_capacity, parseFloat(price_per_day), parseInt(quantity || 1),
       features ? JSON.stringify(features) : null, image_url || null]
    );
    res.status(201).json({ success: true, vehicle_id: vehicleId });
  } catch (err) {
    console.error('[Route] POST /vehicles error:', err);
    res.status(500).json({ success: false, message: 'Failed to add vehicle.' });
  }
});

/**
 * DELETE /api/vehicles/:id — admin delete vehicle
 */
router.delete('/:id', authMiddleware, (req, res) => {
  const { id } = req.params;

  try {
    const existing = get('SELECT vehicle_id FROM vehicles WHERE vehicle_id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Vehicle not found.' });
    }

    run('DELETE FROM vehicles WHERE vehicle_id = ?', [id]);
    res.json({ success: true, message: 'Vehicle deleted from fleet successfully.' });
  } catch (err) {
    console.error('[Route] DELETE /vehicles/:id error:', err);
    res.status(500).json({ success: false, message: 'Failed to delete vehicle.' });
  }
});

module.exports = router;
