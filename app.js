'use strict';

const TODAY = new Date().toISOString().slice(0, 10);

// ── localStorage helpers ──────────────────────────────────────────────────────
const load = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
};
const save = (key, val) => localStorage.setItem(key, JSON.stringify(val));

// ── State ─────────────────────────────────────────────────────────────────────
let sessions  = load('fs_sessions', []).filter(s => s.date === TODAY);
let goals     = load('fs_goals',    []).filter(g => g.date === TODAY);
let settings  = load('fs_settings', { notifyEnabled: false, pomodoroAlert: false });

let selectedCat = '공부';
let timerState  = 'idle'; // idle | running | paused
let elapsed     = 0;      // seconds
let startTs     = null;   // Date.now() when last resumed
let intervalId  = null;
let pendingSession = null; // session waiting for memo

let chart = null;

// ── Category colours ──────────────────────────────────────────────────────────
const CAT_COLORS = {
  '공부': '#6c63ff',
  '업무': '#f59e0b',
  '휴식': '#38bdf8',
  '운동': '#4caf7d',
  '기타': '#a78bfa',
};
const CAT_DOT_CLASS = {
  '공부': 'dot-study',
  '업무': 'dot-work',
  '휴식': 'dot-rest',
  '운동': 'dot-exercise',
  '기타': 'dot-etc',
};

// ── DOM refs ──────────────────────────────────────────────────────────────────
const $date       = document.getElementById('today-date');
const $timerDisp  = document.getElementById('timer-display');
const $startBtn   = document.getElementById('start-btn');
const $pauseBtn   = document.getElementById('pause-btn');
const $stopBtn    = document.getElementById('stop-btn');
const $memoRow    = document.getElementById('memo-row');
const $memoInput  = document.getElementById('memo-input');
const $saveBtn    = document.getElementById('save-btn');
const $sessionList= document.getElementById('session-list');
const $goalList   = document.getElementById('goal-list');
const $goalInput  = document.getElementById('goal-input');
const $goalAddBtn = document.getElementById('goal-add-btn');
const $totalTime  = document.getElementById('total-time');
const $totalSess  = document.getElementById('total-sessions');
const $noData     = document.getElementById('no-data-msg');
const $notify     = document.getElementById('notify-toggle');
const $pomodoro   = document.getElementById('pomodoro-toggle');
const $catBtns    = document.querySelectorAll('.cat-btn');

// ── Init ──────────────────────────────────────────────────────────────────────
function init() {
  $date.textContent = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
  });

  $notify.checked   = settings.notifyEnabled;
  $pomodoro.checked = settings.pomodoroAlert;

  renderGoals();
  renderSessions();
  renderStats();
}

// ── Timer ─────────────────────────────────────────────────────────────────────
function fmtTime(sec) {
  const h = String(Math.floor(sec / 3600)).padStart(2, '0');
  const m = String(Math.floor((sec % 3600) / 60)).padStart(2, '0');
  const s = String(sec % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

function tick() {
  elapsed = Math.floor((Date.now() - startTs) / 1000) + (elapsed || 0);
  startTs = Date.now();
  $timerDisp.textContent = fmtTime(elapsed);

  if (settings.pomodoroAlert && elapsed > 0 && elapsed % (25 * 60) === 0) {
    notify('⏰ 25분 경과!', '잠깐 휴식을 취해보세요.');
  }
}

$startBtn.addEventListener('click', () => {
  if (timerState === 'idle') {
    elapsed = 0;
    startTs = Date.now();
  } else if (timerState === 'paused') {
    startTs = Date.now();
  }
  timerState = 'running';
  intervalId = setInterval(tick, 1000);
  $startBtn.disabled = true;
  $pauseBtn.disabled = false;
  $stopBtn.disabled  = false;
  $memoRow.style.display = 'none';
  $catBtns.forEach(b => b.disabled = true);
});

$pauseBtn.addEventListener('click', () => {
  clearInterval(intervalId);
  timerState = 'paused';
  $startBtn.textContent = '재시작';
  $startBtn.disabled = false;
  $pauseBtn.disabled = true;
});

$stopBtn.addEventListener('click', () => {
  clearInterval(intervalId);
  timerState = 'idle';

  pendingSession = {
    id:        Date.now(),
    category:  selectedCat,
    startTime: new Date(Date.now() - elapsed * 1000).toISOString(),
    endTime:   new Date().toISOString(),
    duration:  elapsed,
    memo:      '',
    date:      TODAY,
  };

  $timerDisp.textContent = fmtTime(elapsed);
  $memoRow.style.display = 'flex';
  $memoInput.value = '';
  $memoInput.focus();

  $startBtn.textContent = '시작';
  $startBtn.disabled = false;
  $pauseBtn.disabled = true;
  $stopBtn.disabled  = true;
  $catBtns.forEach(b => b.disabled = false);
});

$saveBtn.addEventListener('click', saveSession);
$memoInput.addEventListener('keydown', e => { if (e.key === 'Enter') saveSession(); });

function saveSession() {
  if (!pendingSession) return;
  pendingSession.memo = $memoInput.value.trim();
  sessions.push(pendingSession);
  persistSessions();
  pendingSession = null;
  $memoRow.style.display = 'none';
  elapsed = 0;
  $timerDisp.textContent = '00:00:00';
  notify('✅ 세션 완료!', `${pendingSession?.category ?? ''} 세션이 기록되었습니다.`);
  renderSessions();
  renderStats();
}

// ── Category selection ────────────────────────────────────────────────────────
$catBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    if (timerState === 'running') return;
    $catBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedCat = btn.dataset.cat;
  });
});

// ── Goals ─────────────────────────────────────────────────────────────────────
$goalAddBtn.addEventListener('click', addGoal);
$goalInput.addEventListener('keydown', e => { if (e.key === 'Enter') addGoal(); });

function addGoal() {
  const text = $goalInput.value.trim();
  if (!text) return;
  goals.push({ id: Date.now(), text, done: false, date: TODAY });
  persistGoals();
  $goalInput.value = '';
  renderGoals();
}

function renderGoals() {
  $goalList.innerHTML = '';
  if (!goals.length) {
    $goalList.innerHTML = '<li style="color:var(--text-muted);font-size:.9rem;padding:4px 0;">목표가 없습니다. 추가해보세요!</li>';
    return;
  }
  goals.forEach(g => {
    const li = document.createElement('li');
    if (g.done) li.classList.add('done');
    li.innerHTML = `
      <input type="checkbox" ${g.done ? 'checked' : ''} data-id="${g.id}" />
      <span>${escHtml(g.text)}</span>
      <button class="delete-btn" data-id="${g.id}" title="삭제">✕</button>`;
    $goalList.appendChild(li);
  });

  $goalList.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', () => {
      const g = goals.find(x => x.id == cb.dataset.id);
      if (g) { g.done = cb.checked; persistGoals(); renderGoals(); }
    });
  });
  $goalList.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      goals = goals.filter(g => g.id != btn.dataset.id);
      persistGoals();
      renderGoals();
    });
  });
}

// ── Sessions ──────────────────────────────────────────────────────────────────
function renderSessions() {
  $sessionList.innerHTML = '';
  const todaySessions = sessions.slice().reverse();
  if (!todaySessions.length) {
    $sessionList.innerHTML = '<li class="empty-msg">기록이 없습니다.</li>';
    return;
  }
  todaySessions.forEach(s => {
    const li = document.createElement('li');
    li.className = 'session-item';
    const startStr = new Date(s.startTime).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    const endStr   = new Date(s.endTime).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    const durStr   = fmtDuration(s.duration);
    li.innerHTML = `
      <div class="session-cat-dot ${CAT_DOT_CLASS[s.category] ?? 'dot-etc'}"></div>
      <div class="session-info">
        <div class="session-header">
          <span class="session-cat" style="color:${CAT_COLORS[s.category] ?? '#a78bfa'}">${escHtml(s.category)}</span>
          <span class="session-time">${startStr} ~ ${endStr}</span>
          <span class="session-duration">${durStr}</span>
        </div>
        ${s.memo ? `<div class="session-memo">${escHtml(s.memo)}</div>` : ''}
      </div>
      <button class="delete-btn" data-id="${s.id}" title="삭제">✕</button>`;
    $sessionList.appendChild(li);
  });

  $sessionList.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      sessions = sessions.filter(s => s.id != btn.dataset.id);
      persistSessions();
      renderSessions();
      renderStats();
    });
  });
}

function fmtDuration(sec) {
  if (sec < 60) return `${sec}초`;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}시간 ${m}분`;
  if (s > 0) return `${m}분 ${s}초`;
  return `${m}분`;
}

// ── Stats & Chart ─────────────────────────────────────────────────────────────
function renderStats() {
  const totalSec = sessions.reduce((acc, s) => acc + s.duration, 0);
  const totalMin = Math.floor(totalSec / 60);

  if (totalMin >= 60) {
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    $totalTime.textContent = m > 0 ? `${h}시간 ${m}분` : `${h}시간`;
  } else {
    $totalTime.textContent = `${totalMin}분`;
  }
  $totalSess.textContent = `${sessions.length}회`;

  const catTotals = {};
  sessions.forEach(s => {
    catTotals[s.category] = (catTotals[s.category] ?? 0) + s.duration;
  });

  const cats   = Object.keys(catTotals);
  const values = cats.map(c => Math.round(catTotals[c] / 60));
  const colors = cats.map(c => CAT_COLORS[c] ?? '#a78bfa');

  $noData.style.display = cats.length ? 'none' : 'block';

  const ctx = document.getElementById('cat-chart').getContext('2d');
  if (chart) { chart.destroy(); chart = null; }
  if (cats.length) {
    chart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: cats,
        datasets: [{ data: values, backgroundColor: colors, borderWidth: 0, hoverOffset: 6 }],
      },
      options: {
        plugins: {
          legend: { position: 'bottom', labels: { color: '#7c82a8', padding: 16, font: { size: 13 } } },
          tooltip: {
            callbacks: { label: ctx => ` ${ctx.label}: ${ctx.raw}분` },
          },
        },
        cutout: '62%',
      },
    });
  }
}

// ── Notifications ─────────────────────────────────────────────────────────────
function notify(title, body) {
  if (!settings.notifyEnabled) return;
  if (Notification.permission === 'granted') {
    new Notification(title, { body, icon: '' });
  }
}

$notify.addEventListener('change', async () => {
  settings.notifyEnabled = $notify.checked;
  persistSettings();
  if ($notify.checked && Notification.permission === 'default') {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') {
      $notify.checked = false;
      settings.notifyEnabled = false;
      persistSettings();
    }
  }
});

$pomodoro.addEventListener('change', () => {
  settings.pomodoroAlert = $pomodoro.checked;
  persistSettings();
});

// ── Persist ───────────────────────────────────────────────────────────────────
function persistSessions() {
  const all = load('fs_sessions', []).filter(s => s.date !== TODAY);
  save('fs_sessions', [...all, ...sessions]);
}

function persistGoals() {
  const all = load('fs_goals', []).filter(g => g.date !== TODAY);
  save('fs_goals', [...all, ...goals]);
}

function persistSettings() { save('fs_settings', settings); }

// ── Util ──────────────────────────────────────────────────────────────────────
function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Boot ──────────────────────────────────────────────────────────────────────
init();
