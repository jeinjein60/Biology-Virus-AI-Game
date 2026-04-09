// ══════════════════════════════════════════════════════
// AI Integration Layer (migrated from Flask backend)
// Loaded before script.js — all functions are global.
// ══════════════════════════════════════════════════════

const AI_MODEL = 'gpt-4o-mini';

const SYSTEM_PROMPT = `You are the AI director for OUTBREAK RESPONSE, a biology education simulation game for students.
You generate scientifically accurate, engaging content about virology and epidemiology.
Always respond with valid JSON only — no markdown, no code fences, no extra text outside the JSON.`;

const DAY_THEMES = {
  1: "Starting outbreak detection, early response, and epidemiological investigation",
  2: "Quarantine strategies and isolation protocols",
  3: "Clinical treatment approaches, hospital capacity planning, and healthcare worker safety",
  4: "Public health communication, media management, and ethical dilemmas",
  5: "Resource mobilization and international cooperation",
  6: "Vaccine development, distribution logistics, and public compliance",
  7: "Final containment measures. Reflect on the overall outbreak response and lessons learned"
};

// create sub topics to prevent repetition
const DAY_SUBTOPICS = {
  1: ["Field symptom detection and initial case reporting", "Laboratory diagnostics and pathogen identification", "Epidemiological tracing and source investigation"],
  2: ["Individual patient isolation and quarantine facilities", "Contact tracing methodology and exposure mapping", "Border controls, travel restrictions, and community quarantine"],
  3: ["Emergency triage systems and hospital surge capacity", "Antiviral and supportive treatment protocols", "Healthcare worker PPE, safety, and infection prevention"],
  4: ["Crafting clear public health messaging to prevent panic", "Managing media coverage and combating misinformation", "Ethical dilemmas: individual rights vs. public safety"],
  5: ["Medical supply chains and equipment procurement", "Requesting and coordinating international aid", "Allocating limited resources fairly across regions"],
  6: ["Responding to a new viral mutation or variant", "Managing secondary infections and co-morbidities", "Healthcare system strain and staff burnout mitigation"],
  7: ["Final large-scale containment and case closure", "Evaluating overall outbreak response effectiveness", "Post-outbreak recovery and prevention for the future"]
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
  if (data.error) throw new Error(data.error);

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
  const theme = DAY_THEMES[day] || 'outbreak response';
  const subtopic = (DAY_SUBTOPICS[day] || [])[questionNum - 1] || theme;

  const usedTopics = history.length > 0
    ? '\nALREADY COVERED — do NOT repeat these topics or scenarios:\n' +
      history.map(h => `- Day ${h.day} Q${h.q}: ${h.question_text || h.choice}`).join('\n')
    : '';

  return `Generate question ${questionNum} of 3 for Day ${day} of a 7-day virus outbreak simulation.

OUTBREAK CONTEXT:
- Virus: ${virusData.virus_name || 'Unknown'} (inspired by ${virusData.real_virus || 'Unknown'})
- Transmission: ${virusData.transmission || 'Unknown'}
- Location: ${virusData.location || 'Unknown'}
- Day ${day} broad theme: ${theme}
- THIS question's specific focus: ${subtopic}
${usedTopics}

INSTRUCTIONS:
1. Write a scenario SPECIFIC to "${subtopic}" — not the broad day theme
2. The question must ask about a real epidemiological decision related to that subtopic
3. Provide 4 meaningfully different choices (A–D), each 15–20 words
4. Make choices represent genuinely different scientific strategies, not paraphrases of each other
5. VARY the correct answer — do not always make A or B correct
6. Rate each choice: "excellent", "good", "poor", or "terrible"
7. The educational_note must teach a specific biology or epidemiology fact tied to "${subtopic}"

Return ONLY this JSON:
{
  "scenario": "2 sentences describing a specific crisis moment related to ${subtopic} (max 30 words)",
  "question": "A specific decision question about ${subtopic}",
  "choices": [
    {"id": "A", "text": "Specific strategy A (15-20 words)"},
    {"id": "B", "text": "Specific strategy B (15-20 words)"},
    {"id": "C", "text": "Specific strategy C (15-20 words)"},
    {"id": "D", "text": "Specific strategy D (15-20 words)"}
  ],
  "correct": "A or B or C or D",
  "choice_ratings": {
    "A": "excellent or good or poor or terrible",
    "B": "excellent or good or poor or terrible",
    "C": "excellent or good or poor or terrible",
    "D": "excellent or good or poor or terrible"
  },
  "educational_note": "One specific biology/epidemiology fact about ${subtopic} (under 25 words)"
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
