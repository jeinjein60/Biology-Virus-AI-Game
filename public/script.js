import { callAI, buildStartPrompt, buildFeedbackPrompt, buildEndPrompt, buildChatPrompt, buildQuestionFallback, generateSingleQuestion } from './ai.js';
import { initStemAssistantBridge, setStemAssistantLevel, stemAssistant } from 'stem-assistant-bridge';

initStemAssistantBridge({
  gameId: "BVoutbreak",
  defaultTargetConcept: "virus_epidemiology"
});

// ══════════════════════════════════════════════════════
// GAME STATE
// ══════════════════════════════════════════════════════
export let state = {
  phase: 'landing',
  virusData: null,
  day: 1,
  questionNum: 1,
  score: 50,
  history: [],
  currentQuestion: null,
  selectedChoice: null,
  chatHistory: [],
  dayQuestions: null,
  dayQuestionsFetching: null
};

const chatUiState = {
  dragging: false,
  offsetX: 0,
  offsetY: 0
};

// ══════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ══════════════════════════════════════════════════════
export function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-' + id).classList.add('active');
}

export function openHowToPlay() {
  document.getElementById('how-to-play-modal').classList.add('open');
}

export function closeHowToPlay() {
  document.getElementById('how-to-play-modal').classList.remove('open');
}

export function openBriefing() {
  document.getElementById('briefing-modal').classList.add('open');
}

export function closeBriefing() {
  document.getElementById('briefing-modal').classList.remove('open');
}

export function populateBriefing(virusData) {
  document.getElementById('briefing-virus-name').textContent = virusData.virus_name.toUpperCase();
  document.getElementById('briefing-scenario').textContent = virusData.scenario;
  document.getElementById('briefing-classification').textContent = virusData.classification;
  document.getElementById('briefing-transmission').textContent = virusData.transmission;
  document.getElementById('briefing-mortality').textContent = virusData.mortality_rate;
  document.getElementById('briefing-incubation').textContent = virusData.incubation_period;
  document.getElementById('briefing-location').textContent = virusData.location + ' — Initial confirmed cases: ' + virusData.initial_cases;
  document.getElementById('briefing-symptoms').textContent = virusData.symptoms.join(' • ');
  document.getElementById('briefing-cases').textContent = 'Confirmed: ' + virusData.initial_cases;
  document.getElementById('briefing-mission').textContent = virusData.day1_briefing;
}

export function startGameFromBriefing() {
  closeBriefing();
  populateSidebar();
  initDayDots();
  showScreen('game');
  setStemAssistantLevel(`day-${state.day}`, "virus_epidemiology");
  stemAssistant.levelStart({ levelId: `day-${state.day}`, targetConcept: "virus_epidemiology" });
  prefetchDayQuestions();
  loadQuestion();
}

export function updateScore(newScore) {
  state.score = Math.max(0, Math.min(100, newScore));
  document.getElementById('sidebar-score').textContent = state.score;
}

// ══════════════════════════════════════════════════════
// GAME FLOW
// ══════════════════════════════════════════════════════
export async function startGame() {
  showScreen('loading');

  try {
    const data = await callAI(buildStartPrompt());
    state.virusData = data;

    setTimeout(() => {
      populateBriefing(state.virusData);
      openBriefing();
    }, 2000);
  } catch (e) {
    alert('Error starting game. Check console.');
    console.error(e);
  }
}

export function populateSidebar() {
  const v = state.virusData;
  document.getElementById('tip-symptoms').textContent = v.symptoms.join(', ');
  document.getElementById('tip-transmission').textContent = v.transmission;
  document.getElementById('tip-mortality').textContent = v.mortality_rate;
}

export function initDayDots() {
  const dayContainer = document.getElementById('day-dots');
  const dayDots = dayContainer.querySelectorAll('.day-dot');
  dayDots.forEach((dot, i) => {
    dot.id = 'day-dot-' + (i + 1);
    dot.className = 'day-dot ' + (i < state.day - 1 ? 'done' : i === state.day - 1 ? 'current' : '');
  });

  const qContainer = document.getElementById('q-dots');
  const qDots = qContainer.querySelectorAll('.q-dot');
  qDots.forEach((dot, i) => {
    dot.id = 'q-dot-' + (i + 1);
    dot.className = 'q-dot ' + (i < state.questionNum - 1 ? 'done' : i === state.questionNum - 1 ? 'current' : '');
  });
}

export function updateDots() {
  document.getElementById('sidebar-day').textContent = state.day;

  for (let d = 1; d <= 7; d++) {
    const dot = document.getElementById('day-dot-' + d);
    if (!dot) continue;
    dot.className = 'day-dot ' + (d < state.day ? 'done' : d === state.day ? 'current' : '');
  }

  for (let q = 1; q <= 3; q++) {
    const dot = document.getElementById('q-dot-' + q);
    if (!dot) continue;
    dot.className = 'q-dot ' + (q < state.questionNum ? 'done' : q === state.questionNum ? 'current' : '');
  }
}

export function prefetchDayQuestions() {
  state.dayQuestions = null;
  state.dayQuestionsFetching = Promise.all([
    generateSingleQuestion(state.virusData, state.day, 1, state.history).catch(() => buildQuestionFallback(state.day)),
    generateSingleQuestion(state.virusData, state.day, 2, state.history).catch(() => buildQuestionFallback(state.day)),
    generateSingleQuestion(state.virusData, state.day, 3, state.history).catch(() => buildQuestionFallback(state.day))
  ]).then(([q1, q2, q3]) => {
    state.dayQuestions = { q1, q2, q3};
    console.log(`✅ Pre-fetched all 3 questions for Day ${state.day}`);
    state.dayQuestionsFetching = null;
  }).catch(err => {
    console.error('Prefetch failed:', err);
    state.dayQuestionsFetching = null;
  });
}

export async function loadQuestion() {
  document.getElementById('question-loading').style.display = 'block';
  document.getElementById('question-content').style.display = 'none';
  updateDots();

  try {
    if (state.dayQuestionsFetching) {
      await state.dayQuestionsFetching;
    }

    const cached = state.dayQuestions && state.dayQuestions['q' + state.questionNum];
    if (cached) {
      state.currentQuestion = cached;
      renderQuestion(cached);
      return;
    }

    const data = await generateSingleQuestion(state.virusData, state.day, state.questionNum, state.history);
    state.currentQuestion = data;
    renderQuestion(data);
  } catch (e) {
    console.error(e);
    const fallback = buildQuestionFallback(state.day);
    state.currentQuestion = fallback;
    renderQuestion(fallback);
  }
}

export function renderQuestion(data) {
  document.getElementById('question-header').textContent =
    `DAY ${state.day} — QUESTION ${state.questionNum} OF 3`;
  document.getElementById('scenario-text').textContent = data.scenario;
  document.getElementById('question-text').textContent = data.question;
  document.getElementById('edu-note').textContent = data.educational_note;

  const container = document.getElementById('choices-container');
  container.innerHTML = '';

  (data.choices || []).forEach(choice => {
    const box = document.createElement('div');
    box.className = 'choice-box';
    box.innerHTML = `
      <div class="choice-id">${choice.id}</div>
      <div class="choice-text">${choice.text}</div>
    `;
    box.onclick = () => selectChoice(choice.id, box);
    container.appendChild(box);
  });

  document.getElementById('question-loading').style.display = 'none';
  document.getElementById('question-content').style.display = 'block';
  state.selectedChoice = null;
}

export function selectChoice(choiceId, boxEl) {
  if (state.selectedChoice) return;

  state.selectedChoice = choiceId;
  document.querySelectorAll('.choice-box').forEach(b => b.classList.remove('selected'));
  boxEl.classList.add('selected');
  document.querySelectorAll('.choice-box').forEach(b => b.style.pointerEvents = 'none');

  document.getElementById('feedback-loading').style.display = 'block';
  document.getElementById('feedback-content').style.display = 'none';
  document.getElementById('feedback-modal').classList.add('open');

  const choiceText = state.currentQuestion.choices.find(c => c.id === choiceId)?.text || '';
  getFeedback(choiceId, choiceText);
}

export async function getFeedback(choiceId, choiceText) {
  const scoreMap = { excellent: 10, good: 8, poor: -8, terrible: -10 };
  const rating = (state.currentQuestion.choice_ratings || {})[choiceId] || 'poor';
  const baseScore = scoreMap[rating] || 0;

  try {
    const data = await callAI(buildFeedbackPrompt(choiceId, rating, state.currentQuestion), 800);

    data.score_change = baseScore;
    data.result = rating.toUpperCase();

    updateScore(state.score + baseScore);

    state.history.push({
      day: state.day,
      q: state.questionNum,
      choice: choiceId,
      choice_text: choiceText,
      question_text: state.currentQuestion?.question || '',
      score_change: baseScore,
      rating: rating
    });

    document.getElementById('feedback-result').textContent = data.result || 'RESULT';

    const scoreEl = document.getElementById('feedback-score');
    scoreEl.textContent = (baseScore >= 0 ? '+' : '') + baseScore;

    document.getElementById('feedback-text').textContent = data.feedback || '';
    document.getElementById('feedback-effect').textContent = data.containment_effect || '';

    document.getElementById('feedback-loading').style.display = 'none';
    document.getElementById('feedback-content').style.display = 'block';
  } catch (e) {
    console.error(e);

    updateScore(state.score + baseScore);
    state.history.push({
      day: state.day, q: state.questionNum, choice: choiceId,
      choice_text: choiceText, question_text: state.currentQuestion?.question || '',
      score_change: baseScore, rating: rating
    });

    const feedbackText = {
      excellent: 'Outstanding decision! This follows evidence-based epidemiological protocols.',
      good: 'Solid choice that aligns with public health best practices.',
      poor: 'This decision has significant drawbacks that may hinder containment.',
      terrible: 'Critical error! This contradicts fundamental outbreak response principles.'
    };
    const effectText = {
      excellent: 'Your swift action significantly slowed viral transmission.',
      good: 'Your decision contributed to gradual containment improvement.',
      poor: 'Your choice created setbacks in the response strategy.',
      terrible: 'Your decision enabled rapid viral spread.'
    };

    document.getElementById('feedback-result').textContent = rating.toUpperCase();
    document.getElementById('feedback-score').textContent = (baseScore >= 0 ? '+' : '') + baseScore;
    document.getElementById('feedback-text').textContent = feedbackText[rating] || 'Decision recorded.';
    document.getElementById('feedback-effect').textContent = effectText[rating] || 'The outbreak continues.';
    document.getElementById('feedback-loading').style.display = 'none';
    document.getElementById('feedback-content').style.display = 'block';
  }
}

export function dismissFeedback() {
  document.getElementById('feedback-modal').classList.remove('open');

  const isLastQuestion = (state.day === 7 && state.questionNum === 3);

  if (isLastQuestion) {
    const levelId = `day-${state.day}`;
    if (state.score < 60) {
      stemAssistant.incorrect({ levelId, targetConcept: "virus_epidemiology", playerAnswer: `containment: ${state.score}` });
    } else {
      stemAssistant.correct({ levelId, targetConcept: "virus_epidemiology", playerAnswer: `containment: ${state.score}` });
    }
    showGameOver();
    return;
  }

  if (state.questionNum === 3) {
    const levelId = `day-${state.day}`;
    if (state.score < 60) {
      stemAssistant.incorrect({ levelId, targetConcept: "virus_epidemiology", playerAnswer: `containment: ${state.score}` });
    } else {
      stemAssistant.correct({ levelId, targetConcept: "virus_epidemiology", playerAnswer: `containment: ${state.score}` });
    }
    const nextDay = state.day + 1;
    state.day = nextDay;
    state.questionNum = 1;

    document.getElementById('trans-day-big').textContent = `DAY ${nextDay}`;
    document.getElementById('trans-day-info').textContent = `Containment Level: ${state.score}/100`;
    document.getElementById('trans-day-tips').textContent =
      `Continue making critical decisions. ${state.score >= 60 ? 'You\'re on track!' : 'Improve your strategy!'}`;
    showScreen('day-transition');
  } else {
    state.questionNum++;
    loadQuestion();
  }
}

export function continueAfterTransition() {
  initDayDots();
  showScreen('game');
  setStemAssistantLevel(`day-${state.day}`, "virus_epidemiology");
  stemAssistant.levelStart({ levelId: `day-${state.day}`, targetConcept: "virus_epidemiology" });
  prefetchDayQuestions();
  loadQuestion();
}

export async function showGameOver() {
  showScreen('game-over');

  const outcome = state.score >= 60 ? 'OUTBREAK CONTAINED' : 'OUTBREAK FAILED';
  document.getElementById('outcome-title').textContent = outcome;
  document.getElementById('outcome-headline').textContent =
    state.score >= 60 ? 'Mission successful!' : 'The virus spread beyond control.';
  document.getElementById('outcome-score-display').textContent = `FINAL SCORE: ${state.score}/100`;

  try {
    const data = await callAI(buildEndPrompt(state.virusData, state.score, state.history), 2000);

    document.getElementById('eval-text').textContent = data.evaluation || '';

    const listsDiv = document.getElementById('eval-lists');
    listsDiv.innerHTML = '';
    (data.key_successes || []).forEach(s => {
      if (s) {
        const el = document.createElement('div');
        el.className = 'list-item success';
        el.textContent = s;
        listsDiv.appendChild(el);
      }
    });
    (data.key_mistakes || []).forEach(m => {
      if (m) {
        const el = document.createElement('div');
        el.className = 'list-item mistake';
        el.textContent = m;
        listsDiv.appendChild(el);
      }
    });

    const rv = data.real_world_virus_info || {};
    document.getElementById('real-virus-name').textContent = rv.name || 'Unknown';
    document.getElementById('virus-info-text').innerHTML = `
      <strong>Overview:</strong> ${rv.overview || ''}<br><br>
      <strong>Historical Outbreaks:</strong> ${rv.historical_outbreaks || ''}<br><br>
      <strong>Containment:</strong> ${rv.real_containment || ''}<br><br>
      <strong>Treatments:</strong> ${rv.vaccines_treatments || ''}<br><br>
      <strong>Fascinating Fact:</strong> ${rv.interesting_fact || ''}
    `;

    document.getElementById('gameover-loading').style.display = 'none';
    document.getElementById('gameover-content').style.display = 'block';
  } catch (e) {
    console.error(e);
    document.getElementById('eval-text').textContent = 'Your response to the outbreak has concluded.';
    document.getElementById('gameover-loading').style.display = 'none';
    document.getElementById('gameover-content').style.display = 'block';
  }
}

export function restartGame() {
  state = {
    phase: 'landing',
    virusData: null,
    day: 1,
    questionNum: 1,
    score: 50,
    history: [],
    currentQuestion: null,
    selectedChoice: null,
    chatHistory: []
  };
  document.getElementById('gameover-loading').style.display = 'block';
  document.getElementById('gameover-content').style.display = 'none';
  closeChatPopup();
  resetChatPopupPosition();
  renderChatMessages();
  showScreen('landing');
}

// ══════════════════════════════════════════════════════
// CHAT
// ══════════════════════════════════════════════════════
export function openChatPopup() {
  const popup = document.getElementById('chat-popup');
  popup.classList.add('open');
  popup.setAttribute('aria-hidden', 'false');
  document.getElementById('chat-input').focus();
}

export function closeChatPopup() {
  const popup = document.getElementById('chat-popup');
  popup.classList.remove('open');
  popup.setAttribute('aria-hidden', 'true');
}

export function resetChatPopupPosition() {
  const popup = document.getElementById('chat-popup');
  popup.style.left = '';
  popup.style.top = '';
  popup.style.right = '';
  popup.style.bottom = '';
}

export function renderChatMessages() {
  const container = document.getElementById('chat-messages');
  const emptyState = document.getElementById('chat-empty-state');
  if (!container || !emptyState) return;

  container.querySelectorAll('.chat-message').forEach(el => el.remove());
  emptyState.style.display = state.chatHistory.length ? 'none' : 'block';

  state.chatHistory.forEach(entry => {
    const messageEl = document.createElement('div');
    messageEl.className = `chat-message ${entry.role}`;

    const roleEl = document.createElement('span');
    roleEl.className = 'chat-message-role';
    roleEl.textContent = entry.role === 'user' ? 'You' : 'AI Analyst';

    const textEl = document.createElement('div');
    textEl.textContent = entry.text;

    messageEl.appendChild(roleEl);
    messageEl.appendChild(textEl);
    container.appendChild(messageEl);
  });

  container.scrollTop = container.scrollHeight;
}

export function addChatMessage(role, text) {
  state.chatHistory.push({ role, text });
  renderChatMessages();
}

export function getChatContext() {
  if (!state.virusData) {
    return {
      day: state.day,
      question_num: state.questionNum,
      score: state.score,
      history: state.history.slice(-3)
    };
  }

  return {
    virus_name: state.virusData.virus_name,
    real_virus: state.virusData.real_virus,
    transmission: state.virusData.transmission,
    symptoms: state.virusData.symptoms,
    location: state.virusData.location,
    day: state.day,
    question_num: state.questionNum,
    score: state.score,
    current_question: state.currentQuestion,
    history: state.history.slice(-3)
  };
}

export async function sendChatMessage() {
  const input = document.getElementById('chat-input');
  const button = document.querySelector('#chat-popup .chat-send');
  const message = input.value.trim();
  if (!message) return;

  openChatPopup();
  addChatMessage('user', message);
  input.value = '';
  input.disabled = true;
  button.disabled = true;

  try {
    const data = await callAI(buildChatPrompt(message, getChatContext(), state.chatHistory.slice(-8)), 500);
    addChatMessage('ai', data.reply || 'I could not generate a response.');
  } catch (e) {
    console.error(e);
    addChatMessage('ai', 'I had trouble answering that. Try asking again in a moment.');
  } finally {
    input.disabled = false;
    button.disabled = false;
    input.focus();
  }
}

// ── Mic / Speech Recognition ──
let micRecognition = null;
let micListening = false;

export function toggleMic() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    alert('Speech recognition is not supported in your browser. Try Chrome or Edge.');
    return;
  }

  if (micListening) {
    micRecognition.stop();
    return;
  }

  micRecognition = new SpeechRecognition();
  micRecognition.lang = 'en-US';
  micRecognition.interimResults = false;
  micRecognition.maxAlternatives = 1;

  micRecognition.onstart = () => {
    micListening = true;
    document.getElementById('chat-mic-btn').classList.add('listening');
    document.getElementById('chat-input').placeholder = 'Listening...';
  };

  micRecognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    document.getElementById('chat-input').value = transcript;
    sendChatMessage();
  };

  micRecognition.onerror = (event) => {
    console.error('Speech recognition error:', event.error);
    if (event.error === 'not-allowed') {
      alert('Microphone access was denied. Please allow microphone access in your browser settings.');
    }
  };

  micRecognition.onend = () => {
    micListening = false;
    document.getElementById('chat-mic-btn').classList.remove('listening');
    document.getElementById('chat-input').placeholder = 'Ask about biology or your current outbreak...';
  };

  micRecognition.start();
}

// ── Chat Drag ──
export function startChatDrag(event) {
  const popup = document.getElementById('chat-popup');
  if (!popup.classList.contains('open')) return;
  if (window.innerWidth <= 900) return;

  const rect = popup.getBoundingClientRect();
  chatUiState.dragging = true;
  chatUiState.offsetX = event.clientX - rect.left;
  chatUiState.offsetY = event.clientY - rect.top;

  popup.style.left = `${rect.left}px`;
  popup.style.top = `${rect.top}px`;
  popup.style.right = 'auto';
  popup.style.bottom = 'auto';
}

export function onChatDrag(event) {
  if (!chatUiState.dragging) return;

  const popup = document.getElementById('chat-popup');
  const maxLeft = Math.max(0, window.innerWidth - popup.offsetWidth);
  const maxTop = Math.max(0, window.innerHeight - popup.offsetHeight);
  const nextLeft = Math.min(Math.max(0, event.clientX - chatUiState.offsetX), maxLeft);
  const nextTop = Math.min(Math.max(0, event.clientY - chatUiState.offsetY), maxTop);

  popup.style.left = `${nextLeft}px`;
  popup.style.top = `${nextTop}px`;
}

export function stopChatDrag() {
  chatUiState.dragging = false;
}

export function initChatPopup() {
  const input = document.getElementById('chat-input');
  const header = document.getElementById('chat-popup-header');

  if (input) {
    input.addEventListener('keydown', event => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendChatMessage();
      }
    });
  }

  if (header) {
    header.addEventListener('pointerdown', startChatDrag);
  }

  document.addEventListener('pointermove', onChatDrag);
  document.addEventListener('pointerup', stopChatDrag);
  window.addEventListener('resize', () => {
    if (window.innerWidth <= 900) {
      resetChatPopupPosition();
    }
  });

  renderChatMessages();
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', initChatPopup);
}

// Expose functions as browser globals for onclick handlers in HTML
if (typeof window !== 'undefined') {
  Object.assign(window, {
    startGame, startGameFromBriefing, dismissFeedback, continueAfterTransition,
    restartGame, selectChoice, sendChatMessage, toggleMic,
    openChatPopup, closeChatPopup, openBriefing, closeBriefing,
    openHowToPlay, closeHowToPlay, startChatDrag, onChatDrag, stopChatDrag
  });
}