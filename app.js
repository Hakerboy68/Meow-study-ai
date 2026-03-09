/* =========================================
   STATE.JS — Global State & Persistence
   ========================================= */

const AppState = {
  user: null,
  theme: 'cyber',
  currentPage: 'dashboard',
  doubtHistory: [],
  speechHistory: [],
  papers: [],
  stats: {
    doubts: 0,
    papers: 0,
    accuracies: [],
    streak: 1,
    lastActiveDate: null
  },
  analytics: {
    subjects: {
      Mathematics: 65,
      Physics: 72,
      Chemistry: 58,
      Biology: 80,
      English: 75,
      History: 62,
      Geography: 70
    }
  }
};

function saveState() {
  try {
    localStorage.setItem('ns_state_v2', JSON.stringify(AppState));
  } catch (e) {
    console.warn('Could not save state:', e);
  }
}

function loadState() {
  try {
    const raw = localStorage.getItem('ns_state_v2');
    if (raw) {
      const saved = JSON.parse(raw);
      Object.assign(AppState, saved);
    }
  } catch (e) {
    console.warn('Could not load state:', e);
  }
}

function updateStreak() {
  const today = new Date().toDateString();
  if (AppState.stats.lastActiveDate !== today) {
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    if (AppState.stats.lastActiveDate === yesterday) {
      AppState.stats.streak = (AppState.stats.streak || 1) + 1;
    } else if (AppState.stats.lastActiveDate !== today) {
      AppState.stats.streak = 1;
    }
    AppState.stats.lastActiveDate = today;
    saveState();
  }
}
/* =========================================
   API.JS — Frontend calls OUR Netlify proxy.
   No API key ever touches the browser.
   ========================================= */

const PROXY_URL = "/.netlify/functions/ai";

async function callAI(systemPrompt, userMessage, history = []) {
  const messages = [
    ...history.map(h => ({ role: h.role, content: h.content })),
    { role: "user", content: userMessage }
  ];

  const resp = await fetch(PROXY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ system: systemPrompt, messages })
  });

  const data = await resp.json();

  if (!resp.ok) {
    throw new Error(data?.error || "Server error " + resp.status);
  }

  return data.text;
}

/* ============================================================
   SYSTEM PROMPTS
   ============================================================ */

function getDoubtSystemPrompt(board, cls, subject) {
  return `You are NeuralStudy AI, an expert academic tutor for Indian students.

Context:
- Board: ${board}
- Class: ${cls}
- Subject: ${subject}

For every question format your answer exactly like this:

🎯 **Core Concept**
[1-2 sentence summary]

📋 **Step-by-Step Explanation**
1. [step]
2. [step]
3. [step]

💡 **Simple Analogy**
[Easy memorable comparison]

📚 **${board} Board Example**
[Exam-style example relevant to ${board} pattern]

⭐ **Key Points to Remember**
• [point]
• [point]
• [point]

🔗 **Related Topics**
[2-3 topic suggestions for deeper study]

Rules:
- Be warm, encouraging, and precise
- Adapt difficulty to ${cls} level
- Never give harmful or off-topic content
- If confused, simplify. If advanced, go deeper.`;
}

function getDictationSystemPrompt() {
  return `You are an expert dictation evaluator using semantic analysis.

Compare student dictation to original text using MEANING, not just exact words.

Always respond in this EXACT format:

ACCURACY: [0-100]%

MISTAKES:
- [Spelling Error / Concept Gap / Omission / Addition / Grammar]: [specific description]
(write "None detected" if perfect)

STRENGTHS:
[What the student did well — be specific]

FEEDBACK:
[2-3 sentences of warm, constructive feedback]

TIPS:
[1-2 practical improvement suggestions]`;
}

function getPaperSystemPrompt() {
  return `You are an expert Indian board examination question paper generator.

Generate a complete, properly formatted exam paper.

PAPER FORMAT:
═══════════════════════════════════
[SCHOOL NAME] | [SUBJECT] | [CLASS]
Time: [X] Hours | Maximum Marks: [X]
General Instructions: ...
═══════════════════════════════════

SECTION A – Multiple Choice Questions (1 Mark Each)
Q1. [question]
(a) [option]  (b) [option]  (c) [option]  (d) [option]

SECTION B – Short Answer Questions
Q6. [question] [2/3 Marks]

SECTION C – Long Answer Questions
Q11. [question] [5/6 Marks]

SECTION D – Case Study / Application (if marks allow)

Rules:
- All questions must be board-aligned and age-appropriate
- Marks must add up exactly to the total specified
- Include all general instructions
- Questions must cover the specified chapter/topic thoroughly`;
}

function getSpeechSystemPrompt() {
  return `You are NeuralStudy's real-time Speech AI Tutor.

Style:
- Warm, conversational, natural (optimized for text-to-speech)
- Medium-length responses — detailed but speakable
- Use encouraging language
- Reference previous conversation when relevant
- End with a follow-up question to check understanding

You can teach any subject at any level. Never refuse a legitimate academic question.`;
}
/* =========================================
   UI.JS — UI Helpers, Toasts, Chat Rendering
   ========================================= */

/** Show a toast notification */
function toast(message, type = '') {
  const container = document.getElementById('toasts');
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 320);
  }, 3200);
}

/** Format AI markdown-lite to HTML */
function formatMessage(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code>$1</code>')
    .replace(/^### (.+)$/gm, '<strong style="font-size:0.95em;display:block;margin-top:8px">$1</strong>')
    .replace(/^## (.+)$/gm,  '<strong style="font-size:1em;display:block;margin-top:10px;color:var(--accent)">$1</strong>')
    .replace(/^• /gm, '&bull; ')
    .replace(/\n/g, '<br>');
}

/** Append a message bubble to a chat window */
function addMsg(chatId, role, text) {
  const chat = document.getElementById(chatId);
  if (!chat) return;
  const div = document.createElement('div');
  div.className = 'msg ' + role;
  const emoji = role === 'user' ? '👤' : '🧠';
  div.innerHTML = `
    <div class="msg-avatar">${emoji}</div>
    <div class="msg-bubble">${formatMessage(text)}</div>
  `;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
  return div;
}

/** Add typing indicator and return its ID for removal */
function addTyping(chatId) {
  const chat = document.getElementById(chatId);
  if (!chat) return null;
  const id = 'typing-' + Date.now();
  const div = document.createElement('div');
  div.className = 'msg ai';
  div.id = id;
  div.innerHTML = `
    <div class="msg-avatar">🧠</div>
    <div class="msg-bubble">
      <div class="typing-indicator">
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
      </div>
    </div>
  `;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
  return id;
}

/** Remove typing indicator by ID */
function removeTyping(typingId) {
  if (!typingId) return;
  const el = document.getElementById(typingId);
  if (el) el.remove();
}

/** Update all dashboard stat counters */
function updateStats() {
  const el = id => document.getElementById(id);
  if (el('stat-doubts'))   el('stat-doubts').textContent   = AppState.stats.doubts;
  if (el('stat-papers'))   el('stat-papers').textContent   = AppState.stats.papers;
  const accs = AppState.stats.accuracies;
  if (el('stat-accuracy')) el('stat-accuracy').textContent = accs.length
    ? Math.round(accs.reduce((a,b) => a+b, 0) / accs.length) + '%'
    : '—';
  const streak = AppState.stats.streak || 1;
  if (el('stat-streak')) el('stat-streak').textContent = streak + ' day' + (streak > 1 ? 's' : '');
}

/** Set user info in topbar and dashboard */
function updateUserUI() {
  const name = AppState.user?.name || 'Student';
  const els = {
    userName:    document.getElementById('userName'),
    dashName:    document.getElementById('dashName'),
    userInitial: document.getElementById('userInitial')
  };
  if (els.userName)    els.userName.textContent    = name;
  if (els.dashName)    els.dashName.textContent    = name.toUpperCase();
  if (els.userInitial) els.userInitial.textContent = name.charAt(0).toUpperCase();
}

/** Rotate daily motivation quotes */
const MOTIVATIONS = [
  '"Success is not about how much you study, but how smartly you study. With AI by your side, every session compounds your knowledge exponentially."',
  '"Every expert was once a beginner. Your doubts today are your strengths tomorrow. Keep asking, keep growing."',
  '"The brain is like a muscle — the more you challenge it, the stronger and faster it gets. Today\'s confusion is tomorrow\'s clarity."',
  '"Consistency beats intensity. Study smart every single day and watch the magic of compounding unfold."',
  '"Ask questions fearlessly. The only bad question is the one never asked. Curiosity is the engine of achievement."',
  '"Small progress every day adds up to big results. You are closer to your goal than you think. Keep going!"',
  '"Your future self will thank you for studying today. Every hour of focus now is an investment in your dream."'
];

function setDailyMotivation() {
  const el = document.getElementById('motivationMsg');
  if (el) {
    const idx = new Date().getDay() % MOTIVATIONS.length;
    el.textContent = MOTIVATIONS[idx];
  }
}

/** Initialize particles background */
function initParticles() {
  const container = document.getElementById('particles');
  if (!container) return;
  for (let i = 0; i < 28; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    p.style.left     = Math.random() * 100 + 'vw';
    p.style.width    = p.style.height = (1 + Math.random() * 3) + 'px';
    p.style.animationDuration = (8 + Math.random() * 14) + 's';
    p.style.animationDelay   = (Math.random() * 12) + 's';
    container.appendChild(p);
  }
}
/* =========================================
   AUTH.JS — Authentication Logic
   ========================================= */

function switchAuthTab(tab) {
  document.querySelectorAll('.auth-tab').forEach((btn, i) => {
    btn.classList.toggle('active', ['login', 'register'][i] === tab);
  });
  document.getElementById('login-form').classList.toggle('hidden', tab !== 'login');
  document.getElementById('register-form').classList.toggle('hidden', tab !== 'register');
}

function doLogin() {
  const email = document.getElementById('login-email').value.trim();
  const pass  = document.getElementById('login-pass').value;

  if (!email || !email.includes('@')) {
    toast('Please enter a valid email address', 'error'); return;
  }
  if (pass.length < 6) {
    toast('Password must be at least 6 characters', 'error'); return;
  }

  const rawName = email.split('@')[0].replace(/[^a-zA-Z\s]/g, '') || 'Student';
  const name = rawName.charAt(0).toUpperCase() + rawName.slice(1);

  AppState.user = { email, name, board: 'CBSE', class: 'Class 10' };
  saveState();
  updateStreak();
  toast('Welcome back, ' + name + '! 🎓', 'success');
  showApp();
}

function doRegister() {
  const name  = document.getElementById('reg-name').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const pass  = document.getElementById('reg-pass').value;
  const board = document.getElementById('reg-board').value;
  const cls   = document.getElementById('reg-class').value;

  if (!name)                  { toast('Please enter your full name', 'error'); return; }
  if (!email.includes('@'))   { toast('Please enter a valid email', 'error'); return; }
  if (pass.length < 6)        { toast('Password must be 6+ characters', 'error'); return; }

  AppState.user = { email, name, board, class: cls };
  AppState.stats.streak = 1;
  saveState();
  toast('Account created! Welcome, ' + name + '! 🎓', 'success');
  showApp();
}

function doLogout() {
  if (!confirm('Are you sure you want to logout?')) return;
  AppState.user = null;
  saveState();
  document.getElementById('app').classList.remove('active');
  showAuth();
}

function showAuth() {
  document.getElementById('auth-page').classList.add('active');
}

function showApp() {
  document.getElementById('auth-page').classList.remove('active');
  document.getElementById('app').classList.add('active');
  updateUserUI();
  updateStats();
  renderAnalytics();
  renderPaperHistory();
  setDailyMotivation();
  setTheme(AppState.theme || 'cyber');
}

function showAuthOrApp() {
  if (AppState.user) {
    showApp();
  } else {
    showAuth();
  }
}
/* =========================================
   THEME.JS — Theme Switching
   ========================================= */

function setTheme(theme) {
  AppState.theme = theme;

  // Remove all theme classes
  document.body.classList.remove('theme-dark', 'theme-light');

  // Apply new theme
  if (theme === 'dark')  document.body.classList.add('theme-dark');
  if (theme === 'light') document.body.classList.add('theme-light');
  // 'cyber' is default (no class needed)

  // Update active button
  document.querySelectorAll('.theme-btn').forEach(btn => btn.classList.remove('active'));
  const activeBtn = document.getElementById('tbtn-' + theme);
  if (activeBtn) activeBtn.classList.add('active');

  saveState();
}
/* =========================================
   NAVIGATION.JS — SPA Page Routing
   ========================================= */

function showPage(page) {
  // Hide all pages
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));

  // Deactivate all nav tabs
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));

  // Activate target page
  const target = document.getElementById('page-' + page);
  if (target) target.classList.add('active');

  // Activate nav tab
  const tab = document.querySelector(`.nav-tab[data-page="${page}"]`);
  if (tab) tab.classList.add('active');

  AppState.currentPage = page;

  // Scroll to top on mobile
  window.scrollTo({ top: 0, behavior: 'smooth' });

  // Page-specific init
  if (page === 'analytics') renderAnalytics();
  if (page === 'papers')    renderPaperHistory();
}
/* =========================================
   DOUBT.JS — Ultra Reasoning Doubt Engine
   ========================================= */

async function sendDoubt() {
  const input   = document.getElementById('doubt-input');
  const sendBtn = document.getElementById('doubt-send-btn');
  const msg     = input.value.trim();
  if (!msg) return;

  const board   = document.getElementById('board-select').value;
  const cls     = document.getElementById('class-select').value;
  const subject = document.getElementById('subject-select').value;

  input.value = '';
  input.style.height = 'auto';
  sendBtn.disabled = true;
  sendBtn.innerHTML = '<span class="spinner"></span>';

  addMsg('doubt-chat', 'user', msg);
  const typingId = addTyping('doubt-chat');

  try {
    const system = getDoubtSystemPrompt(board, cls, subject);
    const reply  = await callAI(system, msg, AppState.doubtHistory.slice(-10));

    removeTyping(typingId);
    addMsg('doubt-chat', 'ai', reply);

    // Update history & stats
    AppState.doubtHistory.push(
      { role: 'user',      content: msg   },
      { role: 'assistant', content: reply }
    );
    // Keep history manageable
    if (AppState.doubtHistory.length > 40) {
      AppState.doubtHistory = AppState.doubtHistory.slice(-40);
    }

    AppState.stats.doubts++;

    // Update analytics — increment subject score slightly
    if (AppState.analytics.subjects[subject] !== undefined) {
      AppState.analytics.subjects[subject] = Math.min(
        100,
        AppState.analytics.subjects[subject] + 1
      );
    }

    updateStats();
    saveState();

  } catch (err) {
    removeTyping(typingId);
    addMsg('doubt-chat', 'ai',
      `⚠️ **Connection Error**\n\n${err.message}\n\nPlease check your internet connection and try again.`
    );
  }

  sendBtn.disabled = false;
  sendBtn.innerHTML = 'SEND ▶';
  input.focus();
}

function clearDoubtChat() {
  const chat = document.getElementById('doubt-chat');
  chat.innerHTML = '';
  AppState.doubtHistory = [];
  saveState();
  addMsg('doubt-chat', 'ai', '🧠 Chat cleared! Ready for your next doubt. Select your board and class above, then ask away!');
}

/* ---- VOICE INPUT FOR DOUBT ---- */
let voiceRecognition = null;
let voiceActive = false;

function toggleVoiceInput() {
  if (voiceActive) {
    stopVoiceInput();
    return;
  }

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    toast('Voice input requires Google Chrome browser', 'error');
    return;
  }

  voiceRecognition = new SR();
  voiceRecognition.lang = 'en-IN';
  voiceRecognition.continuous = false;
  voiceRecognition.interimResults = true;

  voiceRecognition.onresult = (e) => {
    const transcript = Array.from(e.results).map(r => r[0].transcript).join('');
    document.getElementById('doubt-input').value = transcript;
    if (e.results[e.results.length - 1].isFinal) {
      stopVoiceInput();
    }
  };

  voiceRecognition.onerror = () => stopVoiceInput();
  voiceRecognition.onend   = () => stopVoiceInput();

  voiceRecognition.start();
  voiceActive = true;
  document.getElementById('voice-doubt-btn').classList.add('recording');
  toast('🎤 Listening... Speak your doubt', 'info');
}

function stopVoiceInput() {
  if (voiceRecognition) {
    try { voiceRecognition.stop(); } catch (_) {}
  }
  voiceActive = false;
  const btn = document.getElementById('voice-doubt-btn');
  if (btn) btn.classList.remove('recording');
}

/* Auto-resize textarea */
document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('doubt-input');
  if (input) {
    input.addEventListener('input', () => {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 140) + 'px';
    });
  }
});
/* =========================================
   DICTATION.JS — Intelligent Dictation System
   ========================================= */

let ttsUtterance = null;
let ttsPlaying   = false;

/* ---- FILE UPLOAD ---- */
function handleDictFile(event) {
  const file = event.target.files[0];
  if (!file) return;

  if (file.type === 'text/plain' || file.name.endsWith('.txt') || file.name.endsWith('.md')) {
    const reader = new FileReader();
    reader.onload = (e) => {
      document.getElementById('tts-text').value = e.target.result;
      toast('File loaded successfully! ✅', 'success');
    };
    reader.readAsText(file);
  } else {
    toast('Please upload a .txt or .md file. For PDFs, copy-paste the text.', 'error');
  }
}

function handleDictDrop(event) {
  event.preventDefault();
  document.getElementById('dict-upload').classList.remove('drag');
  const file = event.dataTransfer.files[0];
  if (file) {
    const inp = document.getElementById('dict-file');
    const dt  = new DataTransfer();
    dt.items.add(file);
    inp.files = dt.files;
    handleDictFile({ target: inp });
  }
}

/* ---- TEXT TO SPEECH ---- */
function toggleTTS() {
  const text = document.getElementById('tts-text').value.trim();
  if (!text) {
    toast('Please enter or paste content to read first', 'error');
    return;
  }

  if (ttsPlaying) {
    stopTTS();
    return;
  }

  const speed = parseFloat(document.getElementById('tts-speed').value);

  ttsUtterance = new SpeechSynthesisUtterance(text);
  ttsUtterance.rate = speed;
  ttsUtterance.lang = 'en-IN';

  ttsUtterance.onend = () => {
    ttsPlaying = false;
    updateTTSBtn();
    toast('Reading complete! Now type what you heard below. ✍️', 'info');
  };

  ttsUtterance.onerror = () => {
    ttsPlaying = false;
    updateTTSBtn();
  };

  window.speechSynthesis.speak(ttsUtterance);
  ttsPlaying = true;
  updateTTSBtn();
}

function stopTTS() {
  window.speechSynthesis.cancel();
  ttsPlaying = false;
  updateTTSBtn();
}

function updateTTSBtn() {
  const btn = document.getElementById('tts-play-btn');
  if (btn) {
    btn.textContent = ttsPlaying ? '⏸ Pause' : '▶ Play';
    btn.classList.toggle('active', !ttsPlaying);
  }
}

/* Speed slider listener */
document.addEventListener('DOMContentLoaded', () => {
  const slider = document.getElementById('tts-speed');
  const label  = document.getElementById('speed-label');
  if (slider) {
    slider.addEventListener('input', () => {
      label.textContent = slider.value + 'x';
      if (ttsPlaying) {
        // Restart with new speed
        const text = document.getElementById('tts-text').value;
        stopTTS();
        setTimeout(() => {
          document.getElementById('tts-text').value = text;
          toggleTTS();
        }, 100);
      }
    });
  }
});

/* ---- AI ANALYSIS ---- */
async function analyzeDictation() {
  const original = document.getElementById('tts-text').value.trim();
  const userText = document.getElementById('user-dictation').value.trim();
  const btn      = document.getElementById('analyze-btn');

  if (!original) { toast('Please add the original content first', 'error'); return; }
  if (!userText)  { toast('Please type your dictation before analyzing', 'error'); return; }

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Analyzing...';

  const prompt = `Analyze this student dictation attempt:

ORIGINAL TEXT:
"""
${original}
"""

STUDENT'S DICTATION:
"""
${userText}
"""

Evaluate using semantic similarity, not just exact word matching.`;

  try {
    const result = await callAI(getDictationSystemPrompt(), prompt);

    // Parse accuracy
    const accMatch = result.match(/ACCURACY:\s*(\d+)/i);
    const accuracy = accMatch ? Math.min(100, Math.max(0, parseInt(accMatch[1]))) : 70;

    // Show feedback
    const feedbackEl = document.getElementById('dict-feedback');
    feedbackEl.classList.remove('hidden');

    document.getElementById('acc-fill').style.width = accuracy + '%';

    const tag = accuracy >= 85
      ? '<span class="tag tag-green">Excellent</span>'
      : accuracy >= 65
        ? '<span class="tag tag-yellow">Good</span>'
        : '<span class="tag tag-red">Needs Practice</span>';

    document.getElementById('acc-score').innerHTML =
      `<strong style="color:var(--accent);font-size:1.1rem">${accuracy}%</strong> Accuracy — ${tag}`;

    document.getElementById('dict-feedback-text').innerHTML =
      result.replace(/\n/g, '<br>');

    // Save stat
    AppState.stats.accuracies.push(accuracy);
    updateStats();
    saveState();

    feedbackEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  } catch (err) {
    toast('Analysis error: ' + err.message, 'error');
  }

  btn.disabled = false;
  btn.innerHTML = 'ANALYZE ACCURACY 🔍';
}
/* =========================================
   PAPERS.JS — Dynamic Question Paper Generator
   ========================================= */

async function generatePaper() {
  const board       = document.getElementById('paper-board').value;
  const cls         = document.getElementById('paper-class').value;
  const subject     = document.getElementById('paper-subject').value;
  const chapter     = document.getElementById('paper-chapter').value || 'General / Mixed Topics';
  const difficulty  = document.getElementById('paper-difficulty').value;
  const marks       = document.getElementById('paper-marks').value;
  const instructions= document.getElementById('paper-instructions').value;
  const btn         = document.getElementById('gen-paper-btn');

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Generating Paper...';

  const prompt = `Generate a complete ${marks}-mark ${difficulty} difficulty question paper with the following details:

Board: ${board}
Class: ${cls}
Subject: ${subject}
Chapter / Topic: ${chapter}
Total Marks: ${marks}
Difficulty Level: ${difficulty}
Special Instructions: ${instructions || 'Standard exam format'}

Follow the exact ${board} examination pattern and formatting conventions.
Include all sections as specified and ensure marks add up to ${marks}.`;

  try {
    const paper = await callAI(getPaperSystemPrompt(), prompt);

    const outputEl = document.getElementById('paper-output');
    outputEl.textContent = paper;
    outputEl.classList.remove('hidden');

    document.getElementById('paper-actions').classList.remove('hidden');

    // Save to history
    const entry = {
      board, cls, subject, chapter, marks, difficulty, paper,
      date: new Date().toLocaleDateString('en-IN')
    };
    AppState.papers.unshift(entry);
    if (AppState.papers.length > 10) AppState.papers = AppState.papers.slice(0, 10);

    AppState.stats.papers++;
    updateStats();
    renderPaperHistory();
    saveState();

    outputEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    toast('Question paper generated! 📄', 'success');

  } catch (err) {
    toast('Error generating paper: ' + err.message, 'error');
  }

  btn.disabled = false;
  btn.innerHTML = 'GENERATE PAPER ⚡';
}

async function generateAnswerKey() {
  const paper = document.getElementById('paper-output').textContent;
  if (!paper || paper.length < 50) {
    toast('Please generate a question paper first', 'error');
    return;
  }

  const outputEl = document.getElementById('paper-output');
  const original = outputEl.textContent;
  outputEl.textContent = '⏳ Generating answer key...';

  try {
    const answerKey = await callAI(
      'You are an expert answer key generator for Indian board examinations. Provide complete, accurate answers with detailed marking schemes and step-by-step solutions for numerical/derivation questions.',
      `Generate a complete answer key with full marking scheme for this question paper:\n\n${original}`
    );
    outputEl.textContent = answerKey;
    toast('Answer key generated! 🔑', 'success');
  } catch (err) {
    outputEl.textContent = original;
    toast('Error: ' + err.message, 'error');
  }
}

function copyPaper() {
  const text = document.getElementById('paper-output').textContent;
  if (!text) { toast('No paper to copy', 'error'); return; }
  navigator.clipboard.writeText(text)
    .then(() => toast('Copied to clipboard! 📋', 'success'))
    .catch(() => toast('Copy failed — please select and copy manually', 'error'));
}

function downloadPaper() {
  const text = document.getElementById('paper-output').textContent;
  if (!text) { toast('No paper to download', 'error'); return; }

  const board   = document.getElementById('paper-board').value;
  const subject = document.getElementById('paper-subject').value;
  const cls     = document.getElementById('paper-class').value;
  const filename = `${board}_${subject}_${cls}_Paper.txt`.replace(/\s+/g, '_');

  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  toast('Downloaded! ⬇️', 'success');
}

function loadPaper(index) {
  const entry = AppState.papers[index];
  if (!entry) return;

  document.getElementById('paper-board').value       = entry.board;
  document.getElementById('paper-class').value       = entry.cls;
  document.getElementById('paper-subject').value     = entry.subject;
  document.getElementById('paper-chapter').value     = entry.chapter;
  document.getElementById('paper-difficulty').value  = entry.difficulty;
  document.getElementById('paper-marks').value       = entry.marks;

  const outputEl = document.getElementById('paper-output');
  outputEl.textContent = entry.paper;
  outputEl.classList.remove('hidden');
  document.getElementById('paper-actions').classList.remove('hidden');

  outputEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  toast('Paper loaded from history ✅', 'success');
}

function renderPaperHistory() {
  const container = document.getElementById('paper-history');
  if (!container) return;

  if (!AppState.papers.length) {
    container.innerHTML = '<p style="color:var(--text-dim);font-size:0.85rem">No papers generated yet. Create your first paper above!</p>';
    return;
  }

  container.innerHTML = AppState.papers.map((p, i) => `
    <div class="history-item" onclick="loadPaper(${i})">
      <div>
        <div class="history-item-title">${p.subject} — ${p.chapter}</div>
        <div class="history-item-meta">${p.board} | ${p.cls} | ${p.difficulty} | ${p.marks} Marks | ${p.date}</div>
      </div>
      <div class="history-item-arrow">LOAD →</div>
    </div>
  `).join('');
}
/* =========================================
   SPEECH.JS — Real-Time Speech AI Tutor
   ========================================= */

let speechRecognition = null;
let speechActive      = false;
let speechContext     = [];   // conversation memory

/* ---- MICROPHONE TOGGLE ---- */
function toggleSpeechTutor() {
  if (speechActive) {
    stopSpeechTutor();
  } else {
    startSpeechTutor();
  }
}

function startSpeechTutor() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    toast('Speech recognition requires Google Chrome browser', 'error');
    return;
  }

  speechRecognition = new SR();
  speechRecognition.lang = 'en-IN';
  speechRecognition.continuous = false;
  speechRecognition.interimResults = true;

  speechRecognition.onresult = (e) => {
    const transcript = Array.from(e.results)
      .map(r => r[0].transcript)
      .join('');

    setSpeechStatus('🎤 Heard: "' + transcript + '"');

    if (e.results[e.results.length - 1].isFinal) {
      processSpeechInput(transcript);
    }
  };

  speechRecognition.onerror = (e) => {
    const messages = {
      'not-allowed': 'Microphone permission denied. Please allow mic access.',
      'no-speech':   'No speech detected. Please try again.',
      'network':     'Network error. Check your connection.'
    };
    toast(messages[e.error] || 'Mic error: ' + e.error, 'error');
    stopSpeechTutor();
  };

  speechRecognition.onend = () => {
    speechActive = false;
    updateMicUI();
  };

  speechRecognition.start();
  speechActive = true;
  updateMicUI();
  setSpeechStatus('🔴 Listening... Speak your question now');
}

function stopSpeechTutor() {
  if (speechRecognition) {
    try { speechRecognition.stop(); } catch (_) {}
  }
  speechActive = false;
  updateMicUI();
  setSpeechStatus('Tap the microphone to speak your doubt');
}

function updateMicUI() {
  const orb = document.getElementById('mic-orb');
  if (orb) orb.classList.toggle('active', speechActive);
}

function setSpeechStatus(text) {
  const el = document.getElementById('speech-status');
  if (el) el.textContent = text;
}

/* ---- PROCESS INPUT ---- */
async function processSpeechInput(text) {
  stopSpeechTutor();
  addMsg('speech-chat', 'user', text);
  setSpeechStatus('🧠 AI is thinking...');

  const typingId = addTyping('speech-chat');

  try {
    const reply = await callAI(
      getSpeechSystemPrompt(),
      text,
      speechContext.slice(-8)
    );

    removeTyping(typingId);
    addMsg('speech-chat', 'ai', reply);

    // Save context
    speechContext.push(
      { role: 'user',      content: text  },
      { role: 'assistant', content: reply }
    );
    if (speechContext.length > 20) {
      speechContext = speechContext.slice(-20);
    }

    // Speak the response
    speakText(reply);
    setSpeechStatus('🔊 AI is speaking... Tap mic to ask your next question');

  } catch (err) {
    removeTyping(typingId);
    addMsg('speech-chat', 'ai', '⚠️ Error: ' + err.message + '\nPlease check your connection and try again.');
    setSpeechStatus('Error occurred. Tap mic to retry.');
  }
}

/* ---- TEXT FALLBACK ---- */
async function sendSpeechText() {
  const input = document.getElementById('speech-text-input');
  const text  = input.value.trim();
  if (!text) return;
  input.value = '';
  await processSpeechInput(text);
}

/* ---- TEXT TO SPEECH ---- */
function speakText(text) {
  if (!('speechSynthesis' in window)) return;

  window.speechSynthesis.cancel();

  // Clean markdown for speech
  const clean = text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/#{1,6}\s/g, '')
    .replace(/`(.*?)`/g, '$1')
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 600); // Limit length for speech

  const utterance = new SpeechSynthesisUtterance(clean);
  utterance.lang  = 'en-IN';
  utterance.rate  = 0.92;
  utterance.pitch = 1.05;

  utterance.onend = () => {
    setSpeechStatus('Tap the microphone to continue the conversation');
  };

  window.speechSynthesis.speak(utterance);
}
/* =========================================
   ANALYTICS.JS — Learning Analytics Dashboard
   ========================================= */

function renderAnalytics() {
  renderSubjectPerformance();
  renderActivityCalendar();
  renderWeakTopics();
  renderRevisionSchedule();
}

function renderSubjectPerformance() {
  const container = document.getElementById('subject-analytics');
  if (!container) return;

  const subjects = AppState.analytics.subjects;

  container.innerHTML = Object.entries(subjects).map(([subject, pct]) => `
    <div class="progress-item">
      <div class="progress-label">
        <span>${subject}</span>
        <span style="color:var(--accent);font-weight:600">${pct}%</span>
      </div>
      <div class="progress-bar">
        <div class="progress-fill" style="width:${pct}%"></div>
      </div>
    </div>
  `).join('');
}

function renderActivityCalendar() {
  const container = document.getElementById('cal-grid');
  if (!container) return;

  const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const headers = days.map(d =>
    `<div class="cal-day" style="font-weight:700;color:var(--accent);background:transparent">${d}</div>`
  ).join('');

  // Generate 5 weeks of cells
  const today = new Date().getDay(); // 0-6
  const cells = Array.from({ length: 35 }, (_, i) => {
    const isToday   = i === (21 + today) % 35; // approximate "today"
    const hasActivity = AppState.stats.doubts > 0
      ? Math.random() > 0.45
      : i === (21 + today) % 35;  // only today if no activity
    return `<div class="cal-day ${hasActivity ? 'has-activity' : ''} ${isToday ? 'today' : ''}" title="${hasActivity ? 'Study session logged' : 'No activity'}">${hasActivity ? '●' : ''}</div>`;
  }).join('');

  container.innerHTML = headers + cells;
}

function renderWeakTopics() {
  const container = document.getElementById('weak-topics');
  if (!container) return;

  // Derive weak topics from subjects with low scores
  const subjects = AppState.analytics.subjects;
  const weakSubjects = Object.entries(subjects)
    .filter(([, pct]) => pct < 70)
    .map(([sub]) => sub);

  const allWeakTopics = [
    { subject: 'Mathematics',  topic: 'Quadratic Equations'    },
    { subject: 'Chemistry',    topic: 'Organic Reactions'       },
    { subject: 'Physics',      topic: 'Electromagnetic Waves'   },
    { subject: 'Biology',      topic: 'Mitosis vs Meiosis'      },
    { subject: 'History',      topic: 'Post-WW2 Period'         },
    { subject: 'Mathematics',  topic: 'Probability & Statistics' }
  ];

  const toShow = allWeakTopics.filter(t => weakSubjects.includes(t.subject));
  const display = toShow.length > 0 ? toShow : allWeakTopics.slice(0, 3);

  container.innerHTML = display.map(t => `
    <div class="list-row">
      <div>
        <div>${t.topic}</div>
        <div class="list-row-sub">${t.subject}</div>
      </div>
      <span class="tag tag-red">Weak</span>
    </div>
  `).join('') || '<p style="color:var(--text-dim);font-size:0.85rem">Great job! No major weak areas detected.</p>';
}

function renderRevisionSchedule() {
  const container = document.getElementById('revision-schedule');
  if (!container) return;

  const schedule = [
    { when: 'Today',        topic: 'Review Yesterday\'s Notes',  sub: 'Spaced Repetition'  },
    { when: 'Tomorrow',     topic: 'Mathematics Practice Set',   sub: 'Algebra & Calculus' },
    { when: 'In 3 Days',    topic: 'Chemistry Revision',         sub: 'Organic Chemistry'  },
    { when: 'In 1 Week',    topic: 'Full Chapter Test',          sub: 'Physics - Optics'   },
    { when: 'In 2 Weeks',   topic: 'Mock Exam Simulation',       sub: 'All Subjects'       },
  ];

  const tagColors = ['tag-yellow', 'tag-yellow', 'tag-green', 'tag-green', 'tag-green'];

  container.innerHTML = schedule.map((s, i) => `
    <div class="list-row">
      <div>
        <div style="font-weight:600;font-size:0.85rem">${s.when}</div>
        <div class="list-row-sub">${s.topic} — ${s.sub}</div>
      </div>
      <span class="tag ${tagColors[i]}">Scheduled</span>
    </div>
  `).join('');
}
/* =========================================
   APP.JS — Main Application Init
   ========================================= */

const LOAD_MESSAGES = [
  'INITIALIZING AI SYSTEMS...',
  'LOADING REASONING ENGINE...',
  'CALIBRATING BOARD PATTERNS...',
  'ACTIVATING SPEECH MODULE...',
  'BUILDING MEMORY GRAPH...',
  'LOADING ANALYTICS ENGINE...',
  'ALL SYSTEMS ONLINE ✓'
];

function animateLoadText() {
  const el = document.getElementById('loadText');
  if (!el) return;
  let idx = 0;
  const iv = setInterval(() => {
    if (idx < LOAD_MESSAGES.length) {
      el.textContent = LOAD_MESSAGES[idx++];
    } else {
      clearInterval(iv);
    }
  }, 380);
}

function hideLoading() {
  setTimeout(() => {
    const loading = document.getElementById('loading');
    if (loading) {
      loading.classList.add('hide');
      setTimeout(() => {
        loading.style.display = 'none';
        showAuthOrApp();
      }, 800);
    }
  }, 2900);
}

/* ---- MAIN ENTRY POINT ---- */
window.addEventListener('load', () => {
  // Load persisted state
  loadState();

  // Init particles
  initParticles();

  // Animate loading screen
  animateLoadText();
  hideLoading();

  // Update streak
  updateStreak();
});
