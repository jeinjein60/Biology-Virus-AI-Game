from flask import Flask, render_template, request, jsonify
import google.generativeai as genai
import json
import re
import os

app = Flask(__name__)

# Configure Gemini
genai.configure(api_key=os.environ.get("AIzaSyCdivLcF1GkvUW0lGPczZ68Qp94h3JmBOg"))

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
    full_prompt = f"{SYSTEM_PROMPT}\n\n{prompt}\n\nReturn ONLY valid JSON with no extra text."
    
    try:
        response = model.generate_content(
            full_prompt,
            generation_config=genai.types.GenerationConfig(
                max_output_tokens=max_tokens,
                temperature=0.7,
            )
        )
        
        # Check if response was blocked
        if not response.text:
            print("⚠️ Empty response from Gemini")
            raise ValueError("Empty response from API")
        
        text = response.text.strip()
        print(f"🤖 AI Response length: {len(text)} chars")
        
        # Check if response seems truncated
        if not text.endswith('}') and not text.endswith('}'):
            print(f"⚠️ Response appears truncated (doesn't end with }})")
            # Try to salvage it
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


@app.route('/api/question', methods=['POST'])
def get_question():
    body = request.json
    virus_data = body.get('virus_data', {})
    day = body.get('day', 1)
    question_num = body.get('question_num', 1)
    history = body.get('history', [])

    # More detailed themes for each question of each day
    day_question_themes = {
        1: {
            1: "Initial case identification and diagnostic testing",
            2: "Sample collection protocols and lab procedures",
            3: "Establishing baseline epidemiological data",
            4: "First responder safety and PPE deployment",
            5: "Communication with local health authorities"
        },
        2: {
            1: "Identifying index case and patient zero",
            2: "Contact tracing methodology selection",
            3: "Quarantine zone boundary determination",
            4: "Monitoring asymptomatic carriers",
            5: "Managing quarantine compliance and enforcement"
        },
        3: {
            1: "Triage protocols for infected patients",
            2: "Supportive care vs experimental treatments",
            3: "Managing hospital surge capacity",
            4: "Staff infection prevention measures",
            5: "Allocating limited medical resources"
        },
        4: {
            1: "Crafting public health messaging strategy",
            2: "Managing misinformation and rumors",
            3: "Coordinating with media outlets",
            4: "Community education about symptoms",
            5: "Addressing public panic and fear"
        },
        5: {
            1: "Requesting international medical aid",
            2: "PPE supply chain management",
            3: "Vaccine development acceleration",
            4: "Funding allocation priorities",
            5: "Medical personnel deployment strategy"
        },
        6: {
            1: "Detecting potential viral mutations",
            2: "Managing secondary bacterial infections",
            3: "Healthcare worker burnout prevention",
            4: "Long-term patient care planning",
            5: "Supply shortage contingency plans"
        },
        7: {
            1: "Final containment verification protocols",
            2: "Post-outbreak surveillance planning",
            3: "Declaring outbreak contained or escalating",
            4: "Evaluating response effectiveness",
            5: "Preparing for potential resurgence"
        }
    }

    # Get specific theme for this question
    theme = day_question_themes.get(day, {}).get(question_num, "outbreak response")

    # Build context from recent decisions
    recent_context = ""
    if history:
        recent = history[-2:]  # Last 2 decisions
        recent_context = "Recent player decisions: " + " | ".join([
            f"Day{h['day']}-Q{h['q']}: chose {h['choice']}" for h in recent
        ])

    # Add unique seed based on day and question to force variation
    unique_seed = f"SEED_{day}_{question_num}"

    prompt = f"""Generate question {question_num} of 5 for Day {day} of 7.

CONTEXT:
- Virus: {virus_data.get('virus_name', 'Unknown')}
- Real virus basis: {virus_data.get('real_virus', 'Unknown')}
- Transmission: {virus_data.get('transmission', 'Unknown')}
- Location: {virus_data.get('location', 'Unknown')}
- SPECIFIC THEME: {theme}
- Unique identifier: {unique_seed}
{recent_context}

CRITICAL REQUIREMENTS:
1. This question MUST be about: {theme}
2. Make it DIFFERENT from previous questions
3. Question {question_num} should build on earlier choices
4. Use SHORT sentences (max 15 words each)
5. Vary which answer (A/B/C/D) is correct - DO NOT always make A or B the best
6. Keep realistic to the specific theme above

Return ONLY this JSON:
{{
  "scenario": "Two sentences about {theme}",
  "question": "Specific question about {theme}",
  "choices": [
    {{"id": "A", "text": "First option related to {theme}"}},
    {{"id": "B", "text": "Second option related to {theme}"}},
    {{"id": "C", "text": "Third option related to {theme}"}},
    {{"id": "D", "text": "Fourth option related to {theme}"}}
  ],
  "correct": "Randomly pick A B C or D",
  "choice_ratings": {{"A": "rate each", "B": "rate each", "C": "rate each", "D": "rate each"}},
  "educational_note": "One fact about {theme}"
}}"""

    try:
        result = call_gemini(prompt, max_tokens=2500)
        
        if not result.strip().endswith('}'):
            print("⚠️ Response truncated, attempting repair...")
            result = result.strip()
            if result.count('{') > result.count('}'):
                missing = result.count('{') - result.count('}')
                result += '}' * missing
        
        data = safe_json(result)
        
        # Validate
        required = ['scenario', 'question', 'choices', 'correct', 'choice_ratings']
        for field in required:
            if field not in data:
                raise ValueError(f"Missing field: {field}")
        
        if 'educational_note' not in data:
            data['educational_note'] = f"This decision relates to {theme}."
        
        return jsonify({"success": True, "data": data})
        
    except Exception as e:
        print(f"❌ Error in get_question: {e}")
        
        # Fallback with themed question
        fallback_question = {
            "scenario": f"Day {day}, Question {question_num}: {theme}. A critical decision is needed.",
            "question": f"How do you address this situation regarding {theme}?",
            "choices": [
                {"id": "A", "text": "Implement immediate aggressive measures"},
                {"id": "B", "text": "Gather more data before deciding"},
                {"id": "C", "text": "Follow standard protocol guidelines"},
                {"id": "D", "text": "Consult with international experts"}
            ],
            "correct": "C",
            "choice_ratings": {"A": "poor", "B": "good", "C": "excellent", "D": "good"},
            "educational_note": f"Effective response to {theme} requires evidence-based decisions."
        }
        return jsonify({"success": True, "data": fallback_question})

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



@app.route('/api/feedback', methods=['POST'])
def get_feedback():
    body = request.json
    choice_id = body.get('choice')
    question_data = body.get('question_data', {})
    rating = question_data.get('choice_ratings', {}).get(choice_id, 'poor')

    score_map = {"excellent": 15, "good": 8, "poor": -8, "terrible": -15}
    base_score = score_map.get(rating, 0)

    # Pre-written feedback (no AI needed!)
    feedback_templates = {
        "excellent": "This was an excellent decision that follows best practices in epidemiology and outbreak response.",
        "good": "This was a solid choice that aligns with standard public health protocols.",
        "poor": "This choice had some flaws and may not be optimal for containing the outbreak effectively.",
        "terrible": "This was a problematic decision that could worsen the outbreak situation significantly."
    }
    
    effect_templates = {
        "excellent": "Your swift and scientifically-sound action helped slow viral transmission.",
        "good": "Your decision contributed positively to containment efforts.",
        "poor": "Your decision created some setbacks in the containment strategy.",
        "terrible": "Your choice allowed the virus to spread more rapidly."
    }

    data = {
        "result": rating.upper(),
        "score_change": base_score,
        "feedback": feedback_templates.get(rating, "Decision recorded."),
        "containment_effect": effect_templates.get(rating, "The outbreak continues.")
    }
    
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
