// @vitest-environment jsdom
import { describe, test, expect, vi, beforeAll, beforeEach } from 'vitest';

vi.mock('../public/ai.js', () => ({
  callAI: vi.fn().mockResolvedValue({ reply: 'ok', evaluation: 'good', key_successes: [], key_mistakes: [], real_world_virus_info: {} }),
  buildStartPrompt: vi.fn(() => 'mock prompt'),
  buildFeedbackPrompt: vi.fn(() => 'mock prompt'),
  buildEndPrompt: vi.fn(() => 'mock prompt'),
  buildChatPrompt: vi.fn(() => 'mock prompt'),
  buildQuestionFallback: vi.fn((day) => ({
    scenario: 'Test scenario',
    question: 'Test question?',
    choices: [
      { id: 'A', text: 'Choice A' },
      { id: 'B', text: 'Choice B' },
      { id: 'C', text: 'Choice C' },
      { id: 'D', text: 'Choice D' }
    ],
    correct: 'C',
    choice_ratings: { A: 'good', B: 'good', C: 'excellent', D: 'good' },
    educational_note: 'Test note'
  })),
  generateSingleQuestion: vi.fn().mockResolvedValue({
    scenario: 'Test scenario',
    question: 'Test question?',
    choices: [
      { id: 'A', text: 'Choice A' },
      { id: 'B', text: 'Choice B' },
      { id: 'C', text: 'Choice C' },
      { id: 'D', text: 'Choice D' }
    ],
    correct: 'C',
    choice_ratings: { A: 'good', B: 'good', C: 'excellent', D: 'good' },
    educational_note: 'Test note'
  }),
  DAY_THEMES: {
    1: 'Day 1', 2: 'Day 2', 3: 'Day 3',
    4: 'Day 4', 5: 'Day 5', 6: 'Day 6', 7: 'Day 7'
  }
}));

let script;

beforeAll(async () => {
  document.body.innerHTML = `
    <div id="sidebar-score">50</div>
    <div id="sidebar-day">1</div>
    <div class="screen active" id="screen-landing"></div>
    <div class="screen" id="screen-loading"></div>
    <div class="screen" id="screen-game"></div>
    <div class="screen" id="screen-game-over"></div>
    <div class="screen" id="screen-day-transition"></div>
    <div id="briefing-modal">
      <div id="briefing-virus-name"></div>
      <div id="briefing-scenario"></div>
      <div id="briefing-classification"></div>
      <div id="briefing-transmission"></div>
      <div id="briefing-mortality"></div>
      <div id="briefing-incubation"></div>
      <div id="briefing-location"></div>
      <div id="briefing-symptoms"></div>
      <div id="briefing-cases"></div>
      <div id="briefing-mission"></div>
    </div>
    <div id="feedback-modal">
      <div id="feedback-loading"></div>
      <div id="feedback-content"></div>
      <div id="feedback-result"></div>
      <div id="feedback-score"></div>
      <div id="feedback-text"></div>
      <div id="feedback-effect"></div>
    </div>
    <div id="how-to-play-modal"></div>
    <div id="trans-day-big"></div>
    <div id="trans-day-info"></div>
    <div id="trans-day-tips"></div>
    <div id="outcome-title"></div>
    <div id="outcome-headline"></div>
    <div id="outcome-score-display"></div>
    <div id="eval-text"></div>
    <div id="eval-lists"></div>
    <div id="real-virus-name"></div>
    <div id="virus-info-text"></div>
    <div id="gameover-loading" style="display:block"></div>
    <div id="gameover-content" style="display:none"></div>
    <div id="question-loading"></div>
    <div id="question-content"></div>
    <div id="question-header"></div>
    <div id="scenario-text"></div>
    <div id="question-text"></div>
    <div id="edu-note"></div>
    <div id="choices-container"></div>
    <div id="tip-symptoms"></div>
    <div id="tip-transmission"></div>
    <div id="tip-mortality"></div>
    <div id="day-dots">
      <div class="day-dot"></div><div class="day-dot"></div><div class="day-dot"></div>
      <div class="day-dot"></div><div class="day-dot"></div><div class="day-dot"></div>
      <div class="day-dot"></div>
    </div>
    <div id="q-dots">
      <div class="q-dot"></div><div class="q-dot"></div><div class="q-dot"></div>
    </div>
    <div id="chat-popup" aria-hidden="true">
      <div id="chat-popup-header"></div>
      <div id="chat-messages"></div>
      <div id="chat-empty-state" style="display:block"></div>
      <input id="chat-input" />
      <button class="chat-send"></button>
      <button id="chat-mic-btn"></button>
    </div>
  `;

  script = await import('../public/script.js');
});

beforeEach(() => {
  script.restartGame();
});

describe('Screen Navigation', () => {
  test('showScreen activates the target screen', () => {
    script.showScreen('game');
    expect(document.getElementById('screen-game').classList.contains('active')).toBe(true);
  });

  test('showScreen removes active from all other screens', () => {
    script.showScreen('game');
    expect(document.getElementById('screen-landing').classList.contains('active')).toBe(false);
    expect(document.getElementById('screen-loading').classList.contains('active')).toBe(false);
  });

  test('showScreen can switch between screens', () => {
    script.showScreen('game');
    script.showScreen('landing');
    expect(document.getElementById('screen-landing').classList.contains('active')).toBe(true);
    expect(document.getElementById('screen-game').classList.contains('active')).toBe(false);
  });
});

describe('Score Management', () => {
  test('updateScore sets score in DOM', () => {
    script.updateScore(75);
    expect(document.getElementById('sidebar-score').textContent).toBe('75');
  });

  test('updateScore clamps score to 0 minimum', () => {
    script.updateScore(-50);
    expect(document.getElementById('sidebar-score').textContent).toBe('0');
  });

  test('updateScore clamps score to 100 maximum', () => {
    script.updateScore(150);
    expect(document.getElementById('sidebar-score').textContent).toBe('100');
  });
});

describe('Briefing Modal', () => {
  test('openBriefing adds open class', () => {
    script.openBriefing();
    expect(document.getElementById('briefing-modal').classList.contains('open')).toBe(true);
  });

  test('closeBriefing removes open class', () => {
    script.openBriefing();
    script.closeBriefing();
    expect(document.getElementById('briefing-modal').classList.contains('open')).toBe(false);
  });

  test('populateBriefing fills all briefing fields', () => {
    const virusData = {
      virus_name: 'TestVirus', scenario: 'Test scenario',
      classification: 'Filoviridae', transmission: 'Air',
      mortality_rate: '50%', incubation_period: '5-10 days',
      location: 'City', initial_cases: '10',
      symptoms: ['fever', 'cough'], day1_briefing: 'Stop it.'
    };
    script.populateBriefing(virusData);
    expect(document.getElementById('briefing-virus-name').textContent).toBe('TESTVIRUS');
    expect(document.getElementById('briefing-scenario').textContent).toBe('Test scenario');
    expect(document.getElementById('briefing-symptoms').textContent).toBe('fever • cough');
  });
});

describe('How To Play Modal', () => {
  test('openHowToPlay adds open class', () => {
    script.openHowToPlay();
    expect(document.getElementById('how-to-play-modal').classList.contains('open')).toBe(true);
  });

  test('closeHowToPlay removes open class', () => {
    script.openHowToPlay();
    script.closeHowToPlay();
    expect(document.getElementById('how-to-play-modal').classList.contains('open')).toBe(false);
  });
});

describe('Chat', () => {
  test('getChatContext returns initial state fields', () => {
    const ctx = script.getChatContext();
    expect(ctx).toHaveProperty('day');
    expect(ctx).toHaveProperty('score');
    expect(ctx).toHaveProperty('history');
  });

  test('getChatContext score matches initial state', () => {
    const ctx = script.getChatContext();
    expect(ctx.score).toBe(50);
  });

  test('addChatMessage adds user message to DOM', () => {
    script.addChatMessage('user', 'Hello');
    const messages = document.querySelectorAll('.chat-message');
    expect(messages.length).toBeGreaterThan(0);
  });

  test('addChatMessage shows correct role label', () => {
    script.addChatMessage('user', 'Hello');
    const role = document.querySelector('.chat-message-role');
    expect(role.textContent).toBe('You');
  });

  test('renderChatMessages hides empty state when messages exist', () => {
    script.addChatMessage('user', 'Hello');
    const emptyState = document.getElementById('chat-empty-state');
    expect(emptyState.style.display).toBe('none');
  });

  test('openChatPopup adds open class', () => {
    script.openChatPopup();
    expect(document.getElementById('chat-popup').classList.contains('open')).toBe(true);
  });

  test('closeChatPopup removes open class', () => {
    script.openChatPopup();
    script.closeChatPopup();
    expect(document.getElementById('chat-popup').classList.contains('open')).toBe(false);
  });
});

describe('Day Dots', () => {
  test('initDayDots assigns IDs to day dots', () => {
    script.initDayDots();
    expect(document.getElementById('day-dot-1')).not.toBeNull();
    expect(document.getElementById('day-dot-7')).not.toBeNull();
  });

  test('initDayDots assigns IDs to question dots', () => {
    script.initDayDots();
    expect(document.getElementById('q-dot-1')).not.toBeNull();
    expect(document.getElementById('q-dot-3')).not.toBeNull();
  });

  test('initDayDots marks day 1 dot as current', () => {
    script.initDayDots();
    expect(document.getElementById('day-dot-1').className).toContain('current');
  });
});

describe('Render Question', () => {
  test('renderQuestion populates question text', () => {
    const q = {
      scenario: 'A virus is spreading.',
      question: 'What do you do?',
      educational_note: 'Wash hands.',
      choices: [{ id: 'A', text: 'Isolate' }]
    };
    script.renderQuestion(q);
    expect(document.getElementById('question-text').textContent).toBe('What do you do?');
    expect(document.getElementById('scenario-text').textContent).toBe('A virus is spreading.');
  });

  test('renderQuestion creates choice elements', () => {
    const q = {
      scenario: 'Scenario',
      question: 'Question?',
      educational_note: 'Note.',
      choices: [
        { id: 'A', text: 'Choice A' },
        { id: 'B', text: 'Choice B' }
      ]
    };
    script.renderQuestion(q);
    expect(document.querySelectorAll('.choice-box').length).toBe(2);
  });
});

describe('Game Restart', () => {
  test('restartGame resets state score to 50', () => {
    script.updateScore(80);
    script.restartGame();
    expect(script.getChatContext().score).toBe(50);
  });

  test('restartGame shows landing screen', () => {
    script.showScreen('game-over');
    script.restartGame();
    expect(document.getElementById('screen-landing').classList.contains('active')).toBe(true);
  });
});

describe('Populate Sidebar', () => {
  test('populateSidebar fills symptoms, transmission, and mortality fields', () => {
    script.state.virusData = {
      symptoms: ['fever', 'cough', 'fatigue'],
      transmission: 'Airborne droplets',
      mortality_rate: '45%'
    };
    script.populateSidebar();
    expect(document.getElementById('tip-symptoms').textContent).toBe('fever, cough, fatigue');
    expect(document.getElementById('tip-transmission').textContent).toBe('Airborne droplets');
    expect(document.getElementById('tip-mortality').textContent).toBe('45%');
  });
});

describe('Update Dots', () => {
  test('updateDots updates the sidebar day number', () => {
    script.initDayDots();
    script.state.day = 3;
    script.updateDots();
    expect(document.getElementById('sidebar-day').textContent).toBe('3');
  });

  test('updateDots marks the current day dot as current and prior days as done', () => {
    script.initDayDots();
    script.state.day = 2;
    script.updateDots();
    expect(document.getElementById('day-dot-2').className).toContain('current');
    expect(document.getElementById('day-dot-1').className).toContain('done');
    expect(document.getElementById('day-dot-3').className).not.toContain('done');
    expect(document.getElementById('day-dot-3').className).not.toContain('current');
  });

  test('updateDots marks the current question dot as current', () => {
    script.initDayDots();
    script.state.questionNum = 2;
    script.updateDots();
    expect(document.getElementById('q-dot-2').className).toContain('current');
    expect(document.getElementById('q-dot-1').className).toContain('done');
  });
});

describe('Reset Chat Position', () => {
  test('resetChatPopupPosition clears all position styles', () => {
    const popup = document.getElementById('chat-popup');
    popup.style.left = '200px';
    popup.style.top = '100px';
    script.resetChatPopupPosition();
    expect(popup.style.left).toBe('');
    expect(popup.style.top).toBe('');
    expect(popup.style.right).toBe('');
    expect(popup.style.bottom).toBe('');
  });
});

describe('getChatContext with virusData', () => {
  test('getChatContext returns virus fields when virusData is set', () => {
    script.state.virusData = {
      virus_name: 'NebulaVirus',
      real_virus: 'Ebola',
      transmission: 'Direct contact',
      symptoms: ['fever', 'hemorrhage'],
      location: 'Kinshasa'
    };
    const ctx = script.getChatContext();
    expect(ctx.virus_name).toBe('NebulaVirus');
    expect(ctx.real_virus).toBe('Ebola');
    expect(ctx.transmission).toBe('Direct contact');
    expect(ctx).toHaveProperty('current_question');
  });

  test('getChatContext includes score and day when virusData is set', () => {
    script.state.virusData = {
      virus_name: 'NebulaVirus', real_virus: 'Ebola',
      transmission: 'Contact', symptoms: [], location: 'City'
    };
    script.updateScore(70);
    const ctx = script.getChatContext();
    expect(ctx.score).toBe(70);
    expect(ctx.day).toBe(1);
  });
});

describe('Select Choice', () => {
  test('selectChoice sets selectedChoice in state', () => {
    const q = {
      scenario: 'Scenario',
      question: 'Question?',
      educational_note: 'Note.',
      choices: [
        { id: 'A', text: 'Choice A' },
        { id: 'B', text: 'Choice B' }
      ],
      choice_ratings: { A: 'excellent', B: 'poor' }
    };
    script.renderQuestion(q);
    script.state.currentQuestion = q;
    const box = document.querySelector('.choice-box');
    script.selectChoice('A', box);
    expect(script.state.selectedChoice).toBe('A');
  });

  test('selectChoice opens the feedback modal', () => {
    const q = {
      scenario: 'Scenario',
      question: 'Question?',
      educational_note: 'Note.',
      choices: [{ id: 'A', text: 'Choice A' }],
      choice_ratings: { A: 'good' }
    };
    script.renderQuestion(q);
    script.state.currentQuestion = q;
    const box = document.querySelector('.choice-box');
    script.selectChoice('A', box);
    expect(document.getElementById('feedback-modal').classList.contains('open')).toBe(true);
  });

  test('selectChoice adds selected class to the clicked box', () => {
    const q = {
      scenario: 'Scenario',
      question: 'Question?',
      educational_note: 'Note.',
      choices: [
        { id: 'A', text: 'Choice A' },
        { id: 'B', text: 'Choice B' }
      ],
      choice_ratings: { A: 'good', B: 'poor' }
    };
    script.renderQuestion(q);
    script.state.currentQuestion = q;
    const box = document.querySelector('.choice-box');
    script.selectChoice('A', box);
    expect(box.classList.contains('selected')).toBe(true);
  });

  test('selectChoice does nothing if a choice is already selected', () => {
    const q = {
      scenario: 'Scenario',
      question: 'Question?',
      educational_note: 'Note.',
      choices: [
        { id: 'A', text: 'Choice A' },
        { id: 'B', text: 'Choice B' }
      ],
      choice_ratings: { A: 'good', B: 'poor' }
    };
    script.renderQuestion(q);
    script.state.currentQuestion = q;
    const boxes = document.querySelectorAll('.choice-box');
    script.selectChoice('A', boxes[0]);
    script.selectChoice('B', boxes[1]);
    expect(script.state.selectedChoice).toBe('A');
  });
});

describe('Dismiss Feedback', () => {
  test('dismissFeedback closes the feedback modal', () => {
    document.getElementById('feedback-modal').classList.add('open');
    script.dismissFeedback();
    expect(document.getElementById('feedback-modal').classList.contains('open')).toBe(false);
  });

  test('dismissFeedback increments questionNum when not the last question of the day', () => {
    script.dismissFeedback();
    expect(script.state.questionNum).toBe(2);
  });

  test('dismissFeedback shows day-transition screen when question 3 of a non-final day is answered', () => {
    script.state.questionNum = 3;
    script.state.day = 1;
    script.dismissFeedback();
    expect(document.getElementById('screen-day-transition').classList.contains('active')).toBe(true);
  });

  test('dismissFeedback advances day and resets questionNum after day transition', () => {
    script.state.questionNum = 3;
    script.state.day = 2;
    script.dismissFeedback();
    expect(script.state.day).toBe(3);
    expect(script.state.questionNum).toBe(1);
  });

  test('dismissFeedback shows game-over screen on day 7 question 3', () => {
    script.state.day = 7;
    script.state.questionNum = 3;
    script.dismissFeedback();
    expect(document.getElementById('screen-game-over').classList.contains('active')).toBe(true);
  });
});