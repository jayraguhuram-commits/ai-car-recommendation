const { GoogleGenerativeAI } = require('@google/generative-ai');

// ─────────────────────────────────────────────
// 6.1 System Prompt — exactly from blueprint
// ─────────────────────────────────────────────
const SYSTEM_PROMPT = `You are an expert car rental advisor for Manivtha Tours & Travels, a premium travel company in India.
Your job is to recommend the best rental vehicles based on the customer's trip requirements.

ALWAYS respond in this exact JSON format:
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

Vehicle options you can recommend (use ONLY these):
1. Alto K10 / WagonR - Budget - 4 seats - small luggage - ₹800-1000/day
2. Swift Dzire - Standard - 4 seats - medium luggage - ₹1200-1500/day
3. Honda City - Standard-Plus - 4 seats - medium luggage - ₹1800-2200/day
4. Toyota Innova Crysta - Premium - 7 seats - large luggage - ₹2500-3200/day
5. Kia Carens - Premium - 6 seats - large luggage - ₹2200-2800/day
6. Toyota Fortuner - Luxury SUV - 7 seats - large luggage - ₹4000-5000/day
7. Mercedes E-Class - Luxury Sedan - 4 seats - medium luggage - ₹6000-8000/day

Rules:
- Never recommend a car with fewer seats than passengers requested
- Never recommend a car exceeding the stated budget by more than 20%
- Always give exactly 3 recommendations (rank 1, 2, 3)
- Reason must mention specific trip type, passenger count, and budget match
- Respond ONLY with valid JSON. No extra text, no markdown, no explanation outside JSON.`;

// ─────────────────────────────────────────────
// 6.3 Chatbot System Prompt — exactly from blueprint
// ─────────────────────────────────────────────
const CHAT_SYSTEM_PROMPT = `You are a friendly car rental assistant for Manivtha Tours & Travels.
Your name is "Mani". You help customers find the right car in 5 questions or fewer.

Ask these questions one at a time (never all at once):
1. Trip type (one-way, outstation, airport, corporate)?
2. How many passengers?
3. How much luggage?
4. Budget per day?
5. Pickup date?

Once you have all 5 answers, say:
"Great! Based on your requirements, I recommend: [car name]. It fits [X] passengers, handles [luggage type] luggage, and costs ₹[price]/day. Shall I take you to the booking form?"

Keep responses short (max 2 sentences). Be warm and helpful.
Always respond in English or Tamil/Kannada if the user writes in those languages.`;

// ─────────────────────────────────────────────
// 6.2 User Message Prompt Builder — from blueprint
// ─────────────────────────────────────────────
function buildUserPrompt({ tripType, passengers, luggage, comfortPref, budgetMin, budgetMax, tripDate }) {
  return `Customer trip requirements:
- Trip Type: ${tripType}
- Number of Passengers: ${passengers}
- Luggage: ${luggage}
- Comfort Preference: ${comfortPref}
- Budget per day: ₹${budgetMin} to ₹${budgetMax}
- Pickup Date: ${tripDate}

Please recommend the 3 best vehicles from your list for this trip.`;
}

// ─────────────────────────────────────────────
// 6.4 Rule-Based Fallback — exactly from blueprint
// ─────────────────────────────────────────────
function getRuleBasedRecommendation(passengers, luggage, budgetMax, comfort) {
  if (passengers >= 6 || luggage === 'large') {
    if (budgetMax >= 4000) return 'Toyota Fortuner';
    return 'Toyota Innova Crysta';
  }
  if (comfort === 'luxury' && budgetMax >= 5000) return 'Mercedes E-Class';
  if (comfort === 'premium' && budgetMax >= 2000) return 'Kia Carens';
  if (passengers <= 4 && budgetMax >= 1500) return 'Swift Dzire';
  if (passengers <= 4 && budgetMax >= 800) return 'Alto K10';
  return 'Swift Dzire'; // default
}

// Full fallback response shaped like AI output
function buildFallbackResponse(passengers, luggage, budgetMax, comfort) {
  const car = getRuleBasedRecommendation(passengers, luggage, budgetMax, comfort);
  return {
    fallback: true,
    recommendations: [
      {
        rank: 1,
        vehicle_name: car,
        category: comfort || 'standard',
        seats: passengers <= 4 ? 4 : 7,
        price_per_day: budgetMax || 1500,
        reason: `Best match for ${passengers} passenger(s) with ${luggage} luggage within your budget.`,
        suitability_score: 80
      }
    ],
    summary: `We recommend the ${car} for your trip.`,
    budget_note: 'Rule-based recommendation (AI unavailable).'
  };
}

// ─────────────────────────────────────────────
// AI Recommendation Function
// ─────────────────────────────────────────────
async function getAIRecommendation(formData) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey.startsWith('AIzaSyxxxxxxx')) {
    console.warn('[AI] No valid Gemini API key — using rule-based fallback.');
    const { passengers, luggage, budgetMax, comfortPref } = formData;
    return buildFallbackResponse(passengers, luggage, budgetMax, comfortPref);
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      systemInstruction: SYSTEM_PROMPT
    });

    const userMessage = buildUserPrompt(formData);
    const result = await model.generateContent(userMessage);
    const text = result.response.text();

    // Strip markdown code fences if present
    const cleaned = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    return parsed;
  } catch (err) {
    console.error('[AI] Gemini error, falling back:', err.message);
    const { passengers, luggage, budgetMax, comfortPref } = formData;
    return buildFallbackResponse(passengers, luggage, budgetMax, comfortPref);
  }
}

// ─────────────────────────────────────────────
// Chatbot Function
// ─────────────────────────────────────────────
async function getChatbotReply(conversationHistory, userMessage) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey.startsWith('AIzaSyxxxxxxx')) {
    // Rule-based conversational state machine when Gemini API key is not set
    const userMessages = conversationHistory.filter(m => m.role === 'user').map(m => m.content);
    userMessages.push(userMessage);

    const numAnswers = userMessages.length;

    if (numAnswers === 1) {
      return "Hi! I am Mani 🚗. What type of trip are you planning? (one-way, outstation, airport, or corporate?)";
    } else if (numAnswers === 2) {
      return "Great! How many passengers will be traveling?";
    } else if (numAnswers === 3) {
      return "Understood. How much luggage will you have? (none, small, medium, or large?)";
    } else if (numAnswers === 4) {
      return "Got it. What is your budget per day (in ₹)?";
    } else if (numAnswers === 5) {
      return "And finally, what is your pickup date? (DD/MM/YYYY)";
    } else {
      // We have all 5 answers!
      const tripType = userMessages[1] || 'outstation';
      const passengers = parseInt(userMessages[2]) || 4;
      const luggage = (userMessages[3] || 'medium').toLowerCase();
      const budgetMax = parseFloat(userMessages[4]) || 2000;
      const comfort = passengers <= 4 ? 'standard' : 'premium';

      // Call rule based recommendation
      const recommendedCar = getRuleBasedRecommendation(passengers, luggage, budgetMax, comfort);
      
      let price = 1400;
      let seats = 4;
      let luggageText = 'medium';
      
      if (recommendedCar === 'Toyota Innova Crysta') {
        price = 2800; seats = 7; luggageText = 'large';
      } else if (recommendedCar === 'Alto K10') {
        price = 900; seats = 4; luggageText = 'small';
      } else if (recommendedCar === 'Swift Dzire') {
        price = 1400; seats = 4; luggageText = 'medium';
      } else if (recommendedCar === 'Toyota Fortuner') {
        price = 4500; seats = 7; luggageText = 'large';
      } else if (recommendedCar === 'Mercedes E-Class') {
        price = 7000; seats = 4; luggageText = 'medium';
      } else if (recommendedCar === 'Kia Carens') {
        price = 2500; seats = 6; luggageText = 'large';
      } else if (recommendedCar === 'Honda City') {
        price = 2000; seats = 4; luggageText = 'medium';
      }

      return `Great! Based on your requirements, I recommend: ${recommendedCar}. It fits ${seats} passengers, handles ${luggageText} luggage, and costs ₹${price}/day. Shall I take you to the booking form?`;
    }
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      systemInstruction: CHAT_SYSTEM_PROMPT
    });

    // Build conversation history for Gemini
    const chat = model.startChat({
      history: conversationHistory.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
      }))
    });

    const result = await chat.sendMessage(userMessage);
    return result.response.text();
  } catch (err) {
    console.error('[AI] Chat error:', err.message);
    return "Sorry, I'm having trouble connecting right now. Please try the recommendation form above or call us at +91 98765 00000.";
  }
}

module.exports = { getAIRecommendation, getChatbotReply, getRuleBasedRecommendation };
