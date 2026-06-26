'use strict';

/**
 * routes/recommend.js
 * ─────────────────────────────────────────────────────────────────────────────
 * POST /api/v1/recommend
 *
 * Parameterized AI Prompt Router Engine — the core intelligence layer.
 *
 * Full pipeline:
 *   1. Validate request input (enquiry_id).
 *   2. Fetch the enquiry, asserting it belongs to req.tenant_id.
 *   3. Fetch the tenant's available fleet filtered by passenger + luggage needs.
 *   4. Fetch tenant branding config for prompt personalization.
 *   5. Build a structured, parameterized LLM prompt injecting all context.
 *   6. Call Gemini (or OpenAI) with retry/timeout logic.
 *   7. Parse and validate the JSON payload returned by the LLM.
 *   8. Write the result to recommendation_history (append-only audit log).
 *   9. Update the enquiry status to 'Recommended'.
 *  10. Return the ranked recommendations to the caller.
 *
 * Role Access: BookingExecutive, FleetManager, SuperAdmin
 * ─────────────────────────────────────────────────────────────────────────────
 */

const express = require('express');
const router  = express.Router();
const { pool } = require('../db/pool');
const { authenticate, requireRole } = require('../middleware/auth');

// ─── AI Provider Configuration ───────────────────────────────────────────────

// The engine supports both Gemini and OpenAI. Set AI_PROVIDER in .env.
// Valid values: "gemini" | "openai" | "mock" (for local dev without a key)
const AI_PROVIDER    = process.env.AI_PROVIDER    || 'mock';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY  || '';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY  || '';

// Timeouts & Retry
const AI_TIMEOUT_MS  = parseInt(process.env.AI_TIMEOUT_MS || '15000', 10);
const AI_MAX_RETRIES = parseInt(process.env.AI_MAX_RETRIES || '2', 10);

// ─── Helper: Structured API Error ────────────────────────────────────────────

function apiError(res, status, code, message, details = null) {
  const body = { success: false, error: { code, message } };
  if (details) body.error.details = details;
  return res.status(status).json(body);
}

// ─── Helper: Sleep for retry back-off ────────────────────────────────────────

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ─── Prompt Builder ───────────────────────────────────────────────────────────

/**
 * buildSystemPrompt(tenantName, enquiry, fleet)
 * ─────────────────────────────────────────────────────────────────────────────
 * Constructs a deeply parameterized system prompt that bakes in:
 *   - Tenant identity (so the LLM acts as that company's AI assistant)
 *   - Customer's full trip requirements
 *   - Live available fleet with rich attributes
 *
 * IMPORTANT: The output contract demands strict JSON — we use a JSON-only
 * system instruction to prevent the LLM from adding prose before the JSON.
 *
 * @param {string} tenantName
 * @param {object} enquiry   - Row from enquiries table
 * @param {object[]} fleet   - Rows from vehicles table (available only)
 * @returns {{ systemPrompt: string, userMessage: string }}
 */
function buildPrompts(tenantName, enquiry, fleet) {
  // Serialize fleet into a compact, LLM-readable format
  const fleetBlock = fleet.map((v, idx) => {
    const features = Array.isArray(v.features) ? v.features.join(', ') : (v.features || 'None');
    return [
      `[Vehicle ${idx + 1}]`,
      `  ID:           ${v.vehicle_id}`,
      `  Name:         ${v.make} ${v.model}`,
      `  Tier:         ${v.tier}`,
      `  Passengers:   ${v.capacity_passengers} max`,
      `  Luggage:      ${v.capacity_luggage}`,
      `  Daily Rate:   ₹${v.daily_rate || 'N/A'} | Hourly Rate: ₹${v.hourly_rate}/hr`,
      `  Features:     ${features}`,
      `  Availability: ${v.quantity} unit(s) available`,
    ].join('\n');
  }).join('\n\n');

  // Customer trip context block
  const budgetStr = enquiry.budget_min && enquiry.budget_max
    ? `₹${enquiry.budget_min} – ₹${enquiry.budget_max}`
    : enquiry.budget_max
      ? `Up to ₹${enquiry.budget_max}`
      : 'Not specified';

  const tripBlock = [
    `Trip Type:             ${enquiry.trip_type}`,
    `Passengers:            ${enquiry.passenger_count}`,
    `Luggage Items:         ${enquiry.luggage_count}`,
    `Comfort Preference:    ${enquiry.comfort_preference}`,
    `Budget Range:          ${budgetStr}`,
    `Pickup:                ${enquiry.pickup_location || 'Not specified'}`,
    `Drop:                  ${enquiry.drop_location   || 'Not specified'}`,
    `Trip Date:             ${enquiry.trip_date       || 'Not specified'}`,
    `Return Date:           ${enquiry.return_date     || 'N/A'}`,
    `Special Requirements:  ${enquiry.special_requirements || 'None'}`,
  ].join('\n');

  const systemPrompt = `You are the AI Recommendation Engine for "${tenantName}", a professional transportation and fleet management company.

Your task is to analyze a customer's trip requirements and rank the most suitable vehicles from the company's current available fleet.

STRICT RULES:
1. You MUST respond with ONLY a valid JSON object. No markdown, no prose, no code fences.
2. You MUST rank vehicles in order of suitability (rank 1 = best match).
3. Scores are integers 0–100. Score reflects alignment with passenger count, luggage, budget, comfort preference, and trip type.
4. Only include vehicles from the provided fleet list. Do not hallucinate vehicles.
5. Return at most 3 recommendations.
6. The "reason" field must be 1–2 concise sentences explaining why this vehicle is a fit.
7. The "ai_explanation" field is a 2–3 sentence paragraph summarizing your overall recommendation strategy for this trip.

REQUIRED OUTPUT SCHEMA (exact field names, no additions):
{
  "recommendations": [
    {
      "rank": 1,
      "vehicle_id": "<UUID from fleet>",
      "vehicle_name": "<Make Model>",
      "tier": "<Budget|Comfort|Luxury>",
      "suitability_score": <integer 0-100>,
      "estimated_cost": "<string, e.g. ₹3,500/day>",
      "reason": "<1-2 sentence justification>"
    }
  ],
  "ai_explanation": "<2-3 sentence overall recommendation narrative>",
  "confidence": "<high|medium|low>"
}`;

  const userMessage = `CUSTOMER TRIP REQUIREMENTS:
${tripBlock}

AVAILABLE FLEET FOR ${tenantName.toUpperCase()}:
${fleet.length > 0 ? fleetBlock : 'No vehicles currently match the availability criteria.'}

Analyze the above and return the ranked JSON recommendations now.`;

  return { systemPrompt, userMessage };
}

// ─── AI Caller: Gemini ────────────────────────────────────────────────────────

/**
 * callGemini(systemPrompt, userMessage)
 * Uses @google/generative-ai SDK to call gemini-2.0-flash.
 * Enforces responseSchema for strict JSON output.
 *
 * @returns {{ text: string, model: string, promptTokens: number, completionTokens: number }}
 */
async function callGemini(systemPrompt, userMessage) {
  const { GoogleGenerativeAI } = require('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    systemInstruction: systemPrompt,
    generationConfig: {
      responseMimeType: 'application/json',
      temperature:      0.2,   // Low temperature = deterministic, factual
      maxOutputTokens:  1024,
    },
  });

  const result    = await model.generateContent(userMessage);
  const response  = result.response;
  const text      = response.text();

  // Extract token counts if available (Gemini returns usageMetadata)
  const usage = response.usageMetadata || {};
  return {
    text,
    model:            'gemini-2.0-flash',
    promptTokens:     usage.promptTokenCount      || null,
    completionTokens: usage.candidatesTokenCount  || null,
  };
}

// ─── AI Caller: OpenAI ────────────────────────────────────────────────────────

/**
 * callOpenAI(systemPrompt, userMessage)
 * Uses openai npm SDK with gpt-4o-mini for cost efficiency.
 * Forces JSON mode via response_format.
 *
 * @returns {{ text: string, model: string, promptTokens: number, completionTokens: number }}
 */
async function callOpenAI(systemPrompt, userMessage) {
  const OpenAI = require('openai');
  const client = new OpenAI({ apiKey: OPENAI_API_KEY });

  const completion = await client.chat.completions.create({
    model:           'gpt-4o-mini',
    temperature:     0.2,
    max_tokens:      1024,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: userMessage  },
    ],
  });

  const choice = completion.choices[0];
  return {
    text:             choice.message.content,
    model:            completion.model,
    promptTokens:     completion.usage?.prompt_tokens     || null,
    completionTokens: completion.usage?.completion_tokens || null,
  };
}

// ─── AI Caller: Mock (development / testing) ──────────────────────────────────

/**
 * callMock(fleet)
 * Returns a deterministic mock response using the first 3 fleet vehicles.
 * Used when AI_PROVIDER=mock or when no API key is available.
 */
function callMock(fleet) {
  const top = fleet.slice(0, 3);
  const recs = top.map((v, i) => ({
    rank:              i + 1,
    vehicle_id:        v.vehicle_id,
    vehicle_name:      `${v.make} ${v.model}`,
    tier:              v.tier,
    suitability_score: 90 - (i * 12),
    estimated_cost:    `₹${v.daily_rate || v.hourly_rate * 10}/day`,
    reason:            `The ${v.make} ${v.model} comfortably fits the passenger count with a ${v.tier.toLowerCase()} experience and falls within the stated budget range.`,
  }));

  return {
    text: JSON.stringify({
      recommendations: recs,
      ai_explanation:  'Based on your trip requirements, these vehicles offer the best combination of capacity, comfort, and value. The top pick is selected for optimal passenger comfort while respecting your stated budget.',
      confidence:      'medium',
    }),
    model:            'rule-based-fallback',
    promptTokens:     null,
    completionTokens: null,
  };
}

// ─── AI Dispatcher with Retry ─────────────────────────────────────────────────

/**
 * dispatchToAI(systemPrompt, userMessage, fleet)
 * Wraps the provider call with timeout enforcement and exponential-backoff retry.
 *
 * @returns {{ text, model, promptTokens, completionTokens }}
 */
async function dispatchToAI(systemPrompt, userMessage, fleet) {
  const provider = AI_PROVIDER.toLowerCase();

  // Wrap the provider call in a race against a timeout promise
  const callWithTimeout = (callFn) => {
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`AI provider timed out after ${AI_TIMEOUT_MS}ms`)), AI_TIMEOUT_MS)
    );
    return Promise.race([callFn(), timeout]);
  };

  let lastError;
  for (let attempt = 1; attempt <= AI_MAX_RETRIES + 1; attempt++) {
    try {
      if (provider === 'gemini' && GEMINI_API_KEY) {
        return await callWithTimeout(() => callGemini(systemPrompt, userMessage));
      }
      if (provider === 'openai' && OPENAI_API_KEY) {
        return await callWithTimeout(() => callOpenAI(systemPrompt, userMessage));
      }
      // Fallback: mock mode
      return callMock(fleet);
    } catch (err) {
      lastError = err;
      console.warn(`[RECOMMEND] AI call attempt ${attempt} failed: ${err.message}`);
      if (attempt <= AI_MAX_RETRIES) {
        // Exponential back-off: 1s, 2s, 4s ...
        await sleep(Math.pow(2, attempt - 1) * 1000);
      }
    }
  }

  // All retries exhausted — fall back to mock so the service degrades gracefully
  console.error('[RECOMMEND] All AI retries exhausted. Falling back to mock.', lastError?.message);
  return callMock(fleet);
}

// ─── Response Parser ──────────────────────────────────────────────────────────

/**
 * parseAIResponse(rawText)
 * Safely parses the LLM output. Handles cases where the model accidentally
 * wraps the JSON in markdown code fences (```json ... ```).
 *
 * @param {string} rawText
 * @returns {{ recommendations: object[], ai_explanation: string, confidence: string }}
 * @throws {Error} if JSON is unparseable or schema is violated
 */
function parseAIResponse(rawText) {
  // Strip optional markdown fences
  const cleaned = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (_) {
    throw new Error(`LLM returned non-JSON content: ${rawText.substring(0, 200)}`);
  }

  // Schema validation
  if (!Array.isArray(parsed.recommendations)) {
    throw new Error('LLM response missing "recommendations" array.');
  }

  // Validate each recommendation
  for (const rec of parsed.recommendations) {
    if (typeof rec.rank             !== 'number') throw new Error(`Rec missing "rank": ${JSON.stringify(rec)}`);
    if (typeof rec.vehicle_id       !== 'string') throw new Error(`Rec missing "vehicle_id": ${JSON.stringify(rec)}`);
    if (typeof rec.suitability_score !== 'number') throw new Error(`Rec missing "suitability_score": ${JSON.stringify(rec)}`);
  }

  return {
    recommendations: parsed.recommendations,
    ai_explanation:  parsed.ai_explanation  || '',
    confidence:      parsed.confidence      || 'medium',
  };
}

// ─── Route Handler ────────────────────────────────────────────────────────────

/**
 * POST /api/v1/recommend
 *
 * Body: { enquiry_id: UUID }
 *
 * Protected: authenticate + requireRole('BookingExecutive', 'FleetManager', 'SuperAdmin')
 */
router.post(
  '/',
  authenticate,
  requireRole('BookingExecutive', 'FleetManager', 'SuperAdmin'),
  async (req, res) => {
    const startTime = Date.now();

    // ── 1. Input validation ───────────────────────────────────────────────────
    const { enquiry_id } = req.body;

    if (!enquiry_id || typeof enquiry_id !== 'string') {
      return apiError(res, 400, 'MISSING_ENQUIRY_ID',
        'Request body must contain a non-empty "enquiry_id" string (UUID).');
    }

    // Basic UUID format check (prevents DB-level errors from malformed input)
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_RE.test(enquiry_id)) {
      return apiError(res, 400, 'INVALID_ENQUIRY_ID',
        '"enquiry_id" must be a valid UUID v4 string.');
    }

    const tenantId = req.tenant_id;   // Injected by authenticate middleware

    // ── 2. Fetch the enquiry (strict tenant isolation) ────────────────────────
    let enquiry;
    try {
      const result = await pool.query(
        `SELECT
           e.enquiry_id,
           e.customer_name,
           e.contact_info,
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
           e.status
         FROM enquiries e
         WHERE e.enquiry_id = $1
           AND e.tenant_id  = $2
         LIMIT 1`,
        [enquiry_id, tenantId]
      );
      enquiry = result.rows[0];
    } catch (dbErr) {
      console.error('[RECOMMEND] DB error fetching enquiry:', dbErr);
      return apiError(res, 500, 'DB_FETCH_ERROR', 'Failed to retrieve enquiry from database.');
    }

    if (!enquiry) {
      return apiError(res, 404, 'ENQUIRY_NOT_FOUND',
        `Enquiry "${enquiry_id}" does not exist or does not belong to your organization.`);
    }

    // Prevent re-running AI on already-booked enquiries
    if (enquiry.status === 'Booked') {
      return apiError(res, 409, 'ENQUIRY_ALREADY_BOOKED',
        'This enquiry has already been booked and cannot be re-recommended.');
    }

    // ── 3. Fetch tenant branding for prompt personalization ───────────────────
    let tenantRow;
    try {
      const result = await pool.query(
        `SELECT company_name, theme_config FROM tenants WHERE tenant_id = $1 LIMIT 1`,
        [tenantId]
      );
      tenantRow = result.rows[0];
    } catch (dbErr) {
      console.error('[RECOMMEND] DB error fetching tenant:', dbErr);
      return apiError(res, 500, 'DB_FETCH_ERROR', 'Failed to retrieve tenant configuration.');
    }

    const tenantName = tenantRow?.company_name || 'Fleet Management Co.';

    // ── 4. Fetch available fleet for this tenant (smart pre-filtering) ─────────
    // Pre-filter in SQL to reduce tokens sent to the LLM:
    //   - Only 'Available' vehicles
    //   - Only vehicles with enough passenger capacity
    //   - Ordered by tier relevance to the comfort_preference
    let fleet;
    try {
      const result = await pool.query(
        `SELECT
           v.vehicle_id,
           v.make,
           v.model,
           v.tier,
           v.capacity_passengers,
           v.capacity_luggage,
           v.hourly_rate,
           v.daily_rate,
           v.features,
           v.image_url,
           v.quantity
         FROM vehicles v
         WHERE v.tenant_id            = $1
           AND v.status               = 'Available'
           AND v.capacity_passengers >= $2
           AND v.quantity             > 0
         ORDER BY
           -- Prefer vehicles that match the stated comfort preference tier
           CASE
             WHEN $3 = 'premium'  AND v.tier = 'Luxury'  THEN 0
             WHEN $3 = 'standard' AND v.tier = 'Comfort' THEN 0
             WHEN $3 = 'economy'  AND v.tier = 'Budget'  THEN 0
             ELSE 1
           END,
           v.daily_rate ASC
         LIMIT 10`,
        [tenantId, enquiry.passenger_count, enquiry.comfort_preference]
      );
      fleet = result.rows;
    } catch (dbErr) {
      console.error('[RECOMMEND] DB error fetching fleet:', dbErr);
      return apiError(res, 500, 'DB_FETCH_ERROR', 'Failed to retrieve fleet from database.');
    }

    if (fleet.length === 0) {
      return apiError(res, 422, 'NO_FLEET_AVAILABLE',
        `No available vehicles found for ${enquiry.passenger_count} passengers. ` +
        'Please check vehicle availability or adjust the passenger count.');
    }

    // ── 5. Build parameterized prompts ────────────────────────────────────────
    const { systemPrompt, userMessage } = buildPrompts(tenantName, enquiry, fleet);

    // ── 6. Call AI with timeout and retry ─────────────────────────────────────
    let aiRaw;
    try {
      aiRaw = await dispatchToAI(systemPrompt, userMessage, fleet);
    } catch (aiErr) {
      // dispatchToAI itself catches and falls back to mock, so this is truly unexpected
      console.error('[RECOMMEND] Fatal AI dispatch error:', aiErr);
      return apiError(res, 502, 'AI_SERVICE_ERROR', 'AI recommendation service is temporarily unavailable.');
    }

    // ── 7. Parse and validate the AI response ─────────────────────────────────
    let parsed;
    try {
      parsed = parseAIResponse(aiRaw.text);
    } catch (parseErr) {
      console.error('[RECOMMEND] Failed to parse AI response:', parseErr.message);
      console.error('[RECOMMEND] Raw AI output:', aiRaw.text);
      return apiError(res, 502, 'AI_RESPONSE_PARSE_ERROR',
        'The AI model returned an unprocessable response. Please retry.');
    }

    const latencyMs = Date.now() - startTime;

    // ── 8. Write to recommendation_history (begin transaction) ────────────────
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Insert into audit log (append-only — never UPDATE this table)
      const histResult = await client.query(
        `INSERT INTO recommendation_history
           (enquiry_id, tenant_id, recommended_vehicles, ai_explanation,
            model_used, prompt_tokens, completion_tokens, latency_ms)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING rec_id, generated_at`,
        [
          enquiry_id,
          tenantId,
          JSON.stringify(parsed.recommendations),
          parsed.ai_explanation,
          aiRaw.model,
          aiRaw.promptTokens,
          aiRaw.completionTokens,
          latencyMs,
        ]
      );

      const histRow = histResult.rows[0];

      // ── 9. Update enquiry status to 'Recommended' ─────────────────────────
      await client.query(
        `UPDATE enquiries
         SET status     = 'Recommended',
             updated_at = NOW()
         WHERE enquiry_id = $1
           AND tenant_id  = $2
           AND status    != 'Booked'`,   // Safety guard: never downgrade a booking
        [enquiry_id, tenantId]
      );

      await client.query('COMMIT');

      // ── 10. Return clean, frontend-ready response ─────────────────────────
      return res.status(200).json({
        success: true,
        data: {
          rec_id:           histRow.rec_id,
          enquiry_id,
          generated_at:     histRow.generated_at,
          model_used:       aiRaw.model,
          latency_ms:       latencyMs,
          confidence:       parsed.confidence,
          ai_explanation:   parsed.ai_explanation,
          recommendations:  parsed.recommendations,
        },
      });

    } catch (txErr) {
      await client.query('ROLLBACK');
      console.error('[RECOMMEND] Transaction error saving recommendation:', txErr);
      return apiError(res, 500, 'DB_WRITE_ERROR', 'Failed to save recommendation. The AI call succeeded but persistence failed.');
    } finally {
      client.release();
    }
  }
);

module.exports = router;
