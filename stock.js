'use strict';

const load = (key, fb) => { try { return JSON.parse(localStorage.getItem(key)) ?? fb; } catch { return fb; } };
const save = (key, v)   => localStorage.setItem(key, JSON.stringify(v));

let holdings  = load('st_holdings', []);   // 투자 종목
let watchlist = load('st_watchlist', []);  // 관심 종목
let sold      = load('st_sold', []);       // 판매 기록

// ── DOM ───────────────────────────────────────────────────────────────────────
const $invName    = document.getElementById('inv-name');
const $invBuy     = document.getElementById('inv-buy');
const $invQty     = document.getElementById('inv-qty');
const $invCurrent = document.getElementById('inv-current');
const $invAddBtn  = document.getElementById('inv-add-btn');
const $invTbody   = document.getElementById('inv-tbody');
const $invEmpty   = document.getElementById('inv-empty');

const $watchName   = document.getElementById('watch-name');
const $watchMemo   = document.getElementById('watch-memo');
const $watchAddBtn = document.getElementById('watch-add-btn');
const $watchList   = document.getElementById('watch-list');

const $soldName   = document.getElementById('sold-name');
const $soldBuy    = document.getElementById('sold-buy');
const $soldSell   = document.getElementById('sold-sell');
const $soldQty    = document.getElementById('sold-qty');
const $soldAddBtn = document.getElementById('sold-add-btn');
const $soldTbody  = document.getElementById('sold-tbody');
const $soldEmpty  = document.getElementById('sold-empty');

const $sumInvested = document.getElementById('sum-invested');
const $sumEval     = document.getElementById('sum-eval');
const $sumPnl      = document.getElementById('sum-pnl');
const $sumRealized = document.getElementById('sum-realized');

// ── Formatters ────────────────────────────────────────────────────────────────
const fmt = n => n.toLocaleString('ko-KR') + '원';
const pct = n => (n >= 0 ? '+' : '') + n.toFixed(2) + '%';

function colorClass(n) {
  if (n > 0) return 'pos';
  if (n < 0) return 'neg';
  return '';
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Summary ───────────────────────────────────────────────────────────────────
function renderSummary() {
  const totalInvested = holdings.reduce((a, h) => a + h.buyPrice * h.qty, 0);
  const totalEval     = holdings.reduce((a, h) => a + h.currentPrice * h.qty, 0);
  const totalPnl      = totalEval - totalInvested;
  const totalRealized = sold.reduce((a, s) => a + (s.sellPrice - s.buyPrice) * s.qty, 0);

  $sumInvested.textContent = fmt(totalInvested);
  $sumEval.textContent     = fmt(totalEval);
  $sumPnl.textContent      = fmt(totalPnl);
  $sumPnl.className        = 'stat-value ' + colorClass(totalPnl);
  $sumRealized.textContent = fmt(totalRealized);
  $sumRealized.className   = 'stat-value ' + colorClass(totalRealized);
}

// ── Validation helpers ────────────────────────────────────────────────────────
function markInvalid(el) { el.classList.add('input-error'); }
function clearErrors(...els) { els.forEach(el => el.classList.remove('input-error')); }

// ── Holdings (투자 종목) ───────────────────────────────────────────────────────
$invAddBtn.addEventListener('click', addHolding);
[$invName, $invBuy, $invQty, $invCurrent].forEach(el =>
  el.addEventListener('keydown', e => { if (e.key === 'Enter') addHolding(); })
);

function addHolding() {
  clearErrors($invName, $invBuy, $invQty, $invCurrent);
  const name    = $invName.value.trim();
  const buy     = parseFloat($invBuy.value);
  const qty     = parseInt($invQty.value);
  const current = parseFloat($invCurrent.value);

  let valid = true;
  if (!name)              { markInvalid($invName);    valid = false; }
  if (isNaN(buy)  || buy  <= 0) { markInvalid($invBuy);     valid = false; }
  if (isNaN(qty)  || qty  <= 0) { markInvalid($invQty);     valid = false; }
  if (isNaN(current) || current <= 0) { markInvalid($invCurrent); valid = false; }
  if (!valid) return;

  holdings.push({ id: Date.now(), name, buyPrice: buy, qty, currentPrice: current });
  save('st_holdings', holdings);
  $invName.value = $invBuy.value = $invQty.value = $invCurrent.value = '';
  renderHoldings();
  renderSummary();
}

function renderHoldings() {
  $invTbody.innerHTML = '';
  $invEmpty.style.display = holdings.length ? 'none' : 'block';
  holdings.forEach(h => {
    const invested = h.buyPrice * h.qty;
    const eval_    = h.currentPrice * h.qty;
    const pnl      = eval_ - invested;
    const rate     = ((h.currentPrice - h.buyPrice) / h.buyPrice) * 100;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${escHtml(h.name)}</strong></td>
      <td>${fmt(h.buyPrice)}</td>
      <td>
        <input class="inline-input" type="number" value="${h.currentPrice}" data-id="${h.id}" min="0" />
      </td>
      <td>${h.qty.toLocaleString()}주</td>
      <td>${fmt(invested)}</td>
      <td class="${colorClass(pnl)}">${pnl >= 0 ? '+' : ''}${fmt(pnl)}</td>
      <td class="${colorClass(rate)}">${pct(rate)}</td>
      <td><button class="delete-btn" data-id="${h.id}">✕</button></td>`;
    $invTbody.appendChild(tr);
  });

  $invTbody.querySelectorAll('.inline-input').forEach(input => {
    input.addEventListener('change', () => {
      const h = holdings.find(x => x.id == input.dataset.id);
      const v = parseFloat(input.value);
      if (h && !isNaN(v) && v > 0) {
        h.currentPrice = v;
        save('st_holdings', holdings);
        renderHoldings();
        renderSummary();
      }
    });
  });

  $invTbody.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      holdings = holdings.filter(h => h.id != btn.dataset.id);
      save('st_holdings', holdings);
      renderHoldings();
      renderSummary();
    });
  });
}

// ── Watchlist (관심 종목) ──────────────────────────────────────────────────────
$watchAddBtn.addEventListener('click', addWatch);
[$watchName, $watchMemo].forEach(el =>
  el.addEventListener('keydown', e => { if (e.key === 'Enter') addWatch(); })
);

function addWatch() {
  const name = $watchName.value.trim();
  if (!name) return;
  watchlist.push({ id: Date.now(), name, memo: $watchMemo.value.trim() });
  save('st_watchlist', watchlist);
  $watchName.value = $watchMemo.value = '';
  renderWatchlist();
}

function renderWatchlist() {
  $watchList.innerHTML = '';
  if (!watchlist.length) {
    $watchList.innerHTML = '<li class="empty-msg">관심 종목이 없습니다.</li>';
    return;
  }
  watchlist.forEach(w => {
    const li = document.createElement('li');
    li.className = 'watch-item';
    li.innerHTML = `
      <span class="watch-name">⭐ ${escHtml(w.name)}</span>
      ${w.memo ? `<span class="watch-memo">${escHtml(w.memo)}</span>` : ''}
      <button class="delete-btn" data-id="${w.id}">✕</button>`;
    $watchList.appendChild(li);
  });

  $watchList.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      watchlist = watchlist.filter(w => w.id != btn.dataset.id);
      save('st_watchlist', watchlist);
      renderWatchlist();
    });
  });
}

// ── Sold (판매 기록) ──────────────────────────────────────────────────────────
$soldAddBtn.addEventListener('click', addSold);
[$soldName, $soldBuy, $soldSell, $soldQty].forEach(el =>
  el.addEventListener('keydown', e => { if (e.key === 'Enter') addSold(); })
);

function addSold() {
  clearErrors($soldName, $soldBuy, $soldSell, $soldQty);
  const name = $soldName.value.trim();
  const buy  = parseFloat($soldBuy.value);
  const sell = parseFloat($soldSell.value);
  const qty  = parseInt($soldQty.value);

  let valid = true;
  if (!name)             { markInvalid($soldName); valid = false; }
  if (isNaN(buy) || buy <= 0) { markInvalid($soldBuy);  valid = false; }
  if (isNaN(sell))            { markInvalid($soldSell); valid = false; }
  if (isNaN(qty) || qty <= 0) { markInvalid($soldQty);  valid = false; }
  if (!valid) return;

  sold.push({ id: Date.now(), name, buyPrice: buy, sellPrice: sell, qty, date: new Date().toISOString().slice(0, 10) });
  save('st_sold', sold);
  $soldName.value = $soldBuy.value = $soldSell.value = $soldQty.value = '';
  renderSold();
  renderSummary();
}

function renderSold() {
  $soldTbody.innerHTML = '';
  $soldEmpty.style.display = sold.length ? 'none' : 'block';
  sold.slice().reverse().forEach(s => {
    const pnl  = (s.sellPrice - s.buyPrice) * s.qty;
    const rate = ((s.sellPrice - s.buyPrice) / s.buyPrice) * 100;
    const tr   = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${escHtml(s.name)}</strong></td>
      <td>${fmt(s.buyPrice)}</td>
      <td>${fmt(s.sellPrice)}</td>
      <td>${s.qty.toLocaleString()}주</td>
      <td class="${colorClass(pnl)}">${pnl >= 0 ? '+' : ''}${fmt(pnl)}</td>
      <td class="${colorClass(rate)}">${pct(rate)}</td>
      <td class="date-cell">${s.date}</td>
      <td><button class="delete-btn" data-id="${s.id}">✕</button></td>`;
    $soldTbody.appendChild(tr);
  });

  $soldTbody.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      sold = sold.filter(s => s.id != btn.dataset.id);
      save('st_sold', sold);
      renderSold();
      renderSummary();
    });
  });
}

// ── Boot ──────────────────────────────────────────────────────────────────────
renderHoldings();
renderWatchlist();
renderSold();
renderSummary();
