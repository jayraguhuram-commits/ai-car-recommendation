const express = require('express');
const router = express.Router();
const { getAIRecommendation, getChatbotReply } = require('../services/aiService');
const db = require('../db/database');

/**
 * POST /api/recommend
 * No auth required
 * Body: { tripType, passengers, luggage, comfortPref, budgetMin, budgetMax, tripDate }
 * Returns AI car recommendations (or rule-based fallback)
 */
router.post('/', async (req, res) => {
  const { tripType, passengers, luggage, comfortPref, budgetMin, budgetMax, tripDate } = req.body;

  // Basic validation
  if (!tripType || !passengers || !luggage || !comfortPref) {
    return res.status(400).json({
      success: false,
      message: 'Missing required fields: tripType, passengers, luggage, comfortPref'
    });
  }

  try {
    const result = await getAIRecommendation({
      tripType,
      passengers: parseInt(passengers),
      luggage,
      comfortPref,
      budgetMin: budgetMin || 500,
      budgetMax: budgetMax || 5000,
      tripDate: tripDate || 'Not specified'
    });

    // Cross-reference with DB to get vehicle_id, image_url and quantity
    if (result.recommendations) {
      const dbVehicles = db.all('SELECT vehicle_id, name, image_url, quantity FROM vehicles');
      result.recommendations = result.recommendations.map(rec => {
        // Find matching vehicle (case insensitive, partial match)
        const dbMatch = dbVehicles.find(v => v.name.toLowerCase().includes(rec.vehicle_name.toLowerCase()) || rec.vehicle_name.toLowerCase().includes(v.name.toLowerCase()));
        return {
          ...rec,
          vehicle_id: dbMatch ? dbMatch.vehicle_id : null,
          image_url: dbMatch ? dbMatch.image_url : null,
          quantity: dbMatch ? dbMatch.quantity : 1
        };
      });
    }

    res.json({ success: true, data: result });
  } catch (err) {
    console.error('[Route] /recommend error:', err);
    res.status(500).json({ success: false, message: 'Failed to get recommendations.' });
  }
});

/**
 * POST /api/recommend/chat
 * No auth required
 * Body: { message, history: [{ role, content }] }
 * Returns chatbot "Mani" reply
 */
router.post('/chat', async (req, res) => {
  const { message, history = [] } = req.body;

  if (!message) {
    return res.status(400).json({ success: false, message: 'Message is required.' });
  }

  try {
    const reply = await getChatbotReply(history, message);
    res.json({ success: true, reply });
  } catch (err) {
    console.error('[Route] /recommend/chat error:', err);
    res.status(500).json({ success: false, message: 'Chat service unavailable.' });
  }
});

module.exports = router;
