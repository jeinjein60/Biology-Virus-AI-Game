// ══════════════════════════════════════════════════════
// GAME STATE
// ══════════════════════════════════════════════════════
let state = {
  phase: 'landing',
  virusData: null,
  day: 1,
  questionNum: 1,
  score: 50,
  history: [],
  currentQuestion: null,
  selectedChoice: null,
  chatHistory: [],
  dayQuestions: null,       // cached {q1, q2, q3} for current day
  dayQuestionsFetching: null // in-flight prefetch promise
};

const chatUiState = {
  dragging: false,
  offsetX: 0,
  offsetY: 0
};

// ══════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ══════════════════════════════════════════════════════
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-' + id).classList.add('active');
}

function openHowToPlay() {
  document.getElementById('how-to-play-modal').classList.add('open');
}

function closeHowToPlay() {
  document.getElementById('how-to-play-modal').classList.remove('open');
}

function openBriefing() {
  document.getElementById('briefing-modal').classList.add('open');
}

function closeBriefing() {
  document.getElementById('briefing-modal').classList.remove('open');
}

function populateBriefing(virusData) {
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

function startGameFromBriefing() {
  closeBriefing();
  populateSidebar();
  initDayDots();
  showScreen('game');
  prefetchDayQuestions();
  loadQuestion();
}

function updateScore(newScore) {
  state.score = Math.max(0, Math.min(100, newScore));
  document.getElementById('sidebar-score').textContent = state.score;
}

async function api(endpoint, body) {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return res.json();
}

// ══════════════════════════════════════════════════════
// GAME FLOW
// ══════════════════════════════════════════════════════
async function startGame() {
  showScreen('loading');
  
  try {
    const result = await api('/api/start', {});
    if (!result.success) throw new Error('API error');

    state.virusData = result.data;
    
    setTimeout(() => {
      populateBriefing(state.virusData);
      openBriefing();
    }, 2000);
  } catch (e) {
    alert('Error starting game. Check console.');
    console.error(e);
  }
}

function populateSidebar() {
  const v = state.virusData;
  document.getElementById('tip-symptoms').textContent = v.symptoms.join(', ');
  document.getElementById('tip-transmission').textContent = v.transmission;
  document.getElementById('tip-mortality').textContent = v.mortality_rate;
}

function initDayDots() {
  // Set IDs on existing day dots
  const dayContainer = document.getElementById('day-dots');
  const dayDots = dayContainer.querySelectorAll('.day-dot');
  dayDots.forEach((dot, i) => {
    dot.id = 'day-dot-' + (i + 1);
    dot.className = 'day-dot ' + (i < state.day - 1 ? 'done' : i === state.day - 1 ? 'current' : '');
  });

  // Set IDs on existing question dots
  const qContainer = document.getElementById('q-dots');
  const qDots = qContainer.querySelectorAll('.q-dot');
  qDots.forEach((dot, i) => {
    dot.id = 'q-dot-' + (i + 1);
    dot.className = 'q-dot ' + (i < state.questionNum - 1 ? 'done' : i === state.questionNum - 1 ? 'current' : '');
  });
}

function updateDots() {
  document.getElementById('sidebar-day').textContent = state.day;

  for (let d = 1; d <= 7; d++) {
    const dot = document.getElementById('day-dot-' + d);
    if (!dot) continue;
    dot.className = 'day-dot ' + (d < state.day ? 'done' : d === state.day ? 'current' : '');
  }
  
  for (let q = 1; q <= 2; q++) {
    const dot = document.getElementById('q-dot-' + q);
    if (!dot) continue;
    dot.className = 'q-dot ' + (q < state.questionNum ? 'done' : q === state.questionNum ? 'current' : '');
  }
}

function prefetchDayQuestions() {
  state.dayQuestions = null;
  state.dayQuestionsFetching = api('/api/day_questions', {
    virus_data: state.virusData,
    day: state.day,
    history: state.history
  }).then(result => {
    if (result.success) {
      state.dayQuestions = result.data;
      console.log(`✅ Pre-fetched all 3 questions for Day ${state.day}`);
    }
    state.dayQuestionsFetching = null;
  }).catch(err => {
    console.error('Prefetch failed:', err);
    state.dayQuestionsFetching = null;
  });
}

async function loadQuestion() {
  document.getElementById('question-loading').style.display = 'block';
  document.getElementById('question-content').style.display = 'none';
  updateDots();

  try {
    // Wait for prefetch if still in-flight
    if (state.dayQuestionsFetching) {
      await state.dayQuestionsFetching;
    }

    const cached = state.dayQuestions && state.dayQuestions['q' + state.questionNum];
    if (cached) {
      state.currentQuestion = cached;
      renderQuestion(cached);
      return;
    }

    // Fallback: fetch individually if cache missed
    const result = await api('/api/question', {
      virus_data: state.virusData,
      day: state.day,
      question_num: state.questionNum,
      history: state.history
    });

    if (!result.success) throw new Error('API error');
    state.currentQuestion = result.data;
    renderQuestion(result.data);
  } catch (e) {
    console.error(e);
    alert('Error loading question');
  }
}

function renderQuestion(data) {
  document.getElementById('question-header').textContent = 
    `DAY ${state.day} — QUESTION ${state.questionNum} OF 2`;
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

function selectChoice(choiceId, boxEl) {
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

async function getFeedback(choiceId, choiceText) {
  try {
    const result = await api('/api/feedback', {
      choice: choiceId,
      question_data: state.currentQuestion
    });

    if (!result.success) throw new Error();
    const fb = result.data;

    updateScore(state.score + (fb.score_change || 0));

    state.history.push({
      day: state.day,
      q: state.questionNum,
      choice: choiceId,
      choice_text: choiceText,
      score_change: fb.score_change || 0,
      rating: fb.result?.toLowerCase() || 'unknown'
    });

    document.getElementById('feedback-result').textContent = fb.result || 'RESULT';
    
    const scoreEl = document.getElementById('feedback-score');
    const sc = fb.score_change || 0;
    scoreEl.textContent = (sc >= 0 ? '+' : '') + sc;

    document.getElementById('feedback-text').textContent = fb.feedback || '';
    document.getElementById('feedback-effect').textContent = fb.containment_effect || '';

    document.getElementById('feedback-loading').style.display = 'none';
    document.getElementById('feedback-content').style.display = 'block';
  } catch (e) {
    console.error(e);
    alert('Error getting feedback');
  }
}

function dismissFeedback() {
  document.getElementById('feedback-modal').classList.remove('open');

  const isLastQuestion = (state.day === 7 && state.questionNum === 2);

  if (isLastQuestion) {
    showGameOver();
    return;
  }

  if (state.questionNum === 2) {
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

function continueAfterTransition() {
  initDayDots();
  showScreen('game');
  prefetchDayQuestions();
  loadQuestion();
}

async function showGameOver() {
  showScreen('game-over');

  const outcome = state.score >= 60 ? 'OUTBREAK CONTAINED' : 'OUTBREAK FAILED';
  document.getElementById('outcome-title').textContent = outcome;
  document.getElementById('outcome-headline').textContent = 
    state.score >= 60 ? 'Mission successful!' : 'The virus spread beyond control.';
  document.getElementById('outcome-score-display').textContent = `FINAL SCORE: ${state.score}/100`;

  try {
    const result = await api('/api/end', {
      virus_data: state.virusData,
      total_score: state.score,
      history: state.history
    });

    if (!result.success) throw new Error();
    const data = result.data;

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
    alert('Error loading final report');
  }
}

function restartGame() {
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

function openChatPopup() {
  const popup = document.getElementById('chat-popup');
  popup.classList.add('open');
  popup.setAttribute('aria-hidden', 'false');
  document.getElementById('chat-input').focus();
}

function closeChatPopup() {
  const popup = document.getElementById('chat-popup');
  popup.classList.remove('open');
  popup.setAttribute('aria-hidden', 'true');
}

function resetChatPopupPosition() {
  const popup = document.getElementById('chat-popup');
  popup.style.left = '';
  popup.style.top = '';
  popup.style.right = '';
  popup.style.bottom = '';
}

function renderChatMessages() {
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

function addChatMessage(role, text) {
  state.chatHistory.push({ role, text });
  renderChatMessages();
}

function getChatContext() {
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

async function sendChatMessage() {
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
    const result = await api('/api/chat', {
      message,
      context: getChatContext(),
      chat_history: state.chatHistory.slice(-8)
    });

    if (!result.success) throw new Error(result.error || 'Chat API error');
    addChatMessage('ai', result.data.reply || 'I could not generate a response.');
  } catch (e) {
    console.error(e);
    addChatMessage('ai', 'I had trouble answering that. Try asking again in a moment.');
  } finally {
    input.disabled = false;
    button.disabled = false;
    input.focus();
  }
}

function startChatDrag(event) {
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

function onChatDrag(event) {
  if (!chatUiState.dragging) return;

  const popup = document.getElementById('chat-popup');
  const maxLeft = Math.max(0, window.innerWidth - popup.offsetWidth);
  const maxTop = Math.max(0, window.innerHeight - popup.offsetHeight);
  const nextLeft = Math.min(Math.max(0, event.clientX - chatUiState.offsetX), maxLeft);
  const nextTop = Math.min(Math.max(0, event.clientY - chatUiState.offsetY), maxTop);

  popup.style.left = `${nextLeft}px`;
  popup.style.top = `${nextTop}px`;
}

function stopChatDrag() {
  chatUiState.dragging = false;
}

function initChatPopup() {
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

document.addEventListener('DOMContentLoaded', initChatPopup);
// // ══════════════════════════════════════════════════════
// //  GAME STATE
// // ══════════════════════════════════════════════════════
// let state = {
//   phase: 'landing',
//   virusData: null,
//   day: 1,
//   questionNum: 1,
//   score: 50,
//   history: [],
//   currentQuestion: null,
//   selectedChoice: null,
//   pendingTransitionDay: null
// };

// const DAY_THEMES = {
//   1: 'Initial Detection & Assessment',
//   2: 'Quarantine & Contact Tracing',
//   3: 'Treatment & Medical Response',
//   4: 'Public Health Communication',
//   5: 'Resource Allocation',
//   6: 'Managing Complications',
//   7: 'Final Containment Push'
// };

// // ── Utilities ──
// function showScreen(id) {
//   document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
//   document.getElementById('screen-' + id).classList.add('active');
// }

// function addLoadingLog(text) {
//   const log = document.getElementById('loading-log');
//   const line = document.createElement('div');
//   line.className = 'log-line';
//   line.innerHTML = `<span style="color:var(--green-dim);">▸</span> ${text}`;
//   log.appendChild(line);
// }

// function updateScore(newScore) {
//   state.score = Math.max(0, Math.min(100, newScore));
//   document.getElementById('hdr-score').textContent = state.score;

//   // Color the score
//   const el = document.getElementById('hdr-score');
//   if (state.score >= 70) el.style.color = 'var(--green)';
//   else if (state.score >= 50) el.style.color = 'var(--yellow)';
//   else el.style.color = 'var(--red)';

//   // Update progress bar
//   const bar = document.getElementById('score-bar');
//   bar.style.width = state.score + '%';
//   if (state.score >= 70) bar.style.background = 'var(--green)';
//   else if (state.score >= 50) bar.style.background = 'var(--yellow)';
//   else bar.style.background = 'var(--red)';
// }

// // ── API calls ──
// async function api(endpoint, body) {
//   const res = await fetch(endpoint, {
//     method: 'POST',
//     headers: { 'Content-Type': 'application/json' },
//     body: JSON.stringify(body)
//   });
//   return res.json();
// }

// // ══════════════════════════════════════════════════════
// //  GAME FLOW
// // ══════════════════════════════════════════════════════

// async function startGame() {
//   showScreen('loading');
//   addLoadingLog('Connecting to pathogen database...');

//   setTimeout(() => addLoadingLog('Scanning for active outbreak signatures...'), 600);
//   setTimeout(() => addLoadingLog('Identified novel pathogen — analyzing genome...'), 1400);
//   setTimeout(() => addLoadingLog('Cross-referencing with historical viral data...'), 2200);
//   setTimeout(() => addLoadingLog('Generating mission briefing...'), 3000);

//   try {
//     const result = await api('/api/start', {});
//     if (!result.success) throw new Error('API error');

//     state.virusData = result.data;

//     setTimeout(() => {
//       addLoadingLog('Briefing prepared — stand by, scientist.');
//       setTimeout(() => showBriefing(), 800);
//     }, 3600);
//   } catch (e) {
//     addLoadingLog('ERROR: Could not connect to AI systems. Check your API key.');
//     console.error(e);
//   }
// }

// function showBriefing() {
//   const v = state.virusData;
//   document.getElementById('briefing-virus-name').textContent = v.virus_name;
//   document.getElementById('briefing-location').textContent = v.location;
//   document.getElementById('brief-classification').textContent = v.classification;
//   document.getElementById('brief-mortality').textContent = v.mortality_rate;
//   document.getElementById('brief-transmission').textContent = v.transmission;
//   document.getElementById('brief-incubation').textContent = v.incubation_period;
//   document.getElementById('brief-scenario').textContent = v.scenario;
//   document.getElementById('brief-mission').textContent = v.day1_briefing;

//   const symDiv = document.getElementById('brief-symptoms');
//   symDiv.innerHTML = '';
//   (v.symptoms || []).forEach(s => {
//     const tag = document.createElement('span');
//     tag.className = 'symptom-tag';
//     tag.textContent = s;
//     symDiv.appendChild(tag);
//   });

//   showScreen('briefing');
// }

// function beginDay() {
//   populateSidebar();
//   initDayDots();
//   showScreen('game');
//   loadQuestion();
// }

// function populateSidebar() {
//   const v = state.virusData;
//   document.getElementById('hdr-virus').textContent = v.virus_name;
//   document.getElementById('side-virus-name').textContent = v.virus_name;
//   document.getElementById('side-location').textContent = v.location;
//   document.getElementById('side-cases').textContent = v.initial_cases + ' initial';
//   document.getElementById('side-mortality').textContent = v.mortality_rate;
//   document.getElementById('side-incubation').textContent = v.incubation_period;

//   const symDiv = document.getElementById('side-symptoms');
//   symDiv.innerHTML = '';
//   (v.symptoms || []).forEach(s => {
//     const el = document.createElement('div');
//     el.className = 'symptom-mini';
//     el.textContent = s;
//     symDiv.appendChild(el);
//   });
// }

// function initDayDots() {
//   const container = document.getElementById('day-dots');
//   container.innerHTML = '';
//   for (let d = 1; d <= 7; d++) {
//     const dot = document.createElement('div');
//     dot.className = 'day-dot ' + (d < state.day ? 'done' : d === state.day ? 'current' : 'future');
//     dot.id = 'day-dot-' + d;
//     container.appendChild(dot);
//   }

//   const qContainer = document.getElementById('q-dots');
//   qContainer.innerHTML = '';
//   for (let q = 1; q <= 3; q++) {
//     const dot = document.createElement('div');
//     dot.className = 'q-dot ' + (q < state.questionNum ? 'done' : q === state.questionNum ? 'current' : '');
//     dot.id = 'q-dot-' + q;
//     qContainer.appendChild(dot);
//   }
// }

// function updateDots() {
//   document.getElementById('hdr-day').textContent = state.day;
//   document.getElementById('hdr-q').textContent = state.questionNum;

//   for (let d = 1; d <= 7; d++) {
//     const dot = document.getElementById('day-dot-' + d);
//     if (!dot) continue;
//     dot.className = 'day-dot ' + (d < state.day ? 'done' : d === state.day ? 'current' : 'future');
//   }
//   for (let q = 1; q <= 3; q++) {
//     const dot = document.getElementById('q-dot-' + q);
//     if (!dot) continue;
//     dot.className = 'q-dot ' + (q < state.questionNum ? 'done' : q === state.questionNum ? 'current' : '');
//   }
// }

// async function loadQuestion() {
//   // Show loading state
//   document.getElementById('question-loading').style.display = 'block';
//   document.getElementById('question-content').style.display = 'none';
//   updateDots();

//   try {
//     const result = await api('/api/question', {
//       virus_data: state.virusData,
//       day: state.day,
//       question_num: state.questionNum,
//       history: state.history
//     });

//     if (!result.success) throw new Error('API error');
//     state.currentQuestion = result.data;
//     renderQuestion(result.data);
//   } catch (e) {
//     console.error(e);
//     document.getElementById('q-scenario').textContent = 'Error loading question. Please check your connection.';
//     document.getElementById('question-loading').style.display = 'none';
//     document.getElementById('question-content').style.display = 'block';
//   }
// }

// function renderQuestion(data) {
//   document.getElementById('q-meta').textContent =
//     `DAY ${state.day} — QUESTION ${state.questionNum} OF 3 — ${(DAY_THEMES[state.day] || '').toUpperCase()}`;
//   document.getElementById('q-scenario').textContent = data.scenario;
//   document.getElementById('q-text').textContent = data.question;
//   document.getElementById('edu-note').textContent = data.educational_note;

//   const grid = document.getElementById('choices-grid');
//   grid.innerHTML = '';
//   (data.choices || []).forEach(choice => {
//     const btn = document.createElement('button');
//     btn.className = 'choice-btn';
//     btn.innerHTML = `<span class="choice-id">${choice.id}</span><span>${choice.text}</span>`;
//     btn.onclick = () => selectChoice(choice.id, btn);
//     grid.appendChild(btn);
//   });

//   document.getElementById('question-loading').style.display = 'none';
//   document.getElementById('question-content').style.display = 'block';
//   state.selectedChoice = null;
// }

// function selectChoice(choiceId, btnEl) {
//   if (state.selectedChoice) return; // Already answered

//   state.selectedChoice = choiceId;
//   document.querySelectorAll('.choice-btn').forEach(b => b.classList.remove('selected'));
//   btnEl.classList.add('selected');
//   document.querySelectorAll('.choice-btn').forEach(b => b.style.pointerEvents = 'none');

//   // Open feedback modal in loading state
//   document.getElementById('modal-loading').style.display = 'block';
//   document.getElementById('modal-content').style.display = 'none';

//   const choiceText = state.currentQuestion.choices.find(c => c.id === choiceId)?.text || '';
//   document.getElementById('modal-choice-label').textContent = `Option ${choiceId} selected`;
//   document.getElementById('modal-badge').textContent = '...';
//   document.getElementById('modal-badge').className = 'result-badge';
//   document.getElementById('modal-score-change').textContent = '';
//   document.getElementById('feedback-modal').classList.add('open');

//   getFeedback(choiceId, choiceText);
// }

// async function getFeedback(choiceId, choiceText) {
//   try {
//     const result = await api('/api/feedback', {
//       choice: choiceId,
//       question_data: state.currentQuestion
//     });

//     if (!result.success) throw new Error();
//     const fb = result.data;

//     // Update score
//     updateScore(state.score + (fb.score_change || 0));

//     // Add to history
//     state.history.push({
//       day: state.day,
//       q: state.questionNum,
//       choice: choiceId,
//       choice_text: choiceText,
//       score_change: fb.score_change || 0,
//       rating: fb.result?.toLowerCase() || 'unknown'
//     });

//     // Add to history panel
//     addHistoryEntry(choiceId, choiceText, fb.score_change || 0, fb.result);

//     // Render modal
//     const badge = document.getElementById('modal-badge');
//     badge.textContent = fb.result || 'RESULT';
//     const ratingClass = (fb.result || '').toLowerCase().replace(' ', '_');
//     badge.className = 'result-badge ' + ratingClass;

//     const scoreEl = document.getElementById('modal-score-change');
//     const sc = fb.score_change || 0;
//     scoreEl.textContent = (sc >= 0 ? '+' : '') + sc;
//     scoreEl.style.color = sc >= 0 ? 'var(--green)' : 'var(--red)';

//     document.getElementById('modal-feedback').textContent = fb.feedback || '';
//     document.getElementById('modal-effect').textContent = fb.containment_effect || '';

//     // Check if last question of last day
//     const isLastQuestion = (state.day === 7 && state.questionNum === 3);
//     document.getElementById('modal-next-btn').textContent =
//       isLastQuestion ? '▶ VIEW FINAL REPORT' : '▶ NEXT';

//     document.getElementById('modal-loading').style.display = 'none';
//     document.getElementById('modal-content').style.display = 'block';
//   } catch (e) {
//     console.error(e);
//     document.getElementById('modal-feedback').textContent = 'Error retrieving feedback.';
//     document.getElementById('modal-loading').style.display = 'none';
//     document.getElementById('modal-content').style.display = 'block';
//   }
// }

// function addHistoryEntry(choiceId, choiceText, scoreChange, result) {
//   const container = document.getElementById('history-entries');
//   const entry = document.createElement('div');
//   entry.className = 'history-entry';
//   const sc = scoreChange >= 0 ? '+' + scoreChange : '' + scoreChange;
//   const color = scoreChange >= 0 ? 'pos' : 'neg';
//   entry.innerHTML = `
//     <div class="history-entry-meta">DAY ${state.day} — Q${state.questionNum}</div>
//     <div class="history-entry-choice">${choiceId}: ${choiceText.substring(0, 70)}${choiceText.length > 70 ? '…' : ''}</div>
//     <div class="history-entry-score ${color}">${sc} pts — ${result || ''}</div>
//   `;
//   container.insertBefore(entry, container.firstChild);
// }

// function dismissFeedback() {
//   document.getElementById('feedback-modal').classList.remove('open');

//   const isLastQuestion = (state.day === 7 && state.questionNum === 3);

//   if (isLastQuestion) {
//     showGameOver();
//     return;
//   }

//   if (state.questionNum === 3) {
//     // End of day — transition
//     const nextDay = state.day + 1;
//     state.day = nextDay;
//     state.questionNum = 1;

//     document.getElementById('trans-day-num').textContent = nextDay;
//     document.getElementById('trans-theme').textContent = DAY_THEMES[nextDay] || '';
//     document.getElementById('trans-score').textContent =
//       `Containment Score: ${state.score}/100`;
//     showScreen('day-transition');
//   } else {
//     state.questionNum++;
//     loadQuestion();
//   }
// }

// function continueAfterTransition() {
//   initDayDots();
//   showScreen('game');
//   loadQuestion();
// }

// async function showGameOver() {
//   showScreen('game-over');

//   // Set outcome header immediately
//   const outcome = state.score >= 60 ? 'CONTAINED' : 'OUTBREAK FAILED';
//   const isSuccess = state.score >= 60;

//   document.getElementById('outcome-icon').textContent = isSuccess ? '✓' : '☣';
//   document.getElementById('outcome-title').textContent = outcome;
//   document.getElementById('outcome-title').style.color = isSuccess ? 'var(--green)' : 'var(--red)';
//   document.getElementById('outcome-title').style.textShadow = isSuccess
//     ? '0 0 30px rgba(0,255,136,0.5)' : '0 0 30px rgba(255,52,52,0.5)';
//   document.getElementById('outcome-banner').style.borderBottom = '1px solid var(--border)';
//   document.getElementById('outcome-banner').style.marginBottom = '30px';
//   document.getElementById('outcome-score').textContent = `Final Score: ${state.score}/100`;
//   document.getElementById('outcome-score').style.color = isSuccess ? 'var(--green)' : 'var(--red)';
//   document.getElementById('outcome-headline').textContent = isSuccess
//     ? 'Your decisions helped contain the outbreak in time.'
//     : 'The virus spread beyond control. Study the science and try again.';

//   try {
//     const result = await api('/api/end', {
//       virus_data: state.virusData,
//       total_score: state.score,
//       history: state.history
//     });

//     if (!result.success) throw new Error();
//     const data = result.data;

//     // Headline
//     document.getElementById('outcome-headline').textContent = data.headline || '';

//     // Eval
//     document.getElementById('eval-text').textContent = data.evaluation || '';

//     // Lists
//     const listsDiv = document.getElementById('eval-lists');
//     listsDiv.innerHTML = '';
//     (data.key_successes || []).forEach(s => {
//       if (s) {
//         const el = document.createElement('div');
//         el.className = 'list-item success';
//         el.textContent = s;
//         listsDiv.appendChild(el);
//       }
//     });
//     (data.key_mistakes || []).forEach(m => {
//       if (m) {
//         const el = document.createElement('div');
//         el.className = 'list-item mistake';
//         el.textContent = m;
//         listsDiv.appendChild(el);
//       }
//     });

//     // Real virus info
//     const rv = data.real_world_virus_info || {};
//     document.getElementById('real-virus-title').textContent = rv.name || state.virusData.real_virus;
//     document.getElementById('info-overview').textContent = rv.overview || '';
//     document.getElementById('info-history').textContent = rv.historical_outbreaks || '';
//     document.getElementById('info-containment').textContent = rv.real_containment || '';
//     document.getElementById('info-vaccines').textContent = rv.vaccines_treatments || '';
//     document.getElementById('info-fact').textContent = rv.interesting_fact || '';

//     document.getElementById('gameover-loading').style.display = 'none';
//     document.getElementById('gameover-content').style.display = 'block';
//     document.getElementById('gameover-footer').style.display = 'block';
//   } catch (e) {
//     console.error(e);
//     document.getElementById('gameover-loading').innerHTML =
//       '<p style="color:var(--red);font-family:var(--mono);">Error loading final report.</p>';
//   }
// }

// function restartGame() {
//   // Reset state
//   state = {
//     phase: 'landing',
//     virusData: null,
//     day: 1,
//     questionNum: 1,
//     score: 50,
//     history: [],
//     currentQuestion: null,
//     selectedChoice: null
//   };
//   document.getElementById('history-entries').innerHTML = '';
//   document.getElementById('loading-log').innerHTML = '';
//   document.getElementById('gameover-loading').style.display = 'block';
//   document.getElementById('gameover-content').style.display = 'none';
//   document.getElementById('gameover-footer').style.display = 'none';
//   showScreen('landing');
// }
