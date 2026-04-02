// ══════════════════════════════════════════════════════
// AI Integration Layer (migrated from Flask backend)
// Loaded before script.js — all functions are global.
// ══════════════════════════════════════════════════════

const AI_MODEL = 'gpt-4o-mini';

const SYSTEM_PROMPT = `You are the AI director for OUTBREAK RESPONSE, a biology education simulation game for students.
You generate scientifically accurate, engaging content about virology and epidemiology.
Always respond with valid JSON only — no markdown, no code fences, no extra text outside the JSON.`;

const DAY_THEMES = {
  1: "Initial outbreak detection and rapid diagnostic testing",
  2: "Quarantine strategies and isolation protocols",
  3: "Clinical treatment approaches, hospital capacity planning, and triage systems",
  4: "Public health communication, media management, and ethical dilemmas",
  5: "Resource mobilization, international cooperation, and supply chain logistics",
  6: "Addressing complications: mutations, secondary infections, and system strain",
  7: "Final containment measures and outbreak resolution"
};

// ── JSON repair (ported from Python backend) ──

function repairJson(text) {
  let t = text;
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start !== -1 && end !== -1) t = t.slice(start, end + 1);
  t = t.replace(/\u201c/g, '"').replace(/\u201d/g, '"');
  t = t.replace(/,\s*([}\]])/g, '$1');
  return t;
}

function safeJson(text) {
  const attempts = [
    ['Direct', t => t],
    ['Strip markdown', t => t.replace(/```(?:json)?\s*|\s*```/g, '')],
    ['Repair', repairJson],
    ['Extract + repair', t => repairJson(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1))]
  ];
  for (const [name, transform] of attempts) {
    try {
      return JSON.parse(transform(text));
    } catch (e) {
      console.warn(`⚠️ ${name} parse failed:`, e.message);
    }
  }
  console.error('JSON parsing failed! Response:', text.slice(0, 500));
  throw new Error('Could not parse JSON: ' + text.slice(0, 200));
}

// ── AI proxy call ──

async function callAI(prompt, maxTokens = 2000) {
  const res = await fetch('/api/ai/openai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: AI_MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt + '\n\nReturn ONLY valid JSON with no extra text.' }
      ],
      max_tokens: maxTokens,
      temperature: 0.8
    })
  });

  const data = await res.json();

  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error('Empty response from AI');

  let cleaned = text.trim();
  if (!cleaned.endsWith('}')) {
    const lastBrace = cleaned.lastIndexOf('}');
    if (lastBrace > 0) cleaned = cleaned.slice(0, lastBrace + 1);
  }
  cleaned = cleaned.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/\s*```$/, '');

  return safeJson(cleaned);
}

// ── Prompt builders ──

function buildStartPrompt() {
  return `Generate a virus outbreak scenario for the game.
Choose one real virus as inspiration from this list: Ebola, COVID-19, Influenza H1N1, Smallpox, SARS-CoV-1, Zika, Marburg, Nipah, Rabies, or Dengue Fever.
Create a FICTIONAL virus name (dramatic, scientific-sounding, NOT the real name).

Return ONLY this JSON (no extra text):
{
  "virus_name": "fictional dramatic virus name",
  "real_virus": "the real virus this scenario is inspired by",
  "classification": "virus family (e.g. Filoviridae, Coronavirus, etc.)",
  "transmission": "how it spreads in one sentence",
  "mortality_rate": "percentage as string e.g. '45-90%'",
  "incubation_period": "e.g. '2-21 days'",
  "symptoms": ["symptom 1", "symptom 2", "symptom 3", "symptom 4"],
  "location": "City, Country where outbreak started",
  "initial_cases": "number as string",
  "scenario": "2-sentence dramatic scenario setting the scene of the outbreak",
  "day1_briefing": "Your mission briefing as lead scientist — 2 engaging sentences about what you must do"
}`;
}

function buildQuestionPrompt(virusData, day, questionNum, history) {
  let recentContext = '';
  if (history.length > 0) {
    const recent = history.slice(-2);
    recentContext = '\nRecent decisions: ' + recent.map(
      h => `Day ${h.day} Q${h.q}: chose option ${h.choice}`
    ).join('; ');
  }

  const theme = DAY_THEMES[day] || 'outbreak response';

  return `Generate question ${questionNum} of 2 for Day ${day} of the 7-day outbreak simulation.

OUTBREAK CONTEXT:
- Virus: ${virusData.virus_name || 'Unknown'}
- Based on: ${virusData.real_virus || 'Unknown'}
- Transmission: ${virusData.transmission || 'Unknown'}
- Location: ${virusData.location || 'Unknown'}
- Day ${day} Theme: ${theme}
${recentContext}

INSTRUCTIONS:
1. Create a SHORT scenario (1-2 sentences, max 15 words total)
2. Keep the question direct and clear
3. Provide 4 distinct choices (A, B, C, D) - each 10-15 words max
4. VARY which choice is correct - don't always pick A or B
5. Rate each choice: "excellent", "good", "poor", or "terrible"
6. Include one brief science fact (under 20 words)

Return ONLY this JSON:
{
  "scenario": "1-2 short sentences about ${theme} (max 25 words total)",
  "question": "What is your decision?",
  "choices": [
    {"id": "A", "text": "Brief strategy A (10-15 words)"},
    {"id": "B", "text": "Brief strategy B (10-15 words)"},
    {"id": "C", "text": "Brief strategy C (10-15 words)"},
    {"id": "D", "text": "Brief strategy D (10-15 words)"}
  ],
  "correct": "A or B or C or D",
  "choice_ratings": {
    "A": "excellent or good or poor or terrible",
    "B": "excellent or good or poor or terrible",
    "C": "excellent or good or poor or terrible",
    "D": "excellent or good or poor or terrible"
  },
  "educational_note": "One brief science fact (under 20 words)"
}`;
}

function buildFeedbackPrompt(choiceId, rating, questionData) {
  const chosen = (questionData.choices || []).find(c => c.id === choiceId);
  const correctId = questionData.correct || 'A';

  return `The player chose option ${choiceId} which was rated as "${rating}".

Question: ${questionData.question || ''}
Their choice: ${chosen ? chosen.text : 'unknown'}
Best answer was: ${correctId}

Generate feedback explaining why this choice was ${rating}.

Return ONLY this JSON:
{
  "result": "${rating.toUpperCase()}",
  "score_change": 0,
  "feedback": "2-3 sentences explaining WHY this choice was ${rating} from an epidemiological perspective",
  "containment_effect": "One sentence about how this decision affected the outbreak trajectory"
}`;
}

function buildEndPrompt(virusData, totalScore, history) {
  const outcome = totalScore >= 60 ? 'CONTAINED' : 'OUTBREAK FAILED';
  const historySummary = history.map(
    h => `Day${h.day}Q${h.q}:${h.choice}(${h.rating || '?'})`
  ).join(' | ');

  return `The 7-day virus response simulation is complete.

VIRUS: ${virusData.virus_name} (inspired by ${virusData.real_virus})
FINAL SCORE: ${totalScore}/100
OUTCOME: ${outcome}
DECISION LOG: ${historySummary}

Return ONLY this JSON:
{
  "outcome": "${outcome}",
  "headline": "Dramatic one-sentence news headline about the ${outcome.toLowerCase()}",
  "evaluation": "3-4 sentences evaluating the player's overall strategy and performance",
  "key_mistakes": ["specific mistake 1 if score < 80", "specific mistake 2 if score < 70"],
  "key_successes": ["specific success 1", "specific success 2"],
  "real_world_virus_info": {
    "name": "${virusData.real_virus}",
    "overview": "2-3 sentences about the real virus — biology, how it works, structure",
    "historical_outbreaks": "2 sentences about notable real-world outbreak(s)",
    "real_containment": "2 sentences on how this virus is actually contained in real life",
    "vaccines_treatments": "1-2 sentences on real vaccines or treatments available",
    "interesting_fact": "One fascinating, surprising biology fact about this specific virus"
  }
}`;
}

function buildChatPrompt(message, context, chatHistory) {
  const historyLines = (chatHistory || []).slice(-8).map(
    item => `${(item.role || 'user').toUpperCase()}: ${(item.text || '').trim()}`
  ).filter(Boolean);
  const historyText = historyLines.length > 0 ? historyLines.join('\n') : 'No prior chat messages.';

  return `You are the in-game biology helper for a student playing OUTBREAK RESPONSE.

CURRENT GAME CONTEXT:
- Fictional virus: ${context.virus_name || 'Unknown Virus'}
- Inspired by: ${context.real_virus || 'Unknown'}
- Transmission: ${context.transmission || 'Unknown'}
- Symptoms: ${(context.symptoms || []).join(', ') || 'Unknown'}
- Location: ${context.location || 'Unknown'}
- Day: ${context.day || 1}
- Question number: ${context.question_num || 1}
- Containment score: ${context.score || 50}/100
- Current scenario: ${(context.current_question || {}).scenario || 'Not available'}
- Current question: ${(context.current_question || {}).question || 'Not available'}
- Recent decisions: ${JSON.stringify(context.history || [])}

CHAT HISTORY:
${historyText}

STUDENT MESSAGE:
${message}

INSTRUCTIONS:
1. Answer like a helpful biology tutor during the game.
2. Keep it concise: 2-4 sentences.
3. Be scientifically grounded and age-appropriate.
4. Do not reveal hidden answer labels like "A" or "B" unless the student explicitly asks to compare options.
5. If discussing strategy, guide the student toward reasoning, tradeoffs, and epidemiology concepts.

Return ONLY this JSON:
{
  "reply": "Short helpful response for the student"
}`;
}

// ── Fallbacks ──

function buildQuestionFallback(day) {
  const theme = DAY_THEMES[day] || 'outbreak response';
  return {
    scenario: `Day ${day}: A critical situation has emerged related to ${theme}. Your team needs immediate direction on how to proceed.`,
    question: 'What action should you take?',
    choices: [
      { id: 'A', text: 'Implement aggressive containment measures immediately' },
      { id: 'B', text: 'Gather more epidemiological data before acting' },
      { id: 'C', text: 'Follow established public health protocols' },
      { id: 'D', text: 'Coordinate with international health organizations' }
    ],
    correct: 'C',
    choice_ratings: { A: 'good', B: 'good', C: 'excellent', D: 'good' },
    educational_note: `Evidence-based protocols are essential in ${theme}.`
  };
}

// ── Helpers ──

function shuffleChoices(data) {
  const shuffled = [...data.choices].sort(() => Math.random() - 0.5);
  const labels = ['A', 'B', 'C', 'D'];
  const oldToNew = {};
  shuffled.forEach((choice, i) => {
    oldToNew[choice.id] = labels[i];
    choice.id = labels[i];
  });
  data.choices = shuffled;
  data.correct = oldToNew[data.correct];
  data.choice_ratings = Object.fromEntries(
    Object.entries(data.choice_ratings).map(([k, v]) => [oldToNew[k], v])
  );
  return data;
}

async function generateSingleQuestion(virusData, day, questionNum, history) {
  const prompt = buildQuestionPrompt(virusData, day, questionNum, history);
  const data = await callAI(prompt, 2500);

  for (const field of ['scenario', 'question', 'choices', 'correct', 'choice_ratings']) {
    if (!(field in data)) throw new Error('Missing field: ' + field);
  }
  if (!data.educational_note) {
    data.educational_note = `Scientific decision-making is critical in ${DAY_THEMES[day] || 'outbreak response'}.`;
  }

  return shuffleChoices(data);
}
