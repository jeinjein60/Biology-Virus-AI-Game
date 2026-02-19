from flask import Flask, render_template, request, jsonify
import google.generativeai as genai
import json
import re
import os

app = Flask(__name__)

# Configure Gemini
genai.configure(api_key=os.environ.get("AIzaSyAMzwV_ccres3zZrOPYq3p7cdSuDXke6xA"))

# Automatically find an available model
available_models = [m.name for m in genai.list_models() if 'generateContent' in m.supported_generation_methods]
if not available_models:
    raise Exception("No models available! Check your API key.")

model_name = available_models[0]  # Use the first available model
print(f"✅ Using model: {model_name}")
model = genai.GenerativeModel(model_name)

SYSTEM_PROMPT = """You are the AI director for OUTBREAK RESPONSE, a biology education simulation game for students.
You generate scientifically accurate, engaging content about virology and epidemiology.
Always respond with valid JSON only — no markdown, no code fences, no extra text outside the JSON."""


def call_gemini(prompt, max_tokens=2000):
    """Call Gemini API with the given prompt"""
    full_prompt = f"{SYSTEM_PROMPT}\n\n{prompt}"
    
    response = model.generate_content(
        full_prompt,
        generation_config=genai.types.GenerationConfig(
            max_output_tokens=max_tokens,
            temperature=0.9,
        )
    )
    
    text = response.text.strip()
    # Strip markdown code fences if present
    text = re.sub(r'^```json\s*', '', text)
    text = re.sub(r'\s*```$', '', text)
    return text


def safe_json(text):
    """Safely parse JSON from response"""
    try:
        return json.loads(text)
    except Exception:
        match = re.search(r'\{.*\}', text, re.DOTALL)
        if match:
            return json.loads(match.group())
        raise ValueError("Could not parse JSON from response")


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/api/start', methods=['POST'])
def start_game():
    prompt = """Generate a virus outbreak scenario for the game. 
Choose one real virus as inspiration from this list: Ebola, COVID-19, Influenza H1N1, Smallpox, SARS-CoV-1, Zika, Marburg, Nipah, Rabies, or Dengue Fever.
Create a FICTIONAL virus name (dramatic, scientific-sounding, NOT the real name).

Return this exact JSON:
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
}"""

    result = call_gemini(prompt)
    data = safe_json(result)
    return jsonify({"success": True, "data": data})


@app.route('/api/question', methods=['POST'])
def get_question():
    body = request.json
    virus_data = body.get('virus_data', {})
    day = body.get('day', 1)
    question_num = body.get('question_num', 1)
    history = body.get('history', [])

    day_themes = {
        1: "Initial detection, field assessment, and rapid diagnostic testing",
        2: "Quarantine zones, contact tracing, and containment perimeters",
        3: "Medical treatment protocols, hospital capacity, and triage",
        4: "Public health communication, media briefings, and panic management",
        5: "Resource allocation, international aid, and supply chain for PPE/medication",
        6: "Managing complications — mutations, secondary infections, staff burnout",
        7: "Final containment push — decisive measures to end the outbreak"
    }

    recent_history = ""
    if history:
        recent = history[-3:]
        recent_history = "Recent decisions: " + "; ".join(
            [f"Day {h['day']} Q{h['q']}: {h['choice_text'][:60]}" for h in recent]
        )

    prompt = f"""Generate question {question_num} of 5 for Day {day} of the outbreak.

VIRUS: {virus_data.get('virus_name', 'Unknown')} (inspired by {virus_data.get('real_virus', 'Unknown')})
LOCATION: {virus_data.get('location', 'Unknown')}
TRANSMISSION: {virus_data.get('transmission', 'Unknown')}
DAY {day} THEME: {day_themes.get(day, 'General response')}
{recent_history}

IMPORTANT: Randomize which choice (A, B, C, or D) is the best answer. Do NOT always put the best answer as A.

Return this exact JSON:
{{
  "scenario": "2-3 sentence situation description — specific, gripping, science-grounded",
  "question": "The specific decision question posed to the scientist",
  "choices": [
    {{"id": "A", "text": "Choice A — full sentence describing the action"}},
    {{"id": "B", "text": "Choice B — full sentence describing the action"}},
    {{"id": "C", "text": "Choice C — full sentence describing the action"}},
    {{"id": "D", "text": "Choice D — full sentence describing the action"}}
  ],
  "correct": "single letter A B C or D — the scientifically best choice",
  "choice_ratings": {{
    "A": "excellent|good|poor|terrible",
    "B": "excellent|good|poor|terrible",
    "C": "excellent|good|poor|terrible",
    "D": "excellent|good|poor|terrible"
  }},
  "educational_note": "One real biology/epidemiology fact connected to this question"
}}"""

    result = call_gemini(prompt)
    data = safe_json(result)
    return jsonify({"success": True, "data": data})


@app.route('/api/feedback', methods=['POST'])
def get_feedback():
    body = request.json
    choice_id = body.get('choice')
    question_data = body.get('question_data', {})

    choices = question_data.get('choices', [])
    chosen = next((c for c in choices if c['id'] == choice_id), None)
    correct_id = question_data.get('correct', 'A')
    correct = next((c for c in choices if c['id'] == correct_id), None)
    rating = question_data.get('choice_ratings', {}).get(choice_id, 'poor')

    score_map = {"excellent": 15, "good": 8, "poor": -8, "terrible": -15}
    base_score = score_map.get(rating, 0)

    prompt = f"""The player chose this option for the question "{question_data.get('question', '')}":

CHOSEN ({choice_id}): {chosen['text'] if chosen else 'unknown'}
RATING: {rating}
BEST CHOICE ({correct_id}): {correct['text'] if correct else 'unknown'}
EDUCATIONAL NOTE: {question_data.get('educational_note', '')}

Return this exact JSON:
{{
  "result": "{'EXCELLENT' if rating == 'excellent' else 'GOOD' if rating == 'good' else 'POOR' if rating == 'poor' else 'CRITICAL ERROR'}",
  "score_change": {base_score},
  "feedback": "2-3 sentences: explain WHY this choice was {rating}, with real biology education woven in naturally",
  "containment_effect": "One sentence about the real-world impact this decision had on the outbreak"
}}"""

    result = call_gemini(prompt, max_tokens=600)
    data = safe_json(result)
    # Enforce score from server side
    data['score_change'] = base_score
    data['result'] = rating.upper() if rating != 'excellent' else 'EXCELLENT'
    return jsonify({"success": True, "data": data})


@app.route('/api/end', methods=['POST'])
def end_game():
    body = request.json
    virus_data = body.get('virus_data', {})
    total_score = body.get('total_score', 50)
    history = body.get('history', [])

    outcome = "CONTAINED" if total_score >= 60 else "OUTBREAK FAILED"
    
    history_summary = " | ".join([
        f"Day{h['day']}Q{h['q']}:{h['choice']}({h.get('rating','?')})"
        for h in history
    ])

    prompt = f"""The 7-day virus response simulation is complete.

VIRUS: {virus_data.get('virus_name')} (inspired by {virus_data.get('real_virus')})
FINAL SCORE: {total_score}/100
OUTCOME: {outcome}
DECISION LOG: {history_summary}

Return this exact JSON:
{{
  "outcome": "{outcome}",
  "headline": "Dramatic one-sentence news headline about the outcome",
  "evaluation": "3-4 sentences evaluating the player's overall strategy and performance",
  "key_mistakes": ["specific mistake 1 if score < 80, else empty string", "specific mistake 2 if score < 70, else empty string"],
  "key_successes": ["specific success 1", "specific success 2"],
  "real_world_virus_info": {{
    "name": "{virus_data.get('real_virus')}",
    "overview": "2-3 sentences about the real virus — biology, how it works, structure",
    "historical_outbreaks": "2 sentences about notable real-world outbreak(s)",
    "real_containment": "2 sentences on how this virus is actually contained in real life",
    "vaccines_treatments": "1-2 sentences on real vaccines or treatments available",
    "interesting_fact": "One fascinating, surprising biology fact about this specific virus"
  }}
}}"""

    result = call_gemini(prompt, max_tokens=1500)
    data = safe_json(result)
    return jsonify({"success": True, "data": data})


if __name__ == '__main__':
    app.run(debug=True, port=5000)
