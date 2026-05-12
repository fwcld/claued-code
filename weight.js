'use strict';

const TODAY = new Date().toISOString().slice(0, 10);
const load = (key, fb) => { try { return JSON.parse(localStorage.getItem(key)) ?? fb; } catch { return fb; } };
const save = (key, v)  => localStorage.setItem(key, JSON.stringify(v));

// kcal/km 기본값 (체중 70kg 기준 평균)
const KCAL_PER_KM = { '런닝': 60, '걷기': 40, '사이클': 35, '수영': 70, '웨이트': 0, '기타': 0 };

let meals     = load('bd_meals',     []).filter(m => m.date === TODAY);
let exercises = load('bd_exercises', []).filter(e => e.date === TODAY);
let settings  = load('bd_settings',  { goalCalories: 2000 });

let selectedMealType = '아침';

// ── DOM ───────────────────────────────────────────────────────────────────────
const $todayDate    = document.getElementById('today-date');
const $goalCal      = document.getElementById('goal-calories');
const $totalIntake  = document.getElementById('total-intake');
const $totalBurn    = document.getElementById('total-burn');
const $netCalories  = document.getElementById('net-calories');
const $totalRun     = document.getElementById('total-run');
const $calorieBar   = document.getElementById('calorie-bar');
const $calorieLabel = document.getElementById('calorie-bar-label');

const $mealName    = document.getElementById('meal-name');
const $mealCal     = document.getElementById('meal-cal');
const $mealAddBtn  = document.getElementById('meal-add-btn');
const $mealList    = document.getElementById('meal-list');

const $exerciseType = document.getElementById('exercise-type');
const $exerciseDist = document.getElementById('exercise-dist');
const $exerciseCal  = document.getElementById('exercise-cal');
const $exerciseMemo = document.getElementById('exercise-memo');
const $exerciseAddBtn = document.getElementById('exercise-add-btn');
const $exerciseList = document.getElementById('exercise-list');
const $distField    = document.getElementById('distance-field');

const $timelineList = document.getElementById('timeline-list');
const $mealTypeBtns = document.querySelectorAll('.meal-type-btn');

// ── Init ──────────────────────────────────────────────────────────────────────
function init() {
  $todayDate.textContent = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
  });
  $goalCal.value = settings.goalCalories;
  renderAll();
}

// ── Meal type ─────────────────────────────────────────────────────────────────
$mealTypeBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    $mealTypeBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedMealType = btn.dataset.type;
  });
});

// ── Exercise type → auto-calc kcal ────────────────────────────────────────────
$exerciseType.addEventListener('change', autoCalc);
$exerciseDist.addEventListener('input',  autoCalc);

function autoCalc() {
  const type = $exerciseType.value;
  const dist = parseFloat($exerciseDist.value);
  const kcal = KCAL_PER_KM[type];
  const needsDist = kcal > 0;
  $distField.style.display = needsDist ? '' : 'none';
  if (needsDist && !isNaN(dist) && dist > 0) {
    $exerciseCal.value = Math.round(dist * kcal);
    $exerciseCal.placeholder = '자동 계산';
  } else if (!needsDist) {
    $exerciseCal.placeholder = '직접 입력';
    $exerciseCal.value = '';
  }
}

// ── Goal calories ─────────────────────────────────────────────────────────────
$goalCal.addEventListener('change', () => {
  const v = parseInt($goalCal.value);
  if (!isNaN(v) && v > 0) {
    settings.goalCalories = v;
    save('bd_settings', settings);
    renderSummary();
  }
});

// ── Add Meal ──────────────────────────────────────────────────────────────────
function markInvalid(el) { el.classList.add('input-error'); }
function clearErrors(...els) { els.forEach(el => el.classList.remove('input-error')); }

$mealAddBtn.addEventListener('click', addMeal);
[$mealName, $mealCal].forEach(el =>
  el.addEventListener('keydown', e => { if (e.key === 'Enter') addMeal(); })
);

function addMeal() {
  clearErrors($mealName, $mealCal);
  const name = $mealName.value.trim();
  const cal  = parseInt($mealCal.value);
  let valid  = true;
  if (!name)          { markInvalid($mealName); valid = false; }
  if (isNaN(cal) || cal < 0) { markInvalid($mealCal);  valid = false; }
  if (!valid) return;

  meals.push({
    id: Date.now(),
    name,
    calories: cal,
    mealType: selectedMealType,
    date: TODAY,
    time: new Date().toISOString(),
  });
  persistMeals();
  $mealName.value = $mealCal.value = '';
  renderAll();
}

// ── Add Exercise ───────────────────────────────────────────────────────────────
$exerciseAddBtn.addEventListener('click', addExercise);

function addExercise() {
  clearErrors($exerciseDist, $exerciseCal);
  const type = $exerciseType.value;
  const dist = parseFloat($exerciseDist.value) || 0;
  const cal  = parseInt($exerciseCal.value);
  const memo = $exerciseMemo.value.trim();
  const needsDist = KCAL_PER_KM[type] > 0;

  let valid = true;
  if (needsDist && (isNaN(dist) || dist <= 0)) { markInvalid($exerciseDist); valid = false; }
  if (isNaN(cal) || cal < 0)                   { markInvalid($exerciseCal);  valid = false; }
  if (!valid) return;

  exercises.push({
    id: Date.now(),
    type,
    distance: dist,
    calories: cal,
    memo,
    date: TODAY,
    time: new Date().toISOString(),
  });
  persistExercises();
  $exerciseDist.value = $exerciseCal.value = $exerciseMemo.value = '';
  renderAll();
}

// ── Render ─────────────────────────────────────────────────────────────────────
function renderAll() {
  renderSummary();
  renderMeals();
  renderExercises();
  renderTimeline();
}

function renderSummary() {
  const totalIntake = meals.reduce((a, m) => a + m.calories, 0);
  const totalBurn   = exercises.reduce((a, e) => a + e.calories, 0);
  const net         = totalIntake - totalBurn;
  const totalRun    = exercises.filter(e => e.type === '런닝').reduce((a, e) => a + e.distance, 0);
  const goal        = settings.goalCalories;
  const pct         = goal > 0 ? Math.min(Math.round((totalIntake / goal) * 100), 100) : 0;

  $totalIntake.textContent  = `${totalIntake.toLocaleString()} kcal`;
  $totalBurn.textContent    = `${totalBurn.toLocaleString()} kcal`;
  $totalRun.textContent     = `${totalRun.toFixed(1)} km`;
  $netCalories.textContent  = `${net >= 0 ? '+' : ''}${net.toLocaleString()} kcal`;
  $netCalories.className    = 'stat-value ' + (net > 0 ? 'pos-cal' : net < 0 ? 'neg-cal' : '');
  $calorieBar.style.width   = `${pct}%`;
  $calorieBar.className     = 'calorie-bar-fill ' + (pct >= 100 ? 'bar-over' : pct >= 80 ? 'bar-warn' : 'bar-ok');
  $calorieLabel.textContent = `목표 대비 ${pct}% (${totalIntake.toLocaleString()} / ${goal.toLocaleString()} kcal)`;
}

const MEAL_ICON = { '아침': '🌅', '점심': '☀️', '저녁': '🌙', '간식': '🍪' };
const EX_ICON   = { '런닝': '🏃', '걷기': '🚶', '사이클': '🚴', '수영': '🏊', '웨이트': '🏋️', '기타': '✨' };

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function renderMeals() {
  $mealList.innerHTML = '';
  if (!meals.length) {
    $mealList.innerHTML = '<li class="empty-msg">오늘 식사 기록이 없습니다.</li>';
    return;
  }
  const grouped = { '아침': [], '점심': [], '저녁': [], '간식': [] };
  meals.forEach(m => (grouped[m.mealType] ?? grouped['간식']).push(m));

  ['아침', '점심', '저녁', '간식'].forEach(type => {
    if (!grouped[type].length) return;
    const header = document.createElement('li');
    header.className = 'meal-group-header';
    const groupCal = grouped[type].reduce((a, m) => a + m.calories, 0);
    header.innerHTML = `<span>${MEAL_ICON[type]} ${type}</span><span class="group-cal">${groupCal.toLocaleString()} kcal</span>`;
    $mealList.appendChild(header);

    grouped[type].forEach(m => {
      const li = document.createElement('li');
      li.className = 'body-item';
      li.innerHTML = `
        <div class="body-item-info">
          <span class="body-item-name">${escHtml(m.name)}</span>
          <span class="body-item-sub">${m.calories.toLocaleString()} kcal</span>
        </div>
        <button class="delete-btn" type="button" data-id="${m.id}">✕</button>`;
      $mealList.appendChild(li);
    });
  });

  $mealList.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      meals = meals.filter(m => m.id != btn.dataset.id);
      persistMeals();
      renderAll();
    });
  });
}

function renderExercises() {
  $exerciseList.innerHTML = '';
  if (!exercises.length) {
    $exerciseList.innerHTML = '<li class="empty-msg">오늘 운동 기록이 없습니다.</li>';
    return;
  }
  exercises.slice().reverse().forEach(e => {
    const li = document.createElement('li');
    li.className = 'body-item';
    const distText = e.distance > 0 ? ` · ${e.distance.toFixed(1)} km` : '';
    const memoText = e.memo ? ` · ${escHtml(e.memo)}` : '';
    li.innerHTML = `
      <div class="body-item-info">
        <span class="body-item-name">${EX_ICON[e.type] ?? '✨'} ${escHtml(e.type)}${distText}</span>
        <span class="body-item-sub">${e.calories.toLocaleString()} kcal${memoText}</span>
      </div>
      <button class="delete-btn" type="button" data-id="${e.id}">✕</button>`;
    $exerciseList.appendChild(li);
  });

  $exerciseList.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      exercises = exercises.filter(e => e.id != btn.dataset.id);
      persistExercises();
      renderAll();
    });
  });
}

function renderTimeline() {
  $timelineList.innerHTML = '';
  const items = [
    ...meals.map(m => ({ ...m, kind: 'meal' })),
    ...exercises.map(e => ({ ...e, kind: 'exercise' })),
  ].sort((a, b) => new Date(a.time) - new Date(b.time));

  if (!items.length) {
    $timelineList.innerHTML = '<li class="empty-msg">기록이 없습니다.</li>';
    return;
  }

  items.forEach(item => {
    const li = document.createElement('li');
    li.className = 'timeline-item';
    const timeStr = new Date(item.time).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    if (item.kind === 'meal') {
      li.innerHTML = `
        <span class="tl-time">${timeStr}</span>
        <span class="tl-dot meal-dot"></span>
        <div class="tl-content">
          <span class="tl-label">${MEAL_ICON[item.mealType]} ${item.mealType}</span>
          <span class="tl-name">${escHtml(item.name)}</span>
          <span class="tl-cal intake-val">+${item.calories.toLocaleString()} kcal</span>
        </div>`;
    } else {
      const distText = item.distance > 0 ? ` ${item.distance.toFixed(1)}km` : '';
      li.innerHTML = `
        <span class="tl-time">${timeStr}</span>
        <span class="tl-dot exercise-dot"></span>
        <div class="tl-content">
          <span class="tl-label">${EX_ICON[item.type] ?? '✨'} ${escHtml(item.type)}${distText}</span>
          ${item.memo ? `<span class="tl-name">${escHtml(item.memo)}</span>` : ''}
          <span class="tl-cal burn-val">-${item.calories.toLocaleString()} kcal</span>
        </div>`;
    }
    $timelineList.appendChild(li);
  });
}

// ── Persist ────────────────────────────────────────────────────────────────────
function persistMeals() {
  const all = load('bd_meals', []).filter(m => m.date !== TODAY);
  save('bd_meals', [...all, ...meals]);
}
function persistExercises() {
  const all = load('bd_exercises', []).filter(e => e.date !== TODAY);
  save('bd_exercises', [...all, ...exercises]);
}

// ── Boot ──────────────────────────────────────────────────────────────────────
autoCalc();
init();
