# ☣ OUTBREAK RESPONSE
### Biology Education Simulation Game — Viral Containment

A Flask + AI-powered browser game where students play as a scientist racing to contain a randomly generated virus outbreak over 7 days.

**NOW USING GOOGLE GEMINI API — 100% FREE!** ✨

---

## 🎮 How to Play
- You are a scientist given **7 days** to contain a viral outbreak
- Each day has **5 questions** with **4 answer choices**
- Every decision is based on real epidemiology and virology
- Your **Containment Score** (0-100) tracks your progress
- Score **≥ 60** = Outbreak Contained! | Score **< 60** = Pandemic Spreads
- The AI explains the **real-world virus** the scenario was inspired by at the end

---

## 🚀 Setup Instructions

### 1. Prerequisites
- Python 3.9+
- A **Google Gemini API key** (100% FREE — see below)

### 2. Get Your FREE Google Gemini API Key
1. Go to **https://aistudio.google.com/app/apikey**
2. Sign in with your Google account
3. Click **"Create API Key"**
4. Copy your key (starts with `AIza...`)

**Free Tier:** 15 requests/minute, 1500 requests/day — perfect for a classroom!

### 3. Install Dependencies
```bash
pip install -r requirements.txt
```

### 4. Set Your API Key
**macOS / Linux:**
```bash
export GEMINI_API_KEY="AIza-your-key-here"
```

**Windows (Command Prompt):**
```cmd
set GEMINI_API_KEY=AIza-your-key-here
```

**Windows (PowerShell):**
```powershell
$env:GEMINI_API_KEY="AIza-your-key-here"
```

### 5. Run the Game
```bash
python app.py
```

Open your browser to: **http://localhost:5000**

---

## 📁 File Structure
```
outbreak_game/
├── app.py                  ← Flask backend + Gemini AI logic
├── requirements.txt        ← Python dependencies
├── README.md               ← This file
└── templates/
    └── index.html          ← Full game frontend (HTML/CSS/JS)
```

---

## 🧬 Educational Features
- **35 AI-generated questions** per game (5 questions × 7 days)
- Questions cover: detection, quarantine, treatment, communication, resource allocation
- Every question includes a **real biology fact**
- Final screen includes a full **Real-World Virus Profile** on the inspiring pathogen
- Possible viruses: Ebola, COVID-19, Influenza H1N1, Smallpox, SARS, Zika, Marburg, Nipah, Rabies, Dengue

---

## 🎓 Classroom Use
- Works best on desktop/laptop for the full command-center layout
- Each game generates a **unique randomized virus** — no two games are alike
- Students can play multiple times to explore different viruses
- The real-world science section at the end makes a great discussion starter
- **FREE API** means you can run this for your whole class without any cost!

---

## ⚙️ Customization Tips
- To change the **win threshold**, edit line with `total_score >= 60` in `app.py`
- To adjust **questions per day**, edit the `question_num` logic in `app.py`
- To change the **available viruses**, edit the list in the `/api/start` prompt in `app.py`
- To **style the game** differently, edit the `<style>` section in `templates/index.html`

---

## 🆓 Why Google Gemini?
- **Completely free** with generous rate limits
- **Fast responses** — game loads quickly
- **Smart AI** — generates scientifically accurate content
- **No credit card required** to get started

Enjoy your biology game! 🦠🧬
