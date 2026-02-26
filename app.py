from flask import Flask, render_template, request, jsonify
import google.generativeai as genai
import json
import re
import os

app = Flask(__name__)

# Configure Gemini - PUT YOUR API KEY HERE
genai.configure(api_key=os.environ.get("AIzaSyCdivLcF1GkvUW0lGPczZ68Qp94h3JmBOg"))

# Automatically find an available model
available_models = [m.name for m in genai.list_models() if 'generateContent' in m.supported_generation_methods]
if not available_models:
    raise Exception("No models available! Check your API key.")

model_name = available_models[0]
print(f"✅ Using model: {model_name}")
model = genai.GenerativeModel(model_name)

SYSTEM_PROMPT = """You are the AI director for OUTBREAK RESPONSE, a biology education simulation game for students.
You generate scientifically accurate, engaging content about virology and epidemiology.
Always respond with valid JSON only — no markdown, no code fences, no extra text outside the JSON."""


# ═══════════════════════════════════════════════════════
# HELPER FUNCTIONS (MUST BE DEFINED BEFORE USE!)
# ═══════════════════════════════════════════════════════

def repair_json(text):
    """Attempt to repair common JSON issues"""
    start = text.find('{')
    end = text.rfind('}')
    if start != -1 and end != -1:
        text = text[start:end+1]
    
    # Replace smart quotes
    text = text.replace('"', '"').replace('"', '"')
    
    # Remove actual line breaks inside JSON strings
    def fix_string(match):
        return match.group(0).replace('\n', ' ').replace('\r', ' ')
    text = re.sub(r'"[^"]*"', fix_string, text)
    
    # Remove trailing commas
    text = re.sub(r',\s*([}\]])', r'\1', text)
    
    return text


def safe_json(text):
    """Safely parse JSON with multiple repair attempts"""
    attempts = [
        ("Direct", lambda t: t),
        ("Strip markdown", lambda t: re.sub(r'```(?:json)?\s*|\s*```', '', t)),
        ("Repair", repair_json),
        ("Extract + repair", lambda t: repair_json(t[t.find('{'):t.rfind('}')+1]))
    ]
    
    for name, transform in attempts:
        try:
            cleaned = transform(text)
            return json.loads(cleaned)
        except (json.JSONDecodeError, ValueError, AttributeError) as e:
            print(f"⚠️ {name} parse failed: {e}")
            continue
    
    print(f"❌ JSON parsing failed! Response:\n{text[:500]}")
    raise ValueError(f"Could not parse JSON: {text[:200]}")


def call_gemini(prompt, max_tokens=1000):
    """Call Gemini API with the given prompt"""
    full_prompt = f"{SYSTEM_PROMPT}\n\n{prompt}\n\nReturn ONLY valid JSON with no extra text."
    
    try:
        response = model.generate_content(
            full_prompt,
            generation_config=genai.types.GenerationConfig(
                max_output_tokens=max_tokens,
                temperature=0.8,
            )
        )
        
        # Check if response was blocked
        if not response.text:
            print("⚠️ Empty response from Gemini")
            raise ValueError("Empty response from API")
        
        text = response.text.strip()
        print(f"🤖 AI Response length: {len(text)} chars")
        
        # Check if response seems truncated
        if not text.endswith('}'):
            print(f"⚠️ Response appears truncated (doesn't end with }})")
            last_brace = text.rfind('}')
            if last_brace > 0:
                text = text[:last_brace+1]
        
        # Strip markdown
        text = re.sub(r'^```json\s*', '', text)
        text = re.sub(r'^```\s*', '', text)
        text = re.sub(r'\s*```$', '', text)
        
        return text
        
    except Exception as e:
        print(f"❌ Gemini API Error: {e}")
        raise


# ═══════════════════════════════════════════════════════
# FLASK ROUTES
# ═══════════════════════════════════════════════════════

@app.route('/')
def index():
    return render_template('index.html')


@app.route('/api/start', methods=['POST'])
def start_game():
    prompt = """Generate a virus outbreak scenario for the game. 
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
}"""

    try:
        result = call_gemini(prompt)
        data = safe_json(result)
        return jsonify({"success": True, "data": data})
    except Exception as e:
        print(f"❌ Error in start_game: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/api/question', methods=['POST'])
def get_question():
    body = request.json
    virus_data = body.get('virus_data', {})
    day = body.get('day', 1)
    question_num = body.get('question_num', 1)
    history = body.get('history', [])

    # Different themes for each day
    day_themes = {
        1: "Initial outbreak detection, field epidemiology, and rapid diagnostic testing",
        2: "Quarantine strategies, contact tracing networks, and isolation protocols",
        3: "Clinical treatment approaches, hospital capacity planning, and triage systems",
        4: "Public health communication, media management, and community education",
        5: "Resource mobilization, international cooperation, and supply chain logistics",
        6: "Addressing complications: mutations, secondary infections, and system strain",
        7: "Final containment measures, surveillance planning, and outbreak resolution"
    }

    # Build context from recent decisions
    recent_context = ""
    if history:
        recent = history[-2:]
        recent_context = "\nRecent decisions: " + "; ".join([
            f"Day {h['day']} Q{h['q']}: chose option {h['choice']}" for h in recent
        ])

    theme = day_themes.get(day, "outbreak response")

    prompt = f"""Generate question {question_num} of 5 for Day {day} of the 7-day outbreak simulation.

OUTBREAK CONTEXT:
- Virus: {virus_data.get('virus_name', 'Unknown')}
- Based on: {virus_data.get('real_virus', 'Unknown')}
- Transmission: {virus_data.get('transmission', 'Unknown')}
- Location: {virus_data.get('location', 'Unknown')}
- Day {day} Theme: {theme}
{recent_context}

INSTRUCTIONS:
1. Create a scenario (2 sentences) that describes a specific crisis related to {theme}
2. Make the question tactical and specific to this situation
3. Provide 4 distinct choices (A, B, C, D) - each should be a complete strategy
4. VARY which choice is correct - don't always pick A or B
5. Rate each choice: "excellent" (best), "good" (acceptable), "poor" (flawed), or "terrible" (dangerous)
6. Include one real epidemiology/virology fact as educational note

Return ONLY this JSON:
{{
  "scenario": "2 sentences describing the specific crisis situation for {theme}",
  "question": "What is your decision in response to this situation?",
  "choices": [
    {{"id": "A", "text": "Complete detailed strategy option A"}},
    {{"id": "B", "text": "Complete detailed strategy option B"}},
    {{"id": "C", "text": "Complete detailed strategy option C"}},
    {{"id": "D", "text": "Complete detailed strategy option D"}}
  ],
  "correct": "A or B or C or D (the scientifically best choice)",
  "choice_ratings": {{
    "A": "excellent or good or poor or terrible",
    "B": "excellent or good or poor or terrible",
    "C": "excellent or good or poor or terrible",
    "D": "excellent or good or poor or terrible"
  }},
  "educational_note": "Real scientific fact about virology or epidemiology related to {theme}"
}}"""

    try:
        result = call_gemini(prompt, max_tokens=2500)
        
        # Handle truncation
        if not result.strip().endswith('}'):
            print("⚠️ Response truncated, attempting repair...")
            result = result.strip()
            if result.count('{') > result.count('}'):
                missing = result.count('{') - result.count('}')
                result += '}' * missing
        
        data = safe_json(result)
        
        # Validate required fields
        required = ['scenario', 'question', 'choices', 'correct', 'choice_ratings']
        for field in required:
            if field not in data:
                raise ValueError(f"Missing field: {field}")
        
        # Add educational note if missing
        if 'educational_note' not in data:
            data['educational_note'] = f"Scientific decision-making is critical in {theme}."
        
        return jsonify({"success": True, "data": data})
        
    except Exception as e:
        print(f"❌ Error in get_question: {e}")
        
        # Emergency fallback
        fallback = {
            "scenario": f"Day {day}: A critical situation has emerged related to {theme}. Your team needs immediate direction on how to proceed.",
            "question": "What action should you take?",
            "choices": [
                {"id": "A", "text": "Implement aggressive containment measures immediately"},
                {"id": "B", "text": "Gather more epidemiological data before acting"},
                {"id": "C", "text": "Follow established public health protocols"},
                {"id": "D", "text": "Coordinate with international health organizations"}
            ],
            "correct": "C",
            "choice_ratings": {"A": "good", "B": "good", "C": "excellent", "D": "good"},
            "educational_note": f"Evidence-based protocols are essential in {theme}."
        }
        return jsonify({"success": True, "data": fallback})


@app.route('/api/feedback', methods=['POST'])
def get_feedback():
    body = request.json
    choice_id = body.get('choice')
    question_data = body.get('question_data', {})

    # Get the rating for the chosen answer
    rating = question_data.get('choice_ratings', {}).get(choice_id, 'poor')
    
    # Calculate score change
    score_map = {"excellent": 15, "good": 8, "poor": -8, "terrible": -15}
    base_score = score_map.get(rating, 0)

    print(f"🎯 Choice {choice_id} rated as '{rating}' → score change: {base_score}")

    # Get choices for context
    choices = question_data.get('choices', [])
    chosen = next((c for c in choices if c['id'] == choice_id), None)
    correct_id = question_data.get('correct', 'A')
    
    # Generate AI feedback
    prompt = f"""The player chose option {choice_id} which was rated as "{rating}".

Question: {question_data.get('question', '')}
Their choice: {chosen['text'] if chosen else 'unknown'}
Best answer was: {correct_id}

Generate feedback explaining why this choice was {rating}.

Return ONLY this JSON:
{{
  "result": "{rating.upper()}",
  "score_change": {base_score},
  "feedback": "2-3 sentences explaining WHY this choice was {rating} from an epidemiological perspective",
  "containment_effect": "One sentence about how this decision affected the outbreak trajectory"
}}"""

    try:
        result = call_gemini(prompt, max_tokens=800)
        data = safe_json(result)
        
        # CRITICAL: Ensure score_change is correctly set
        data['score_change'] = base_score
        data['result'] = rating.upper()
        
        print(f"✅ Returning feedback with score_change: {data['score_change']}")
        
        return jsonify({"success": True, "data": data})
        
    except Exception as e:
        print(f"❌ Error in get_feedback: {e}")
        
        # Fallback response
        feedback_text = {
            "excellent": "Outstanding decision! This follows evidence-based epidemiological protocols.",
            "good": "Solid choice that aligns with public health best practices.",
            "poor": "This decision has significant drawbacks that may hinder containment.",
            "terrible": "Critical error! This contradicts fundamental outbreak response principles."
        }
        
        effect_text = {
            "excellent": "Your swift action significantly slowed viral transmission.",
            "good": "Your decision contributed to gradual containment improvement.",
            "poor": "Your choice created setbacks in the response strategy.",
            "terrible": "Your decision enabled rapid viral spread."
        }
        
        fallback = {
            "result": rating.upper(),
            "score_change": base_score,
            "feedback": feedback_text.get(rating, "Decision recorded."),
            "containment_effect": effect_text.get(rating, "The outbreak continues.")
        }
        
        print(f"✅ Using fallback with score_change: {fallback['score_change']}")
        
        return jsonify({"success": True, "data": fallback})


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

Return ONLY this JSON:
{{
  "outcome": "{outcome}",
  "headline": "Dramatic one-sentence news headline about the {outcome.lower()}",
  "evaluation": "3-4 sentences evaluating the player's overall strategy and performance",
  "key_mistakes": ["specific mistake 1 if score < 80", "specific mistake 2 if score < 70"],
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

    try:
        result = call_gemini(prompt, max_tokens=2000)
        data = safe_json(result)
        return jsonify({"success": True, "data": data})
    except Exception as e:
        print(f"❌ Error in end_game: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


if __name__ == '__main__':
    app.run(debug=True, port=5000)