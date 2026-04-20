### Web Assistant Bridge – Game Integration Guide

This guide explains how individual game repos plug into the web assistant using the shared `stem-assistant-bridge` package.

---

### Why this bridge (vs. the old way)

**Old approach**

- Each game wrote its own `window.parent.postMessage(...)` code.
- Payload shapes, field names, and required properties could drift between games.
- Any change to the assistant protocol meant updating N separate implementations.
- Easy to:
  - mistype `eventType` or `gameId`,
  - forget required fields like `hintCount` or `targetConcept`,
  - send events even when not embedded in the portal.

**New bridge**

- A single, shared library owns:
  - the `GameEvent` TypeScript type,
  - the `ASSISTANT_GAME_EVENT` protocol,
  - and all the `postMessage` details.
- Games:
  - call `initStemAssistantBridge({ gameId })` once at startup,
  - call a few helpers (`stemAssistant.correct`, `incorrect`, `levelStart`, `hintRequest`, etc.) at existing logic points.
- Benefits:
  - **Convenience**: game authors never touch `postMessage` or remember magic field names.
  - **Safety**: the bridge enforces a consistent event shape and fills reasonable defaults.
  - **Scalability**: protocol changes happen in one place; games just bump the dependency.
  - **Onboarding**: new games can follow a short recipe instead of reverse‑engineering another repo’s custom bridge.

If you used to write custom bridges per game, you can now delete that code and replace it with a thin adapter that calls `stem-assistant-bridge` from your existing grading/progression hooks.

---

### What the bridge does

- Games run inside an **iframe** on the portal (`/games/<game-id>`).
- The assistant UI lives in the **portal shell**, not inside your game.
- To let tutors react to real gameplay (wrong answer, correct, level complete, hint, etc.), the game sends **standardized events** up to the parent page.
- You **do not** write `postMessage` yourself; you use the shared bridge.

At a high level, your game:

1. **Initializes** the bridge once at startup with its `gameId`.
2. Calls **small helpers** like “incorrect submission” or “level complete” where it already knows what happened.
3. The bridge sends a `ASSISTANT_GAME_EVENT` message to the parent page.
4. The portal forwards that to the assistant API, and the tutors respond.

---

### 1. Add the bridge dependency

In your game repo’s `package.json`:

```jsonc
{
  "dependencies": {
    // ...
    "stem-assistant-bridge": "file:../../packages/stem-assistant-bridge"
  }
}
```

When this package is published, we’ll replace the `file:` path with a version like `"^0.1.0"`.

Then run:

```bash
npm install
```

---

### 2. Initialize the bridge once at startup

In your main entry file (for example `src/main.tsx`, `src/index.tsx`, `src/main.jsx`, or `js/app.js`):

```ts
import { render } from "preact"; // or React / your framework
import { initStemAssistantBridge } from "stem-assistant-bridge";
import { App } from "./App";

initStemAssistantBridge({
  // MUST match `game-id` in data/game.json and the portal slug (/games/<game-id>)
  gameId: "your-game-id",
  // Optional but recommended – concise label for the main concept/topic
  defaultTargetConcept: "your_topic_slug" // e.g. "python_programming"
});

render(<App />, document.getElementById("app"));
```

This is enough for the portal to know which game is in the iframe and for free‑form chat to be scoped to your title.

---

### 3. Send events from key gameplay points

Import the helpers where you handle grading / progression:

```ts
import {
  sendStemAssistantEvent,
  setStemAssistantLevel,
  setStemAssistantHintCount,
  stemAssistant
} from "stem-assistant-bridge";
```

#### 3.1 Level / problem start

Call this when a new level, exercise, or problem becomes active:

```ts
setStemAssistantLevel(`level-${levelId}`, "your_topic_slug");

stemAssistant.levelStart({
  levelId: `level-${levelId}`,
  targetConcept: "your_topic_slug"
});
```

#### 3.2 Incorrect submission

Where you already know the player’s answer is wrong:

```ts
stemAssistant.incorrect({
  levelId: `level-${levelId}`,
  targetConcept: "your_topic_slug",
  playerAnswer: playerAnswerAsString,
  correctAnswer: correctAnswerAsString,         // if you have it
  mistakeCategory: "off_by_one"                 // optional, free‑form slug
});
```

#### 3.3 Correct submission

When the player gets the problem right:

```ts
stemAssistant.correct({
  levelId: `level-${levelId}`,
  targetConcept: "your_topic_slug",
  playerAnswer: playerAnswerAsString
});
```

#### 3.4 Level complete

When you transition to a win/summary state for a level:

```ts
stemAssistant.levelComplete({
  levelId: `level-${levelId}`,
  targetConcept: "your_topic_slug"
});
```

#### 3.5 Hint request

If your UI has a “Hint” or “Show solution idea” button:

```ts
stemAssistant.hintRequest({
  levelId: `level-${levelId}`,
  targetConcept: "your_topic_slug"
});
```

The helper automatically tracks and includes `hintCount`.

---

### 4. Event types in use

The bridge understands the following `eventType` values (you generally use helpers instead of strings):

- `level_start`
- `incorrect_submission`
- `correct_submission`
- `level_complete`
- `hint_request`
- `timeout`
- `recap_request`

The portal’s `GameIframeBridge` listens for:

```js
{ type: "ASSISTANT_GAME_EVENT", payload: { ...GameEvent } }
```

and forwards that into the assistant system.

---

### 5. How this flows through the portal

1. **Game iframe** calls a bridge helper → `sendStemAssistantEvent({...})`.
2. Bridge sends `postMessage` to `window.parent` with `{ type: "ASSISTANT_GAME_EVENT", payload }`.
3. Portal’s `GameIframeBridge` receives the message, verifies origin and `gameId`, and calls `sendGameEvent`.
4. `/api/assistant` builds prompts using:
   - the event fields (`gameId`, `levelId`, `eventType`, `targetConcept`, etc.)
   - the per‑game profile from `gameIntegration.ts`
   - recent conversation.
5. Tutors respond with context‑aware dialogue.

---

### 6. Build and staging into the portal

The portal script:

```bash
npm run setup-games
```

does the following:

1. Clones or updates each game repo from `games.config.mjs` into `.game-sources/`.
2. Runs `npm ci` and `npm run build` in each cached repo.
3. Copies `dist/` into `public/staticGames/<game-id>/`.
4. Copies `data/thumbnail.png` into `public/gameThumbnails/<game-id>.png`.
5. Regenerates `src/data/games.ts` from each repo’s `data/game.json`.

For your bridge changes to show up in the portal:

1. Commit and push to your game repo.
2. In the portal project, run:

   ```bash
   npm run setup-games -- --force
   ```

3. Start the portal (`npm run dev`) and visit `/games/<game-id>`.

---

### 7. Debugging / sanity‑checking

On the **portal page** (NOT inside the iframe), open DevTools Console and paste:

```js
window.addEventListener("message", (e) => {
  if (e?.data?.type === "ASSISTANT_GAME_EVENT") {
    console.log("ASSISTANT_GAME_EVENT", e.data.payload);
  }
});
```

Then play your game and:

- Trigger a wrong answer, a correct answer, a hint, or level complete.
- You should see `ASSISTANT_GAME_EVENT` logs with:
  - `gameId` matching your `game-id`
  - the expected `eventType`
  - a sensible `levelId` and `targetConcept`.

If messages appear but the tutor doesn’t respond, the issue is on the assistant side; if no messages appear, the game isn’t calling the bridge correctly or the build hasn’t been staged.

