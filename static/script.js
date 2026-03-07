
// ══════════════════════════════════════════════════════
//  GAME STATE
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
  pendingTransitionDay: null
};

const DAY_THEMES = {
  1: 'Initial Detection & Assessment',
  2: 'Quarantine & Contact Tracing',
  3: 'Treatment & Medical Response',
  4: 'Public Health Communication',
  5: 'Resource Allocation',
  6: 'Managing Complications',
  7: 'Final Containment Push'
};

// ── Utilities ──
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-' + id).classList.add('active');
}

function addLoadingLog(text) {
  const log = document.getElementById('loading-log');
  const line = document.createElement('div');
  line.className = 'log-line';
  line.innerHTML = `<span style="color:var(--green-dim);">▸</span> ${text}`;
  log.appendChild(line);
}

function updateScore(newScore) {
  state.score = Math.max(0, Math.min(100, newScore));
  document.getElementById('hdr-score').textContent = state.score;

  // Color the score
  const el = document.getElementById('hdr-score');
  if (state.score >= 70) el.style.color = 'var(--green)';
  else if (state.score >= 50) el.style.color = 'var(--yellow)';
  else el.style.color = 'var(--red)';

  // Update progress bar
  const bar = document.getElementById('score-bar');
  bar.style.width = state.score + '%';
  if (state.score >= 70) bar.style.background = 'var(--green)';
  else if (state.score >= 50) bar.style.background = 'var(--yellow)';
  else bar.style.background = 'var(--red)';
}

// ── API calls ──
async function api(endpoint, body) {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return res.json();
}

// ══════════════════════════════════════════════════════
//  GAME FLOW
// ══════════════════════════════════════════════════════

async function startGame() {
  showScreen('loading');
  addLoadingLog('Connecting to pathogen database...');

  setTimeout(() => addLoadingLog('Scanning for active outbreak signatures...'), 600);
  setTimeout(() => addLoadingLog('Identified novel pathogen — analyzing genome...'), 1400);
  setTimeout(() => addLoadingLog('Cross-referencing with historical viral data...'), 2200);
  setTimeout(() => addLoadingLog('Generating mission briefing...'), 3000);

  try {
    const result = await api('/api/start', {});
    if (!result.success) throw new Error('API error');

    state.virusData = result.data;

    setTimeout(() => {
      addLoadingLog('Briefing prepared — stand by, scientist.');
      setTimeout(() => showBriefing(), 800);
    }, 3600);
  } catch (e) {
    addLoadingLog('ERROR: Could not connect to AI systems. Check your API key.');
    console.error(e);
  }
}

function showBriefing() {
  const v = state.virusData;
  document.getElementById('briefing-virus-name').textContent = v.virus_name;
  document.getElementById('briefing-location').textContent = v.location;
  document.getElementById('brief-classification').textContent = v.classification;
  document.getElementById('brief-mortality').textContent = v.mortality_rate;
  document.getElementById('brief-transmission').textContent = v.transmission;
  document.getElementById('brief-incubation').textContent = v.incubation_period;
  document.getElementById('brief-scenario').textContent = v.scenario;
  document.getElementById('brief-mission').textContent = v.day1_briefing;

  const symDiv = document.getElementById('brief-symptoms');
  symDiv.innerHTML = '';
  (v.symptoms || []).forEach(s => {
    const tag = document.createElement('span');
    tag.className = 'symptom-tag';
    tag.textContent = s;
    symDiv.appendChild(tag);
  });

  showScreen('briefing');
}

function beginDay() {
  populateSidebar();
  initDayDots();
  showScreen('game');
  loadQuestion();
}

function populateSidebar() {
  const v = state.virusData;
  document.getElementById('hdr-virus').textContent = v.virus_name;
  document.getElementById('side-virus-name').textContent = v.virus_name;
  document.getElementById('side-location').textContent = v.location;
  document.getElementById('side-cases').textContent = v.initial_cases + ' initial';
  document.getElementById('side-mortality').textContent = v.mortality_rate;
  document.getElementById('side-incubation').textContent = v.incubation_period;

  const symDiv = document.getElementById('side-symptoms');
  symDiv.innerHTML = '';
  (v.symptoms || []).forEach(s => {
    const el = document.createElement('div');
    el.className = 'symptom-mini';
    el.textContent = s;
    symDiv.appendChild(el);
  });
}

function initDayDots() {
  const container = document.getElementById('day-dots');
  container.innerHTML = '';
  for (let d = 1; d <= 7; d++) {
    const dot = document.createElement('div');
    dot.className = 'day-dot ' + (d < state.day ? 'done' : d === state.day ? 'current' : 'future');
    dot.id = 'day-dot-' + d;
    container.appendChild(dot);
  }

  const qContainer = document.getElementById('q-dots');
  qContainer.innerHTML = '';
  for (let q = 1; q <= 3; q++) {
    const dot = document.createElement('div');
    dot.className = 'q-dot ' + (q < state.questionNum ? 'done' : q === state.questionNum ? 'current' : '');
    dot.id = 'q-dot-' + q;
    qContainer.appendChild(dot);
  }
}

function updateDots() {
  document.getElementById('hdr-day').textContent = state.day;
  document.getElementById('hdr-q').textContent = state.questionNum;

  for (let d = 1; d <= 7; d++) {
    const dot = document.getElementById('day-dot-' + d);
    if (!dot) continue;
    dot.className = 'day-dot ' + (d < state.day ? 'done' : d === state.day ? 'current' : 'future');
  }
  for (let q = 1; q <= 3; q++) {
    const dot = document.getElementById('q-dot-' + q);
    if (!dot) continue;
    dot.className = 'q-dot ' + (q < state.questionNum ? 'done' : q === state.questionNum ? 'current' : '');
  }
}

async function loadQuestion() {
  // Show loading state
  document.getElementById('question-loading').style.display = 'block';
  document.getElementById('question-content').style.display = 'none';
  updateDots();

  try {
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
    document.getElementById('q-scenario').textContent = 'Error loading question. Please check your connection.';
    document.getElementById('question-loading').style.display = 'none';
    document.getElementById('question-content').style.display = 'block';
  }
}

function renderQuestion(data) {
  document.getElementById('q-meta').textContent =
    `DAY ${state.day} — QUESTION ${state.questionNum} OF 3 — ${(DAY_THEMES[state.day] || '').toUpperCase()}`;
  document.getElementById('q-scenario').textContent = data.scenario;
  document.getElementById('q-text').textContent = data.question;
  document.getElementById('edu-note').textContent = data.educational_note;

  const grid = document.getElementById('choices-grid');
  grid.innerHTML = '';
  (data.choices || []).forEach(choice => {
    const btn = document.createElement('button');
    btn.className = 'choice-btn';
    btn.innerHTML = `<span class="choice-id">${choice.id}</span><span>${choice.text}</span>`;
    btn.onclick = () => selectChoice(choice.id, btn);
    grid.appendChild(btn);
  });

  document.getElementById('question-loading').style.display = 'none';
  document.getElementById('question-content').style.display = 'block';
  state.selectedChoice = null;
}

function selectChoice(choiceId, btnEl) {
  if (state.selectedChoice) return; // Already answered

  state.selectedChoice = choiceId;
  document.querySelectorAll('.choice-btn').forEach(b => b.classList.remove('selected'));
  btnEl.classList.add('selected');
  document.querySelectorAll('.choice-btn').forEach(b => b.style.pointerEvents = 'none');

  // Open feedback modal in loading state
  document.getElementById('modal-loading').style.display = 'block';
  document.getElementById('modal-content').style.display = 'none';

  const choiceText = state.currentQuestion.choices.find(c => c.id === choiceId)?.text || '';
  document.getElementById('modal-choice-label').textContent = `Option ${choiceId} selected`;
  document.getElementById('modal-badge').textContent = '...';
  document.getElementById('modal-badge').className = 'result-badge';
  document.getElementById('modal-score-change').textContent = '';
  document.getElementById('feedback-modal').classList.add('open');

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

    // Update score
    updateScore(state.score + (fb.score_change || 0));

    // Add to history
    state.history.push({
      day: state.day,
      q: state.questionNum,
      choice: choiceId,
      choice_text: choiceText,
      score_change: fb.score_change || 0,
      rating: fb.result?.toLowerCase() || 'unknown'
    });

    // Add to history panel
    addHistoryEntry(choiceId, choiceText, fb.score_change || 0, fb.result);

    // Render modal
    const badge = document.getElementById('modal-badge');
    badge.textContent = fb.result || 'RESULT';
    const ratingClass = (fb.result || '').toLowerCase().replace(' ', '_');
    badge.className = 'result-badge ' + ratingClass;

    const scoreEl = document.getElementById('modal-score-change');
    const sc = fb.score_change || 0;
    scoreEl.textContent = (sc >= 0 ? '+' : '') + sc;
    scoreEl.style.color = sc >= 0 ? 'var(--green)' : 'var(--red)';

    document.getElementById('modal-feedback').textContent = fb.feedback || '';
    document.getElementById('modal-effect').textContent = fb.containment_effect || '';

    // Check if last question of last day
    const isLastQuestion = (state.day === 7 && state.questionNum === 3);
    document.getElementById('modal-next-btn').textContent =
      isLastQuestion ? '▶ VIEW FINAL REPORT' : '▶ NEXT';

    document.getElementById('modal-loading').style.display = 'none';
    document.getElementById('modal-content').style.display = 'block';
  } catch (e) {
    console.error(e);
    document.getElementById('modal-feedback').textContent = 'Error retrieving feedback.';
    document.getElementById('modal-loading').style.display = 'none';
    document.getElementById('modal-content').style.display = 'block';
  }
}

function addHistoryEntry(choiceId, choiceText, scoreChange, result) {
  const container = document.getElementById('history-entries');
  const entry = document.createElement('div');
  entry.className = 'history-entry';
  const sc = scoreChange >= 0 ? '+' + scoreChange : '' + scoreChange;
  const color = scoreChange >= 0 ? 'pos' : 'neg';
  entry.innerHTML = `
    <div class="history-entry-meta">DAY ${state.day} — Q${state.questionNum}</div>
    <div class="history-entry-choice">${choiceId}: ${choiceText.substring(0, 70)}${choiceText.length > 70 ? '…' : ''}</div>
    <div class="history-entry-score ${color}">${sc} pts — ${result || ''}</div>
  `;
  container.insertBefore(entry, container.firstChild);
}

function dismissFeedback() {
  document.getElementById('feedback-modal').classList.remove('open');

  const isLastQuestion = (state.day === 7 && state.questionNum === 3);

  if (isLastQuestion) {
    showGameOver();
    return;
  }

  if (state.questionNum === 3) {
    // End of day — transition
    const nextDay = state.day + 1;
    state.day = nextDay;
    state.questionNum = 1;

    document.getElementById('trans-day-num').textContent = nextDay;
    document.getElementById('trans-theme').textContent = DAY_THEMES[nextDay] || '';
    document.getElementById('trans-score').textContent =
      `Containment Score: ${state.score}/100`;
    showScreen('day-transition');
  } else {
    state.questionNum++;
    loadQuestion();
  }
}

function continueAfterTransition() {
  initDayDots();
  showScreen('game');
  loadQuestion();
}

async function showGameOver() {
  showScreen('game-over');

  // Set outcome header immediately
  const outcome = state.score >= 60 ? 'CONTAINED' : 'OUTBREAK FAILED';
  const isSuccess = state.score >= 60;

  document.getElementById('outcome-icon').textContent = isSuccess ? '✓' : '☣';
  document.getElementById('outcome-title').textContent = outcome;
  document.getElementById('outcome-title').style.color = isSuccess ? 'var(--green)' : 'var(--red)';
  document.getElementById('outcome-title').style.textShadow = isSuccess
    ? '0 0 30px rgba(0,255,136,0.5)' : '0 0 30px rgba(255,52,52,0.5)';
  document.getElementById('outcome-banner').style.borderBottom = '1px solid var(--border)';
  document.getElementById('outcome-banner').style.marginBottom = '30px';
  document.getElementById('outcome-score').textContent = `Final Score: ${state.score}/100`;
  document.getElementById('outcome-score').style.color = isSuccess ? 'var(--green)' : 'var(--red)';
  document.getElementById('outcome-headline').textContent = isSuccess
    ? 'Your decisions helped contain the outbreak in time.'
    : 'The virus spread beyond control. Study the science and try again.';

  try {
    const result = await api('/api/end', {
      virus_data: state.virusData,
      total_score: state.score,
      history: state.history
    });

    if (!result.success) throw new Error();
    const data = result.data;

    // Headline
    document.getElementById('outcome-headline').textContent = data.headline || '';

    // Eval
    document.getElementById('eval-text').textContent = data.evaluation || '';

    // Lists
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

    // Real virus info
    const rv = data.real_world_virus_info || {};
    document.getElementById('real-virus-title').textContent = rv.name || state.virusData.real_virus;
    document.getElementById('info-overview').textContent = rv.overview || '';
    document.getElementById('info-history').textContent = rv.historical_outbreaks || '';
    document.getElementById('info-containment').textContent = rv.real_containment || '';
    document.getElementById('info-vaccines').textContent = rv.vaccines_treatments || '';
    document.getElementById('info-fact').textContent = rv.interesting_fact || '';

    document.getElementById('gameover-loading').style.display = 'none';
    document.getElementById('gameover-content').style.display = 'block';
    document.getElementById('gameover-footer').style.display = 'block';
  } catch (e) {
    console.error(e);
    document.getElementById('gameover-loading').innerHTML =
      '<p style="color:var(--red);font-family:var(--mono);">Error loading final report.</p>';
  }
}

function restartGame() {
  // Reset state
  state = {
    phase: 'landing',
    virusData: null,
    day: 1,
    questionNum: 1,
    score: 50,
    history: [],
    currentQuestion: null,
    selectedChoice: null
  };
  document.getElementById('history-entries').innerHTML = '';
  document.getElementById('loading-log').innerHTML = '';
  document.getElementById('gameover-loading').style.display = 'block';
  document.getElementById('gameover-content').style.display = 'none';
  document.getElementById('gameover-footer').style.display = 'none';
  showScreen('landing');
}