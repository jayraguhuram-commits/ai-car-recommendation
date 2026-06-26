# 🤖 AI Engine Documentation — Manivtha Car Assistant

## Overview

The AI engine (`backend/services/aiService.js`) powers two features:
1. **Car Recommendation** — suggests 3 best vehicles for a customer's trip
2. **Chatbot (Mani)** — guided conversational assistant that gathers trip requirements

---

## 🧠 AI Model

- **Model**: `gemini-1.5-flash` via `@google/generative-ai` SDK
- **Mode**: Text generation with structured JSON output
- **Fallback**: Rule-based deterministic algorithm (no API key required)

---

## 🚗 Car Recommendation Flow

### Input (from /api/recommend POST body)

```json
{
  "tripType": "Outstation",
  "passengers": 4,
  "luggage": "2+ Bags",
  "comfortPref": "Standard",
  "budgetMin": 1000,
  "budgetMax": 2000,
  "tripDate": "2026-07-01"
}
```

### System Prompt (Fixed — do NOT modify format)

The AI is told to respond in strict JSON format:
```json
{
  "recommendations": [
    {
      "rank": 1,
      "vehicle_name": "Toyota Innova Crysta",
      "category": "premium",
      "seats": 7,
      "price_per_day": 2800,
      "reason": "Best suited because...",
      "suitability_score": 92
    }
  ],
  "summary": "Brief one-sentence summary of best choice",
  "budget_note": "Note if budget is tight or comfortable"
}
```

### Rules enforced by system prompt
- Never recommend fewer seats than passengers
- Never exceed budget by more than 20%
- Always return exactly 3 recommendations (rank 1, 2, 3)
- Reason must mention trip type, passenger count, budget

### Post-processing

After Gemini responds, the backend cross-references each vehicle with the database:
```js
recommendations = recommendations.map(rec => {
  const dbMatch = dbVehicles.find(v => v.name.includes(rec.vehicle_name));
  return { ...rec, vehicle_id: dbMatch?.vehicle_id, image_url: dbMatch?.image_url, quantity: dbMatch?.quantity };
});
```

---

## 🔄 Rule-Based Fallback Logic

When Gemini is unavailable (no valid API key), the system uses `getRuleBasedRecommendation()`:

```
If passengers >= 6 OR luggage === 'large':
  If budgetMax >= 4000 → Toyota Fortuner
  Else → Toyota Innova Crysta

If comfort === 'luxury' AND budgetMax >= 5000 → Mercedes E-Class

If comfort === 'premium' AND budgetMax >= 2000 → Kia Carens

If passengers <= 4 AND budgetMax >= 1500 → Swift Dzire

If passengers <= 4 AND budgetMax >= 800 → Alto K10

Default → Swift Dzire
```

The fallback always returns 1 recommendation (not 3). The response includes `fallback: true`.

---

## 💬 Chatbot (Mani)

### Personality
- Name: "Mani"
- Style: Friendly, warm, concise (max 2 sentences per reply)
- Language: English, Tamil, or Kannada (adapts to user's language)

### Conversation Flow (5 questions)
```
1. What type of trip? (one-way, outstation, airport, corporate)
2. How many passengers?
3. How much luggage? (none, small, medium, large)
4. Budget per day (in ₹)?
5. Pickup date?
→ After all 5 answers: recommends a car
```

### Rule-Based Chat Fallback

When no Gemini key is configured, a simple state machine counts the number of user messages and responds with the next question. After 5 user messages, it calls `getRuleBasedRecommendation()` to suggest a car.

### API Endpoint

```
POST /api/recommend/chat
Body: {
  "message": "I need a car for 5 people",
  "history": [
    { "role": "user", "content": "One-way trip" },
    { "role": "model", "content": "Great! How many passengers?" }
  ]
}
```

The `history` array preserves conversation context across requests.

---

## 🛠️ Adding Gemini API Key

1. Go to: https://aistudio.google.com/app/apikey
2. Create an API key
3. Add to `backend/.env`:
   ```
   GEMINI_API_KEY=AIzaSy...your-real-key...
   ```
4. Restart the backend — the console will show: `✅ Gemini AI: Configured`

---

## 🚗 Vehicle Catalogue (AI-Aware)

The AI system prompt references these exact vehicle names. The DB vehicles must match these names for cross-referencing to work:

| Vehicle Name | Category | Seats | Luggage | Price Range |
|-------------|----------|-------|---------|-------------|
| Alto K10 / WagonR | budget | 4 | small | ₹800–1,000/day |
| Swift Dzire | standard | 4 | medium | ₹1,200–1,500/day |
| Honda City | standard+ | 4 | medium | ₹1,800–2,200/day |
| Toyota Innova Crysta | premium | 7 | large | ₹2,500–3,200/day |
| Kia Carens | premium | 6 | large | ₹2,200–2,800/day |
| Toyota Fortuner | luxury SUV | 7 | large | ₹4,000–5,000/day |
| Mercedes E-Class | luxury sedan | 4 | medium | ₹6,000–8,000/day |

> ⚠️ If you add new vehicles to the fleet via Fleet Management, you must also update the system prompt in `aiService.js` to include the new vehicle for the AI to be aware of it.

---

*AI Engine Documentation · Manivtha AI Car Assistant · June 2026*
