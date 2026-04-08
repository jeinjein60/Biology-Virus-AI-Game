# ☣ Biology Virus Outbreak Simulator

### Biology Education Simulation Game — Viral Containment

An AI-powered browser game where students play as a scientist racing to contain a randomly generated virus outbreak over 7 days.

---

## 🎮 How to Play

- You are a scientist given **7 days** to contain a viral outbreak
- Each day has **2 questions** with **4 answer choices**
- Every decision is based on real epidemiology and virology
- Your **Containment Score** (0-100) tracks your progress
- Score **≥ 60** = Outbreak Contained! | Score **< 60** = Pandemic Spreads
- The AI explains the **real-world virus** the scenario was inspired by at the end

---

## 🚀 Setup Instructions

### 1. Prerequisites

- **Node.js** 18+ — [nodejs.org](https://nodejs.org)
- A paid **OpenAI API Key** — [platform.openai.com](https://platform.openai.com)

### 2. Clone the Repository

```bash
git clone <your-repo-url>
cd Biology-Virus-AI-Game
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Set Your API Key

Create a `.env` file in the project root:

```env
OPENAI_API_KEY=your-key-here
```

> **Never commit your `.env` file.** It is already listed in `.gitignore`.

### 5. Run the Game

```bash
npm run dev
```

Open your browser to: **http://localhost:5173**

### Other Useful Commands

| Command | Description |
| --- | --- |
| `npm run dev` | Start local dev server |
| `npm run build` | Build for production (outputs to `dist/`) |
| `npm run preview` | Preview the production build locally |

---

## 📁 File Structure

```
Biology-Virus-AI-Game/
├── index.html          # Main game UI — all screens and modals are defined here
├── vite.config.js      # Vite build config (sets base path from game.json)
├── package.json        # Project metadata and npm scripts
├── .env                # Your OpenAI API key (never commit this)
├── .gitignore
│
├── public/
│   ├── script.js       # Core game logic: state, screen navigation, scoring
│   ├── ai.js           # OpenAI integration: prompt building, JSON parsing
│   ├── bg.png          # Background image
│   ├── game-main-box.png
│   ├── info-panel.png
│   ├── redV.png        # Virus icon
│   └── rotateIcon.png  # Rotate-device prompt icon
│
└── data/
    ├── game.json       # Game metadata: id, title, tags, description
    └── thumbnail.png   # Preview image for the game catalog
```

---

## 🧬 Educational Features

- **14 AI-generated questions** per game (2 questions × 7 days)
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

---

## ⚙️ Customization Tips

**Change the AI model** — open `public/ai.js` and update the `AI_MODEL` constant:

```js
const AI_MODEL = 'gpt-4o';  // upgrade for better responses, or 'gpt-4o-mini' for cheaper
```

**Add or remove viruses** — the virus pool is defined in the system prompt inside `public/ai.js`.
Search for `SYSTEM_PROMPT` and edit the list of possible pathogens.

**Edit daily themes** — each of the 7 days has a topic focus. Change them in `public/ai.js`:

```js
const DAY_THEMES = {
  1: "Initial outbreak detection and rapid diagnostic testing",
  2: "Quarantine strategies and isolation protocols",
  // ... edit any day's theme here
};
```

**Adjust questions per day or total days** — look for the day/question loop logic in `public/script.js`.

**Restyle the UI** — all visuals and layout are inline in `index.html`.
The game uses the Google Fonts **Orbitron** and **Share Tech Mono** for its cyberpunk look.

**Change the win threshold** — the default passing score is 60. Search for `60` in `public/script.js` to find and update the cutoff.

---

Enjoy your biology game! 🦠🧬