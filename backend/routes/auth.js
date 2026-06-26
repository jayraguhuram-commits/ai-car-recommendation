const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { get } = require('../db/database');

/**
 * POST /api/auth/login
 * Admin login — returns JWT token
 * Body: { username, password }
 */
router.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Username and password are required.' });
  }

  const adminUser = process.env.ADMIN_USER || 'admin';
  const adminPass = process.env.ADMIN_PASS || 'manivtha2026';

  if (username !== adminUser || password !== adminPass) {
    return res.status(401).json({ success: false, message: 'Invalid credentials.' });
  }

  const token = jwt.sign(
    { username, role: 'admin' },
    process.env.JWT_SECRET,
    { expiresIn: '8h' }
  );

  res.json({
    success: true,
    token,
    user: { username, role: 'admin' }
  });
});

/**
 * POST /api/auth/passenger-login
 * Passenger login — verifies email/phone and returns JWT token
 * Body: { email, phone }
 */
router.post('/passenger-login', (req, res) => {
  const { email, phone } = req.body;

  if (!email && !phone) {
    return res.status(400).json({ success: false, message: 'Please provide either email or phone number to log in.' });
  }

  try {
    let query = 'SELECT enquiry_id, customer_name, email, phone FROM enquiries WHERE 1=0';
    const params = [];
    if (email) {
      query += ' OR email = ?';
      params.push(email);
    }
    if (phone) {
      query += ' OR phone = ?';
      params.push(phone);
    }

    const passengerRow = get(query, params);

    if (!passengerRow) {
      return res.status(404).json({
        success: false,
        message: 'No rental enquiry history found matching this email or phone number.'
      });
    }

    // Generate token
    const token = jwt.sign(
      {
        email: passengerRow.email,
        phone: passengerRow.phone,
        customerName: passengerRow.customer_name,
        role: 'passenger'
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      token,
      user: {
        email: passengerRow.email,
        phone: passengerRow.phone,
        customerName: passengerRow.customer_name,
        role: 'passenger'
      }
    });
  } catch (err) {
    console.error('[Route] Passenger login error:', err);
    res.status(500).json({ success: false, message: 'Internal server error during login.' });
  }
});

module.exports = router;
