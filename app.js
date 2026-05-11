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
  renderHeatmap();
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
  renderHeatmap();
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
const CAT_EMOJI = { '공부': '📚', '업무': '💼', '휴식': '☕', '운동': '🏃', '기타': '✨' };

function renderSessions() {
  $sessionList.innerHTML = '';
  const todaySessions = sessions.slice().reverse();
  if (!todaySessions.length) {
    $sessionList.innerHTML = '<li class="empty-msg">기록이 없습니다.</li>';
    return;
  }
  // 시간순(오래된 것 먼저)으로 컨텍스트 스위치 판별 후 역순 렌더링
  const chron = sessions.slice(); // oldest → newest
  todaySessions.forEach((s, i) => {
    const chronIdx = chron.findIndex(x => x.id === s.id);
    const prev     = chron[chronIdx - 1];
    const switched = prev && prev.category !== s.category;

    const li = document.createElement('li');
    li.className = 'session-item';
    const startStr = new Date(s.startTime).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    const endStr   = new Date(s.endTime).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    const durStr   = fmtDuration(s.duration);

    const switchBadge = switched
      ? `<span class="switch-badge">
           <span style="color:${CAT_COLORS[prev.category] ?? '#a78bfa'}">${CAT_EMOJI[prev.category] ?? ''} ${escHtml(prev.category)}</span>
           <span class="switch-arrow">→</span>
           <span style="color:${CAT_COLORS[s.category] ?? '#a78bfa'}">${CAT_EMOJI[s.category] ?? ''} ${escHtml(s.category)}</span>
         </span>`
      : '';

    li.innerHTML = `
      <div class="session-cat-dot ${CAT_DOT_CLASS[s.category] ?? 'dot-etc'}"></div>
      <div class="session-info">
        <div class="session-header">
          <span class="session-cat" style="color:${CAT_COLORS[s.category] ?? '#a78bfa'}">${CAT_EMOJI[s.category] ?? ''} ${escHtml(s.category)}</span>
          ${switchBadge}
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
      renderHeatmap();
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

// ── Heatmap ───────────────────────────────────────────────────────────────────
function renderHeatmap() {
  const $grid   = document.getElementById('heatmap-grid');
  const $months = document.getElementById('heatmap-months');
  const $year   = document.getElementById('heatmap-year');

  const allSessions = load('fs_sessions', []);

  // 날짜별 총 집중 시간(분) 집계
  const dayMap = {};
  allSessions.forEach(s => {
    dayMap[s.date] = (dayMap[s.date] ?? 0) + Math.floor(s.duration / 60);
  });

  // 오늘 기준 364일 전(일요일 정렬을 위해 시작 요일 맞춤)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startDate = new Date(today);
  startDate.setDate(today.getDate() - 364);
  // 월요일 시작: 시작일을 해당 주의 월요일로 당김
  const dow = (startDate.getDay() + 6) % 7; // 0=월 … 6=일
  startDate.setDate(startDate.getDate() - dow);

  $year.textContent = `${startDate.getFullYear()} – ${today.getFullYear()}`;

  // 레벨 결정 (분 기준)
  const level = min => {
    if (min === 0)   return 0;
    if (min <= 30)   return 1;
    if (min <= 60)   return 2;
    if (min <= 120)  return 3;
    return 4;
  };

  $grid.innerHTML = '';
  $months.innerHTML = '';

  const MONTHS = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];
  const CELL_SIZE = 11 + 3; // width + gap
  let monthTrack = -1;
  let weekIdx = 0;
  const monthSpans = {}; // month → start weekIdx

  const cursor = new Date(startDate);
  while (cursor <= today) {
    const dateStr = cursor.toISOString().slice(0, 10);
    const min     = dayMap[dateStr] ?? 0;
    const lv      = level(min);
    const isFuture = cursor > today;

    const cell = document.createElement('div');
    cell.className = `heatmap-cell level-${isFuture ? 0 : lv}`;
    if (!isFuture) {
      const tipDate = cursor.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
      cell.setAttribute('data-tip', min > 0 ? `${tipDate} · ${min}분` : `${tipDate} · 없음`);
    }
    $grid.appendChild(cell);

    // 월 레이블 추적 (매주 첫날 = 월요일 기준)
    const m = cursor.getMonth();
    if ((cursor.getDay() + 6) % 7 === 0) { // 월요일
      if (m !== monthTrack) {
        monthTrack = m;
        monthSpans[weekIdx] = MONTHS[m];
      }
      weekIdx++;
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  // 월 레이블 렌더링
  let prevWeek = 0;
  Object.entries(monthSpans).forEach(([wk, name]) => {
    const gap = (parseInt(wk) - prevWeek) * CELL_SIZE;
    const span = document.createElement('span');
    span.textContent = name;
    span.style.width = `${gap}px`;
    span.style.minWidth = `${gap}px`;
    $months.appendChild(span);
    prevWeek = parseInt(wk);
  });
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
