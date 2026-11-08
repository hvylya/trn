'use strict';
/* Зал на двох — офлайн-трекер тренувань. Дані зберігаються лише на цьому телефоні. */
const P = window.PROGRAM;
const APP_VERSION = '1.0.0';
const app = document.getElementById('app');
const sheetEl = document.getElementById('sheet');
const toastEl = document.getElementById('toast');

const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num = v => { const n = parseFloat(String(v).replace(',', '.')); return isFinite(n) ? n : null; };
const fmt = v => v == null ? '—' : (Math.round(v * 100) / 100).toString().replace('.', ',');
const fmtInt = v => Math.round(v).toLocaleString('uk-UA').replace(/ /g, ' ');
const pad = n => String(n).padStart(2, '0');
const mmss = s => { s = Math.max(0, Math.round(s)); return `${Math.floor(s / 60)}:${pad(s % 60)}`; };
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const MONTHS = ['січ','лют','бер','квіт','трав','черв','лип','серп','вер','жовт','лист','груд'];
const MONTHS_FULL = ['Січень','Лютий','Березень','Квітень','Травень','Червень','Липень','Серпень','Вересень','Жовтень','Листопад','Грудень'];
const WD = ['Нд','Пн','Вт','Ср','Чт','Пт','Сб'];
const dShort = ts => { const d = new Date(ts); return `${WD[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`; };
const weekStart = ts => { const d = new Date(ts); d.setHours(0,0,0,0); const k = (d.getDay() + 6) % 7; d.setDate(d.getDate() - k); return d.getTime(); };
const DAY_ORDER = ['mon','wed','fri'];
const DAY_NAME = {mon:'Понеділок', wed:'Середа', fri:'Пʼятниця'};
const DAY_TAB = {mon:'Пн', wed:'Ср', fri:'Пт'};

/* ---------- сховище ---------- */
const LS = {
  get(k, d){ try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch(e){ return d; } },
  set(k, v){ try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch(e){ toast('Не вдалося зберегти дані'); return false; } }
};
let person = LS.get('trn:person', null);
let S = null;
const blank = () => ({ v:1, settings:{duration:75, restMain:120, restIso:90, restCore:45}, blockStart:null, workouts:[], active:null, measurements:[], ach:{}, lastBackup:null });
function load(){ S = Object.assign(blank(), person ? LS.get('trn:data:' + person, {}) : {}); S.settings = Object.assign(blank().settings, S.settings); }
function save(){ if (person) LS.set('trn:data:' + person, S); }
try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch(e){}
const THEMES = [['dark','Вечірній зал','#0f1115','#ff7a59'],['light','Денна','#f4f5f7','#e5553a'],['neon','Неон','#0a0a0a','#c6ff3d'],['berry','Полуничний шейк','#1a0f17','#ff6fae'],['mint','Мʼятний шейк','#edf7f3','#159f6f'],['ocean','Океан','#0b1220','#4cc3ff']];
function applyTheme(){ const t = LS.get('trn:theme', 'dark'); document.documentElement.dataset.theme = t; const th = THEMES.find(x => x[0] === t) || THEMES[0]; const m = document.querySelector('meta[name="theme-color"]'); if (m) m.content = th[2]; }
applyTheme();

/* ---------- програма ---------- */
const plan = day => P.days.find(d => d.key === day)[person];
const lib = en => P.lib[en] || {};
const stepById = (day, id) => plan(day).find(s => s.id === id);
const who = () => P.people[person];

/* ---------- екрани ---------- */
let screen = 'today', tab = 'today', selDay = null, histOpen = null, chartEx = null, mKey = 'waist';
function go(s){ screen = s; if (['today','history','progress','measure'].includes(s)) tab = s; render(); window.scrollTo(0, 0); }

function toast(html, cls){
  toastEl.className = cls || ''; toastEl.innerHTML = html; toastEl.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => { toastEl.hidden = true; }, cls === 'pr' ? 3600 : 2400);
}
function openSheet(html){ sheetEl.innerHTML = `<div class="sh" role="dialog" aria-modal="true">${html}</div>`; sheetEl.hidden = false; }
function closeSheet(){ sheetEl.hidden = true; sheetEl.innerHTML = ''; }
sheetEl.addEventListener('click', e => { if (e.target === sheetEl) closeSheet(); });

function tabbar(){
  const t = [['today','🏠','Сьогодні'],['history','🗓️','Історія'],['progress','📈','Прогрес'],['measure','📏','Заміри']];
  return `<div class="tabbar"><nav>${t.map(([k,i,l]) => `<button data-go="${k}" ${tab === k ? 'aria-current="page"' : ''}><span>${i}</span>${l}</button>`).join('')}</nav></div>`;
}

/* ---------- обчислення ---------- */
function nextDay(){
  const done = S.workouts.filter(w => !w.deleted);
  if (done.length){ const last = done[done.length - 1].day; return DAY_ORDER[(DAY_ORDER.indexOf(last) + 1) % 3]; }
  const wd = new Date().getDay();
  return wd === 0 || wd === 1 ? 'mon' : wd === 2 || wd === 3 ? 'wed' : 'fri';
}
function weekCounts(){ const m = new Map(); S.workouts.forEach(w => { const k = weekStart(w.start); m.set(k, (m.get(k) || 0) + 1); }); return m; }
function streakWeeks(){
  const m = weekCounts(); let k = weekStart(Date.now()); let n = 0;
  if ((m.get(k) || 0) < 3) k -= 7 * 864e5;
  while ((m.get(k) || 0) >= 3){ n++; k = weekStart(k - 3 * 864e5); }
  return n;
}
function blockWeek(){ if (!S.blockStart) return 1; return Math.floor((weekStart(Date.now()) - weekStart(S.blockStart)) / (7 * 864e5)) + 1; }
function entriesFor(en){ const out = []; S.workouts.forEach(w => w.items.forEach(it => { if (it.en === en && it.sets.some(s => s.done)) out.push({w, it}); })); return out; }
function lastFor(en){ const e = entriesFor(en); return e.length ? e[e.length - 1] : null; }
function bestFor(en){
  let bw = -1, br = 0;
  entriesFor(en).forEach(({it}) => it.sets.forEach(s => { if (!s.done || s.w == null) return; if (s.w > bw){ bw = s.w; br = s.r || 0; } else if (s.w === bw && (s.r || 0) > br) br = s.r || 0; }));
  return bw < 0 ? null : {w: bw, r: br};
}
function suggestUp(step, en){
  const l = lastFor(en); if (!l || step.type !== 'weight' || step.unit !== 'reps' || !step.max) return null;
  const done = l.it.sets.filter(s => s.done);
  if (done.length < step.sets) return null;
  const w0 = done[0].w; if (w0 == null) return null;
  if (done.every(s => s.w === w0 && (s.r || 0) >= step.max)) return w0 + step.step;
  return null;
}
const effStep = (day, id) => { const s = stepById(day, id); const a = S.active && S.active.items[id]; return a && a.useAlt && s.alt ? Object.assign({}, s, s.alt, {id: s.id, kind: s.kind, note: s.note, isAlt: true}) : s; };
function perSet(st){ return st.type === 'warm' ? 1.5 : st.type === 'body' || st.kind === 'core' || st.kind === 'warm' ? 1.1 : 2.4; }
function remainingMin(){
  const A = S.active; let m = 0, n = 0;
  A.queue.forEach(id => { const st = effStep(A.day, id); if (st.kind === 'extra') return; const it = A.items[id]; const done = it ? it.sets.filter(s => s.done).length : 0; const left = st.sets - done; if (left > 0){ m += left * perSet(st); n++; } });
  return {min: m, ex: n};
}
function tonnageOf(items){
  let t = 0; items.forEach(it => { if (it.type !== 'weight' || it.unit !== 'reps') return; it.sets.forEach(s => { if (s.done && s.w && s.r) t += s.w * s.r * (it.side ? 2 : 1); }); }); return t;
}

/* ---------- досягнення ---------- */
const ACH = [
  ['first','🎉','Перше тренування', s => s.workouts.length >= 1],
  ['w10','🥉','10 тренувань', s => s.workouts.length >= 10],
  ['w25','🥈','25 тренувань', s => s.workouts.length >= 25],
  ['w50','🥇','50 тренувань', s => s.workouts.length >= 50],
  ['w100','🏆','100 тренувань', s => s.workouts.length >= 100],
  ['week','📅','Повний тиждень: 3 з 3', s => [...weekCounts().values()].some(v => v >= 3)],
  ['month','🔥','Місяць без пропусків', s => streakWeeks() >= 4],
  ['block','🎓','Блок 8 тижнів завершено', s => s.blockStart && blockWeek() > 8 && s.workouts.filter(w => w.start >= s.blockStart).length >= 20],
  ['pr1','⭐','Перший рекорд', s => s.workouts.some(w => (w.prs || []).length)],
  ['pr10','🌟','10 рекордів', s => s.workouts.reduce((a, w) => a + (w.prs || []).length, 0) >= 10],
  ['up10','📈','+10 разів додала вагу', s => s.workouts.reduce((a, w) => a + (w.ups || 0), 0) >= 10],
  ['t5','🏋️','5 тонн за тренування', s => s.workouts.some(w => w.tonnage >= 5000)],
  ['t100','💯','100 тонн загалом', s => s.workouts.reduce((a, w) => a + (w.tonnage || 0), 0) >= 100000],
  ['extra','⏱️','Встигла «Якщо є час»', s => s.workouts.some(w => w.items.some(it => it.kind === 'extra' && it.sets.some(x => x.done)))],
  ['shake','🥤','10 вечірніх шейків', s => s.workouts.filter(w => new Date(w.end).getHours() >= 16).length >= 10],
  ['m1','📏','Перші заміри', s => s.measurements.length >= 1],
  ['m4','📐','Заміри 4 тижні поспіль', s => { const ws = new Set(s.measurements.map(m => weekStart(new Date(m.date).getTime()))); let k = weekStart(Date.now()), n = 0; if (!ws.has(k)) k = weekStart(k - 3 * 864e5); while (ws.has(k)){ n++; k = weekStart(k - 3 * 864e5); } return n >= 4; }]
];
function checkAch(){ const fresh = []; ACH.forEach(([id,,, test]) => { if (!S.ach[id]){ let ok = false; try { ok = !!test(S); } catch(e){} if (ok){ S.ach[id] = Date.now(); fresh.push(id); } } }); return fresh; }
const achById = id => ACH.find(a => a[0] === id);

/* ---------- вибір людини ---------- */
function chooseScreen(){
  return `<div class="choose">
    <img class="logo" src="icons/icon-192.png" alt="">
    <h1>Хто тренується на цьому телефоні?</h1>
    <p class="muted">Кожна бачить свою програму й свій трекер. Дані зберігаються лише на цьому телефоні.</p>
    <button class="big" data-person="p1">${esc(P.people.p1)}</button>
    <button class="big" data-person="p2">${esc(P.people.p2)}</button>
  </div>`;
}

/* ---------- сьогодні ---------- */
function todayScreen(){
  const day = selDay || (S.active ? S.active.day : nextDay());
  const steps = plan(day).filter(s => s.kind !== 'extra');
  const ws = weekStart(Date.now());
  const thisWeek = new Set(S.workouts.filter(w => weekStart(w.start) === ws).map(w => w.day));
  const est = Math.round(steps.reduce((a, s) => a + s.sets * perSet(s), 0) + 6);
  const streak = streakWeeks();
  const bw = blockWeek();
  const backupOld = S.workouts.length >= 3 && (!S.lastBackup || Date.now() - S.lastBackup > 30 * 864e5);
  const names = steps.filter(s => s.kind === 'main').map(s => s.en);
  return `<div class="top"><h1>Привіт, ${esc(who())}</h1><button class="iconbtn" data-act="settings" aria-label="Налаштування">⚙️</button></div>
    <div class="row wrap" style="margin-bottom:14px">
      <span class="pill">${bw <= 8 ? `Тиждень ${bw} з 8` : 'Блок завершено'}</span>
      <span class="pill">🔥 Серія: ${streak} ${streak === 1 ? 'тиждень' : streak >= 2 && streak <= 4 ? 'тижні' : 'тижнів'}</span>
    </div>
    ${backupOld ? `<div class="banner">💾 <span class="grow">${S.lastBackup ? `Остання резервна копія ${Math.floor((Date.now() - S.lastBackup) / 864e5)} дн. тому` : 'Резервної копії ще немає'}</span><button class="btn" data-act="backup">Зберегти</button></div>` : ''}
    <div class="card">
      <div class="row" style="justify-content:space-between">
        <h2>${DAY_NAME[day]}</h2>
        <div class="seg" role="group" aria-label="День">${DAY_ORDER.map(k => `<button data-day="${k}" aria-pressed="${k === day}" ${S.active ? 'disabled' : ''}>${DAY_TAB[k]}</button>`).join('')}</div>
      </div>
      <p class="muted small" style="margin-top:4px">${steps.length} вправ · ~${est} хв · ${S.settings.duration} хв у залі</p>
      <ul class="preview">${names.map(n => `<li><b>${esc(n)}</b> · ${esc(lib(n).ua || '')}</li>`).join('')}</ul>
      <button class="big" data-act="start" data-dayv="${day}">${S.active ? '▶ ПРОДОВЖИТИ ТРЕНУВАННЯ' : '▶ ПОЧАТИ ТРЕНУВАННЯ'}</button>
      <div class="dots">${DAY_ORDER.map(k => `<span class="dot ${thisWeek.has(k) ? 'done' : ''}"><i></i>${DAY_TAB[k]}</span>`).join('')}<span class="dot" style="margin-left:auto">цей тиждень</span></div>
    </div>
    <button class="big ghost" data-act="dayplan" data-dayv="${day}">План дня й техніка</button>
    ${tabbar()}`;
}

/* ---------- старт тренування ---------- */
function startWorkout(day){
  if (!S.active){
    const q = plan(day).map(s => s.id);
    S.active = { day, start: Date.now(), queue: q, idx: 0, items: {}, overAsked: false, prs: [], ups: 0, restEnd: null, restTotal: 0 };
    save();
  }
  requestWake();
  go('workout');
}
function ensureItem(id){
  const A = S.active; if (A.items[id]) return A.items[id];
  const st = effStep(A.day, id);
  const it = { en: st.en, useAlt: false, sets: [] };
  A.items[id] = it; fillSets(id); return it;
}
function fillSets(id){
  const A = S.active, it = A.items[id], st = effStep(A.day, id);
  it.en = st.en;
  const last = lastFor(st.en);
  const up = suggestUp(st, st.en);
  it.sets = Array.from({length: st.sets}, (_, i) => {
    const ls = last ? (last.it.sets[i] || last.it.sets[last.it.sets.length - 1]) : null;
    let w = ls ? ls.w : null, r = ls ? ls.r : (st.min || null);
    if (up != null) w = up;
    if (st.type === 'warm') return {done: false};
    if (st.type === 'body') w = null;
    return {w, r, done: false};
  });
}

/* ---------- екран вправи ---------- */
function techHtml(en){
  const L = lib(en), t = L.tech; if (!t) return '';
  const m = L.muscles;
  const figure = m ? `<div class="tfig">${bodySvg(k => m.p.includes(k) ? 'mp' : m.s.includes(k) ? 'ms' : 'm0', k => P.muscles[k] || k, "Задіяні м'язи")}</div>` : '';
  const pers = t[person] ? `<p class="pers"><b>${esc(who())}:</b> ${esc(t[person])}</p>` : '';
  return `<div class="tech">${figure}
    <h5>Як працює</h5><p>${esc(t.how)}</p>
    ${t.why ? `<h5>Що дає</h5><p>${esc(t.why)}</p>` : ''}
    <h5>Техніка</h5><ol>${t.steps.map(x => `<li>${esc(x)}</li>`).join('')}</ol>
    <h5>Тіпс</h5><ul>${t.tips.map(x => `<li>${esc(x)}</li>`).join('')}</ul>${pers}</div>`;
}
let techOpen = false;
function stepper(i, field, val, unit, stepv){
  return `<div class="step"><button data-act="dec" data-i="${i}" data-f="${field}" data-s="${stepv}" aria-label="менше">−</button>
    <input inputmode="decimal" enterkeyhint="done" data-i="${i}" data-f="${field}" value="${val == null ? '' : fmt(val)}" placeholder="—" aria-label="${field === 'w' ? 'вага' : 'повтори'}">
    <button data-act="inc" data-i="${i}" data-f="${field}" data-s="${stepv}" aria-label="більше">+</button></div>`;
}
function workoutScreen(){
  const A = S.active; if (!A) return todayScreen();
  if (A.idx >= A.queue.length) A.idx = A.queue.length - 1;
  const id = A.queue[A.idx]; const st = effStep(A.day, id); const it = ensureItem(id);
  const L = lib(st.en);
  const mainIds = A.queue.filter(q => effStep(A.day, q).kind !== 'extra');
  const doneCount = A.queue.filter(q => { const x = A.items[q]; return x && x.sets.length && x.sets.every(s => s.done); }).length;
  const pct = Math.round(doneCount / Math.max(1, mainIds.length) * 100);
  const last = lastFor(st.en);
  const up = suggestUp(st, st.en);
  const unitR = st.unit === 'sec' ? 'с' : st.unit === 'm' ? 'м' : '';
  const kindLbl = {warm:'Розминка', main:'Силова', core:'Кор', extra:'Якщо є час'}[st.kind];
  let rows = '';
  if (st.type === 'warm'){
    const d = it.sets[0] && it.sets[0].done;
    rows = `<button class="warmcheck ${d ? 'done' : ''}" data-act="warm"><i>${d ? '✓' : ''}</i>${d ? 'Зроблено' : 'Позначити як зроблено'}</button>`;
  } else {
    const hdr = `<div class="sethdr"><span>#</span><span>${st.type === 'weight' ? 'Вага, кг' : ''}</span><span>${st.unit === 'sec' ? 'Секунди' : st.unit === 'm' ? 'Метри' : 'Повтори'}${st.side ? '/бік' : ''}</span><span></span></div>`;
    rows = `<div class="sets">${hdr}${it.sets.map((s, i) => `<div class="set ${s.done ? 'done' : ''}"><span class="n">${i + 1}</span>
      ${st.type === 'weight' ? stepper(i, 'w', s.w, 'кг', st.step) : `<span class="muted small" style="text-align:center">${st.type === 'body' ? 'вага тіла' : ''}</span>`}
      ${stepper(i, 'r', s.r, unitR, st.unit === 'sec' ? 5 : st.unit === 'm' ? 5 : 1)}
      <button class="check" data-act="done" data-i="${i}" aria-label="підхід ${i + 1} зроблено">✓</button></div>`).join('')}</div>`;
  }
  const lastTxt = last ? `Минулого разу (${dShort(last.w.start)}): <b>${last.it.sets.filter(s => s.done).map(s => st.type === 'weight' ? `${fmt(s.w)} кг × ${fmt(s.r)}` : `${fmt(s.r)}${unitR ? ' ' + unitR : ''}`).join(', ') || '—'}</b>` : 'Вперше: підбери вагу з запасом 2–3 повтори.';
  const isLast = A.idx === A.queue.length - 1;
  const nextIsExtra = !isLast && effStep(A.day, A.queue[A.idx + 1]).kind === 'extra' && st.kind !== 'extra';
  return `<div class="wtop"><button class="iconbtn" data-act="queue" aria-label="План тренування">☰</button>
      <span class="muted">${A.idx + 1}/${A.queue.length}</span>
      <div class="clock" id="clock"></div></div>
    <div class="progress"><i style="width:${pct}%"></i></div>
    <div class="card">
      <div class="kindtag ${st.kind === 'extra' ? 'extra' : ''}">${kindLbl}${st.isAlt ? ' · заміна' : ''}</div>
      <h1 class="exname">${esc(st.en)}</h1>
      <p class="exua">${esc(st.ua || L.ua || '')}</p>
      ${L.mach ? `<p class="mach">${esc(L.mach)}</p>` : ''}
      ${st.note ? `<p class="note">${esc(st.note)}</p>` : ''}
      <p class="dose">План: <b>${esc(st.dose)}</b></p>
      ${st.type === 'weight' || last ? `<div class="last">${lastTxt}</div>` : ''}
      ${up != null ? `<div class="up">⬆ Час додати вагу: спробуй ${fmt(up)} кг</div>` : ''}
      ${rows}
      <div class="tools">
        ${L.tech ? `<button class="btn" data-act="tech" aria-expanded="${techOpen}">Техніка ${techOpen ? '▴' : '▾'}</button>` : ''}
        ${L.video ? `<a class="btn" style="display:grid;place-items:center;text-decoration:none" href="${esc(L.video)}" target="_blank" rel="noopener">▶ Відео</a>` : ''}
        ${st.kind !== 'warm' ? `<button class="btn" data-act="busy">Зайнято?</button>` : ''}
      </div>
      ${techOpen ? techHtml(st.en) : ''}
    </div>
    ${nextIsExtra ? `<p class="muted small" style="text-align:center">Основне тренування — до кінця цієї вправи. Далі «Якщо є час».</p>` : ''}
    <div class="rest" id="rest" hidden></div>
    <div class="wnav"><div>
      ${navButtons(st, isLast, nextIsExtra)}
    </div></div>`;
}
function navButtons(st, isLast, nextIsExtra){
  const A = S.active;
  const back = `<button data-act="prev" ${A.idx === 0 ? 'disabled' : ''}>◀ Назад</button>`;
  const fin = `<button class="fin" data-act="finish">Завершити ✓</button>`;
  if (isLast) return back + fin;
  if (st.kind === 'extra') return fin + `<button class="acc" data-act="next">Далі ▶</button>`;
  if (nextIsExtra && allMainDone()) return fin + `<button class="acc" data-act="next">Якщо є час ▶</button>`;
  return back + `<button class="acc" data-act="next">Далі ▶</button>`;
}
function allMainDone(){ const A = S.active; return A.queue.every(q => { const st = effStep(A.day, q); if (st.kind === 'extra') return true; const x = A.items[q]; return x && x.sets.length && x.sets.every(s => s.done); }); }
function mainLeft(){ const A = S.active; return A.queue.filter(q => { const st = effStep(A.day, q); if (st.kind === 'extra') return false; const x = A.items[q]; return !(x && x.sets.length && x.sets.every(s => s.done)); }); }

/* годинник, відпочинок і перевірка часу */
let audioCtx = null;
function beep(){ try { audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)(); const o = audioCtx.createOscillator(), g = audioCtx.createGain(); o.frequency.value = 880; g.gain.setValueAtTime(.001, audioCtx.currentTime); g.gain.exponentialRampToValueAtTime(.3, audioCtx.currentTime + .02); g.gain.exponentialRampToValueAtTime(.001, audioCtx.currentTime + .5); o.connect(g).connect(audioCtx.destination); o.start(); o.stop(audioCtx.currentTime + .55); } catch(e){} }
function tick(){
  if (screen !== 'workout' || !S.active) return;
  const A = S.active, el = document.getElementById('clock');
  const elapsed = (Date.now() - A.start) / 1000, total = S.settings.duration * 60, left = total - elapsed;
  const r = remainingMin();
  if (el){
    let msg, cls;
    if (r.ex === 0){ msg = left > 0 ? `лишилось ~${Math.round(left / 60)} хв · основне готово` : 'основне готово'; cls = 'okc'; }
    else if (left <= 0){ msg = `час вийшов · ще ~${Math.round(r.min)} хв`; cls = 'warnc'; }
    else if (r.min <= left / 60){ msg = `лишилось ~${Math.round(left / 60)} хв ✅ встигаєш`; cls = 'okc'; }
    else { msg = `лишилось ~${Math.round(left / 60)} хв ⚠️ ${r.ex} впр. можуть не влізти`; cls = 'warnc'; }
    el.innerHTML = `<b>⏱ ${mmss(elapsed)}</b><small class="${cls}">${msg}</small>`;
  }
  const rest = document.getElementById('rest');
  if (rest){
    if (A.restEnd){
      const rl = (A.restEnd - Date.now()) / 1000;
      rest.hidden = false;
      rest.className = 'rest' + (rl <= 0 ? ' over' : '');
      rest.innerHTML = `<div>${rl > 0 ? `⏳ Відпочинок <b>${mmss(rl)}</b>` : '⏰ <b>Можна наступний підхід</b>'}<button data-act="rest30">+30 с</button><button data-act="restx" aria-label="Закрити">✕</button></div>`;
      if (rl <= 0 && !A.restBeeped){ A.restBeeped = true; beep(); }
      if (rl < -45){ A.restEnd = null; rest.hidden = true; save(); }
    } else rest.hidden = true;
  }
  if (left <= 0 && !A.overAsked && r.ex > 0 && sheetEl.hidden){
    A.overAsked = true; save();
    openSheet(`<h2>${S.settings.duration} хв минуло ⏱</h2><p>Лишилось ${r.ex} ${r.ex === 1 ? 'вправа' : r.ex < 5 ? 'вправи' : 'вправ'} (~${Math.round(r.min)} хв). Доробиш?</p>
      <div class="opts"><button data-act="closesheet">💪 Доробити решту<small>Тренування продовжується</small></button>
      <button data-act="finish">✓ Завершити зараз<small>Збережеться те, що зроблено</small></button></div>`);
  }
}
setInterval(tick, 1000);

function restFor(st){ return st.kind === 'core' || st.type === 'body' ? S.settings.restCore : (st.min && st.min <= 8 ? S.settings.restMain : S.settings.restIso); }
function markDone(i){
  const A = S.active, id = A.queue[A.idx], st = effStep(A.day, id), it = A.items[id], s = it.sets[i];
  if (s.done){ s.done = false; save(); render(); return; }
  if (st.type === 'weight' && s.w == null){ toast('Вкажи вагу'); return; }
  if (s.r == null){ toast(st.unit === 'sec' ? 'Вкажи секунди' : st.unit === 'm' ? 'Вкажи метри' : 'Вкажи повтори'); return; }
  s.done = true; s.at = Date.now();
  // наступні підходи підтягують вагу й повтори, якщо ще порожні
  for (let j = i + 1; j < it.sets.length; j++){ if (!it.sets[j].done){ if (it.sets[j].w == null) it.sets[j].w = s.w; if (it.sets[j].r == null) it.sets[j].r = s.r; } }
  // рекорд
  if (st.type === 'weight' && st.unit === 'reps'){
    const b = bestFor(st.en);
    if (b && (s.w > b.w || (s.w === b.w && s.r > b.r)) && !A.prs.some(p => p.en === st.en && (p.w > s.w || (p.w === s.w && p.r >= s.r)))){
      A.prs = A.prs.filter(p => p.en !== st.en); A.prs.push({en: st.en, w: s.w, r: s.r});
      const nxt = st.max && s.r >= st.max ? `<br><small>Наступного разу: ${fmt(s.w + st.step)} кг</small>` : '';
      toast(`🏆 Новий рекорд!<br>${esc(st.en)} ${fmt(s.w)} кг × ${fmt(s.r)}${nxt}`, 'pr');
    }
  }
  const allDone = it.sets.every(x => x.done);
  if (!allDone){ A.restEnd = Date.now() + restFor(st) * 1000; A.restBeeped = false; }
  else if (st.kind === 'warm'){ A.restEnd = null; }
  else { A.restEnd = Date.now() + restFor(st) * 1000; A.restBeeped = false; toast('Вправу завершено ✓ — тисни «Далі»'); }
  save(); render();
}

/* черга й «Зайнято?» */
function queueSheet(){
  const A = S.active;
  const li = (id, i) => { const st = effStep(A.day, id), x = A.items[id]; const d = x ? x.sets.filter(s => s.done).length : 0;
    const mark = x && x.sets.length && d === x.sets.length ? '✅' : d ? '◐' : '○';
    return `<li><button data-act="jump" data-i="${i}" ${i === A.idx ? 'aria-current="step"' : ''}><span class="st">${mark}</span><span class="qn">${esc(st.en)}<small>${esc(st.dose)}${st.isAlt ? ' · заміна' : ''}</small></span></button></li>`; };
  const main = [], extra = [];
  A.queue.forEach((id, i) => (effStep(A.day, id).kind === 'extra' ? extra : main).push(li(id, i)));
  openSheet(`<h2>${DAY_NAME[A.day]}</h2><ul class="qlist">${main.join('')}</ul>
    ${extra.length ? `<div class="qsec">Якщо є час</div><ul class="qlist">${extra.join('')}</ul>` : ''}
    <div class="opts"><button data-act="finish">✓ Завершити тренування<small>Збережеться те, що зроблено</small></button>
    <button data-act="cancelw">✕ Скасувати тренування<small>Нічого не збережеться</small></button></div>`);
}
function busySheet(){
  const A = S.active, id = A.queue[A.idx], base = stepById(A.day, id), it = A.items[id];
  const opts = [];
  if (base.alt && !it.useAlt) opts.push(`<button data-act="usealt">↔ Замінити: ${esc(base.alt.en)}<small>${esc(base.alt.ua)} · ${esc(base.alt.dose)}</small></button>`);
  if (it.useAlt) opts.push(`<button data-act="usebase">↩ Повернути: ${esc(base.en)}<small>${esc(base.ua)}</small></button>`);
  const lastMain = A.queue.map((q, i) => [q, i]).filter(([q]) => effStep(A.day, q).kind !== 'extra').pop();
  if (lastMain && lastMain[1] > A.idx) opts.push(`<button data-act="toend">⏭ Зробити наступну, а цю — в кінець черги<small>Повернешся до неї пізніше</small></button>`);
  if (!opts.length) opts.push(`<button data-act="closesheet">Зачекати<small>Інших варіантів для цієї вправи немає</small></button>`);
  openSheet(`<h2>Тренажер зайнятий</h2><p>${esc(base.en)}</p><div class="opts">${opts.join('')}</div>`);
}

/* ---------- завершення ---------- */
const PHRASES_EVENING = ['Заслужила! Тепер можна взяти шейк в автоматі 🥤','Шейк з автомата чекає на тебе 🥤','Тренування зараховано. Шейк — теж 🥤','Автомат із шейками вже знає твоє імʼя 🥤','Сильна. Шейк — заслужений 🥤'];
const PHRASES_DAY = ['Готово! Так тримати 💪','Ще одна цеглинка в сильне тіло 🧱','Зараховано ✅','Ти це зробила 🔥'];
let lastFinished = null;
function finishWorkout(){
  const A = S.active; if (!A) return;
  const items = A.queue.map(id => { const st = effStep(A.day, id), x = A.items[id]; return x ? {en: st.en, kind: st.kind, type: st.type, unit: st.unit, side: !!st.side, alt: !!st.isAlt, sets: x.sets.filter(s => s.done).map(s => ({w: s.w ?? null, r: s.r ?? null, done: true}))} : null; }).filter(x => x && x.sets.length);
  let ups = 0;
  items.forEach(it => { if (it.type !== 'weight') return; const l = lastFor(it.en); if (l && l.it.sets[0] && it.sets[0] && it.sets[0].w > l.it.sets[0].w) ups++; });
  const rec = { id: 'w' + A.start, day: A.day, start: A.start, end: Date.now(), items, prs: A.prs, ups, tonnage: tonnageOf(items), sets: items.filter(it => it.kind !== 'warm').reduce((a, it) => a + it.sets.length, 0), mood: null, note: '' };
  if (!S.blockStart) S.blockStart = A.start;
  S.workouts.push(rec); S.active = null;
  const fresh = checkAch();
  save(); closeSheet(); releaseWake();
  const h = new Date().getHours();
  lastFinished = { id: rec.id, fresh, phrase: (h >= 16 ? PHRASES_EVENING : PHRASES_DAY)[Math.floor(Math.random() * (h >= 16 ? PHRASES_EVENING : PHRASES_DAY).length)], evening: h >= 16 };
  go('finish'); confetti();
}
const SHAKE_SVG = `<svg class="shake" viewBox="0 0 120 120" aria-hidden="true"><path d="M70 6 L62 34" stroke="#ff7a59" stroke-width="5" stroke-linecap="round"/><path d="M30 34 H90 L82 108 Q81 114 75 114 H45 Q39 114 38 108 Z" fill="#f2f4f7"/><path d="M33 56 H87 L84 84 H36 Z" fill="#ffb59f"/><rect x="26" y="28" width="68" height="10" rx="5" fill="#ff7a59"/><circle cx="50" cy="70" r="3" fill="#fff"/><circle cx="66" cy="76" r="2" fill="#fff"/><path d="M48 96 q12 8 24 0" stroke="#2a2f38" stroke-width="3" fill="none" stroke-linecap="round"/><circle cx="50" cy="88" r="2.5" fill="#2a2f38"/><circle cx="70" cy="88" r="2.5" fill="#2a2f38"/></svg>`;
function finishScreen(){
  const f = lastFinished; const w = f && S.workouts.find(x => x.id === f.id);
  if (!w) return todayScreen();
  const dur = Math.round((w.end - w.start) / 60000);
  return `<div class="fin-hero">${f.evening ? SHAKE_SVG : ''}<h1>🎉 Готово!</h1><p>${esc(f.phrase)}</p></div>
    <div class="stats">
      <div class="stat"><b>${dur} хв</b><span>тривалість</span></div>
      <div class="stat"><b>${w.sets}</b><span>підходів</span></div>
      <div class="stat"><b>${fmtInt(w.tonnage)} кг</b><span>піднято загалом</span></div>
      <div class="stat"><b>${w.prs.length}</b><span>${w.prs.length === 1 ? 'рекорд' : 'рекордів'}</span></div>
    </div>
    ${w.prs.map(p => `<div class="newach"><span>🏆</span><div><b>${esc(p.en)}</b><br><small class="muted">${fmt(p.w)} кг × ${fmt(p.r)}</small></div></div>`).join('')}
    ${f.fresh.map(id => { const a = achById(id); return `<div class="newach"><span>${a[1]}</span><div><b>Нова ачівка!</b><br>${esc(a[2])}</div></div>`; }).join('')}
    <div class="card"><h3>Як пройшло?</h3>
      <div class="moods">${['😫','😐','🙂','💪'].map(m => `<button data-mood="${m}" aria-pressed="${w.mood === m}">${m}</button>`).join('')}</div>
      <textarea id="wnote" placeholder="Нотатка: як почувалась, що відзначити…">${esc(w.note)}</textarea>
    </div>
    <button class="big" data-act="savefin">Зберегти</button>`;
}

/* ---------- конфеті ---------- */
function confetti(){
  const c = document.getElementById('confetti'); const ctx = c.getContext('2d');
  const dpr = window.devicePixelRatio || 1; c.width = innerWidth * dpr; c.height = innerHeight * dpr; ctx.scale(dpr, dpr);
  const cols = ['#ff7a59','#ffcf5a','#3ecf8e','#7aa7ff','#f2f4f7','#ff5fa2'];
  const ps = Array.from({length: 160}, () => ({ x: innerWidth / 2 + (Math.random() - .5) * 80, y: innerHeight * .35, vx: (Math.random() - .5) * 12, vy: -Math.random() * 13 - 4, r: Math.random() * 6 + 4, c: cols[Math.floor(Math.random() * cols.length)], a: Math.random() * 6, va: (Math.random() - .5) * .3 }));
  let t = 0;
  (function f(){ t++; ctx.clearRect(0, 0, innerWidth, innerHeight);
    ps.forEach(p => { p.vy += .32; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.a += p.va; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.fillStyle = p.c; ctx.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2); ctx.restore(); });
    if (t < 170) requestAnimationFrame(f); else ctx.clearRect(0, 0, innerWidth, innerHeight); })();
}

/* ---------- план дня (без тренування) ---------- */
function dayPlanSheet(day){
  const st = plan(day);
  const sec = (k, t) => { const l = st.filter(s => s.kind === k); return l.length ? `<div class="qsec">${t}</div><ul class="qlist">${l.map(s => `<li><button data-act="planex" data-day="${day}" data-id="${s.id}"><span class="qn">${esc(s.en)}<small>${esc(s.ua)} · ${esc(s.dose)}</small></span><span class="st">›</span></button></li>`).join('')}</ul>` : ''; };
  openSheet(`<h2>${DAY_NAME[day]}</h2>${sec('warm','Розминка')}${sec('main','Силова')}${sec('core','Кор')}${sec('extra','Якщо є час')}`);
}
function exSheet(day, id){
  const s = stepById(day, id), L = lib(s.en);
  openSheet(`<h2>${esc(s.en)}</h2><p>${esc(s.ua)}${L.mach ? `<br><i>${esc(L.mach)}</i>` : ''}<br>План: <b>${esc(s.dose)}</b>${s.note ? `<br>${esc(s.note)}` : ''}</p>
    ${L.video ? `<p><a class="btn" href="${esc(L.video)}" target="_blank" rel="noopener">▶ Відео</a></p>` : ''}
    ${techHtml(s.en) || '<p>Техніки для цієї вправи немає.</p>'}
    <div class="opts" style="margin-top:14px"><button data-act="dayplan" data-dayv="${day}">← До плану дня</button></div>`);
}

/* ---------- історія ---------- */
const moodOf = w => w.mood || '';
function historyScreen(){
  const ws = [...S.workouts].reverse();
  return `<div class="top"><h1>Історія</h1></div>
    ${ws.length ? `<div class="hlist">${ws.map(w => `<button class="hitem" data-hist="${w.id}"><b>${dShort(w.start)} · ${DAY_NAME[w.day]}</b> ${moodOf(w)}<small>${Math.round((w.end - w.start) / 60000)} хв · ${w.sets} підходів · ${fmtInt(w.tonnage)} кг${w.prs.length ? ` · 🏆 ${w.prs.length}` : ''}</small></button>`).join('')}</div>`
      : `<div class="empty">Тут зʼявляться тренування після першого завершеного.</div>`}
    ${tabbar()}`;
}
function histSheet(id){
  const w = S.workouts.find(x => x.id === id); if (!w) return;
  openSheet(`<h2>${dShort(w.start)} · ${DAY_NAME[w.day]} ${moodOf(w)}</h2>
    <p>${new Date(w.start).toTimeString().slice(0, 5)}–${new Date(w.end).toTimeString().slice(0, 5)} · ${w.sets} підходів · ${fmtInt(w.tonnage)} кг</p>
    ${w.note ? `<p>📝 ${esc(w.note)}</p>` : ''}
    <div>${w.items.map(it => `<div class="hex"><b>${esc(it.en)}</b>${it.alt ? ' <small class="muted">(заміна)</small>' : ''}<div class="s">${it.sets.map(s => it.type === 'weight' ? `${fmt(s.w)} кг × ${fmt(s.r)}` : s.r != null ? `${fmt(s.r)}${it.unit === 'sec' ? ' с' : it.unit === 'm' ? ' м' : ''}` : '✓').join(' · ')}</div></div>`).join('')}</div>
    <div class="opts" style="margin-top:14px"><button data-act="delw" data-id="${w.id}">🗑 Видалити це тренування<small>Назавжди</small></button><button data-act="closesheet">Закрити</button></div>`);
}

/* ---------- прогрес ---------- */
function calMonth(y, m, days){
  const first = new Date(y, m, 1), n = new Date(y, m + 1, 0).getDate(), off = (first.getDay() + 6) % 7, today = iso(new Date());
  let h = ['Пн','Вт','Ср','Чт','Пт','Сб','Нд'].map(d => `<span class="wd">${d}</span>`).join('') + '<span class="e"></span>'.repeat(off);
  for (let d = 1; d <= n; d++){ const k = iso(new Date(y, m, d)); h += `<span class="${days.has(k) ? 'h' : ''} ${k === today ? 't' : ''}">${d}</span>`; }
  return `<h3 style="margin-top:12px">${MONTHS_FULL[m]} ${y}</h3><div class="cal">${h}</div>`;
}
function lineChart(pts, unit){
  if (pts.length < 2) return `<p class="muted small" style="margin-top:8px">${pts.length ? `${fmt(pts[0].y)} ${unit} — для графіка потрібно хоча б 2 записи.` : 'Ще немає даних.'}</p>`;
  const W = 320, H = 150, L = 34, R = 10, T = 12, B = 22;
  const ys = pts.map(p => p.y); let lo = Math.min(...ys), hi = Math.max(...ys); if (lo === hi){ lo -= 1; hi += 1; }
  const xs = pts.map(p => p.x), x0 = Math.min(...xs), x1 = Math.max(...xs) || x0 + 1;
  const X = x => L + (x - x0) / (x1 - x0 || 1) * (W - L - R), Y = y => T + (hi - y) / (hi - lo) * (H - T - B);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${X(p.x).toFixed(1)},${Y(p.y).toFixed(1)}`).join(' ');
  const dl = ts => { const t = new Date(ts); return `${t.getDate()} ${MONTHS[t.getMonth()]}`; };
  return `<div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Графік">
    <line class="gl" x1="${L}" x2="${W - R}" y1="${Y(hi)}" y2="${Y(hi)}"/><line class="gl" x1="${L}" x2="${W - R}" y1="${Y(lo)}" y2="${Y(lo)}"/>
    <text x="${L - 4}" y="${Y(hi) + 4}" text-anchor="end">${fmt(hi)}</text><text x="${L - 4}" y="${Y(lo) + 4}" text-anchor="end">${fmt(lo)}</text>
    <path class="ln" d="${d}"/>${pts.map(p => `<circle class="pt" cx="${X(p.x).toFixed(1)}" cy="${Y(p.y).toFixed(1)}" r="3.5"/>`).join('')}
    <text x="${L}" y="${H - 4}">${dl(x0)}</text><text x="${W - R}" y="${H - 4}" text-anchor="end">${dl(x1)}</text></svg><p class="muted small">${unit}</p></div>`;
}
function progressScreen(){
  const days = new Set(S.workouts.map(w => iso(new Date(w.start))));
  const now = new Date(), pm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const exs = [...new Set(S.workouts.flatMap(w => w.items.filter(it => it.type === 'weight' && it.unit === 'reps').map(it => it.en)))];
  if (!chartEx || !exs.includes(chartEx)) chartEx = exs[0] || null;
  const pts = chartEx ? entriesFor(chartEx).map(({w, it}) => ({x: w.start, y: Math.max(...it.sets.filter(s => s.done && s.w != null).map(s => s.w))})).filter(p => isFinite(p.y)) : [];
  const bw = blockWeek(), tot = S.workouts.reduce((a, w) => a + (w.tonnage || 0), 0);
  const unlocked = ACH.filter(a => S.ach[a[0]]).length;
  return `<div class="top"><h1>Прогрес</h1></div>
    <div class="kpis"><div class="stat"><b>${S.workouts.length}</b><span>тренувань</span></div><div class="stat"><b>🔥 ${streakWeeks()}</b><span>тижнів поспіль</span></div><div class="stat"><b>${fmt(Math.round(tot / 100) / 10)} т</b><span>піднято</span></div></div>
    <div class="card" style="margin-top:12px"><h3>Блок: ${bw <= 8 ? `тиждень ${bw} з 8` : 'завершено 🎓'}</h3><div class="bar"><i style="width:${Math.min(100, Math.round(Math.min(bw, 8) / 8 * 100))}%"></i></div>
      ${calMonth(now.getFullYear(), now.getMonth(), days)}${calMonth(pm.getFullYear(), pm.getMonth(), days)}</div>
    <div class="card"><h3>Ачівки · ${unlocked} з ${ACH.length}</h3><div class="achs">${ACH.map(([id, e, t]) => `<div class="ach ${S.ach[id] ? '' : 'lock'}"><span>${S.ach[id] ? e : '🔒'}</span>${esc(t)}</div>`).join('')}</div></div>
    <div class="card"><h3>Вага по вправі</h3>${exs.length ? `<select data-act="chartex" aria-label="Вправа">${exs.map(e => `<option ${e === chartEx ? 'selected' : ''}>${esc(e)}</option>`).join('')}</select>${lineChart(pts, 'найбільша вага за тренування, кг')}` : '<p class="muted small">Графік зʼявиться після першого тренування.</p>'}</div>
    ${tabbar()}`;
}

/* ---------- заміри ---------- */
const MF = [['weight','Вага','кг'],['chest','Груди','см'],['biceps','Біцепс','см'],['waist','Талія','см'],['hips','Стегна (обхват)','см'],['thigh','Стегно','см']];
function measureScreen(){
  const M = [...S.measurements].sort((a, b) => a.date.localeCompare(b.date));
  const last = M[M.length - 1], prev = M[M.length - 2];
  const pts = M.filter(m => m[mKey] != null).map(m => ({x: new Date(m.date).getTime(), y: m[mKey]}));
  const mf = MF.find(f => f[0] === mKey);
  return `<div class="top"><h1>Заміри</h1></div>
    <button class="big" data-act="addm">+ Додати заміри</button>
    ${last ? `<div class="card" style="margin-top:12px"><h3>Останні · ${dShort(new Date(last.date).getTime())}</h3>
      ${MF.map(([k, l, u]) => { const v = last[k], p = prev ? prev[k] : null; const dlt = v != null && p != null ? v - p : null;
        return `<div class="mrow"><span>${l}</span><span>${p != null && v != null ? `${fmt(p)} → ` : ''}<b>${fmt(v)}</b> ${u}${dlt ? ` <span class="${dlt < 0 ? 'dn' : 'upc'}">${dlt > 0 ? '↑' : '↓'}${fmt(Math.abs(dlt))}</span>` : ''}</span></div>`; }).join('')}</div>
      <div class="card"><h3>Графік</h3><select data-act="mkey" aria-label="Замір">${MF.map(([k, l]) => `<option value="${k}" ${k === mKey ? 'selected' : ''}>${l}</option>`).join('')}</select>${lineChart(pts, mf[1] + ', ' + mf[2])}
      <p class="muted small" style="margin-top:6px">Дивись на тенденцію за 3–4 тижні, а не на різницю між двома тижнями.</p></div>
      <div class="card"><h3>Усі записи</h3>${[...M].reverse().map(m => `<div class="mrow"><span>${dShort(new Date(m.date).getTime())}</span><span class="small">${MF.filter(([k]) => m[k] != null).map(([k,, u]) => fmt(m[k])).join(' · ')} <button class="btn" style="min-height:32px;padding:0 10px;margin-left:6px" data-act="delm" data-date="${m.date}" aria-label="Видалити">✕</button></span></div>`).join('')}</div>`
      : `<div class="empty">Вноси заміри раз на тиждень, вранці натщесерце — тут зʼявляться зміни й графіки.</div>`}
    ${tabbar()}`;
}
function addMeasureSheet(){
  const M = [...S.measurements].sort((a, b) => a.date.localeCompare(b.date)); const last = M[M.length - 1] || {};
  openSheet(`<h2>Нові заміри</h2><p>Порожні поля можна пропустити.</p>
    <div class="field" style="margin-bottom:10px"><label for="mdate">Дата</label><input type="date" id="mdate" value="${iso(new Date())}"></div>
    <div class="mgrid">${MF.map(([k, l, u]) => `<div class="field"><label for="m_${k}">${l}, ${u}</label><input id="m_${k}" inputmode="decimal" placeholder="${last[k] != null ? fmt(last[k]) : ''}"></div>`).join('')}</div>
    <div class="opts" style="margin-top:14px"><button class="btn acc" style="text-align:center" data-act="savem">Зберегти</button></div>`);
}

/* ---------- налаштування й резервна копія ---------- */
function settingsSheet(){
  const s = S.settings;
  openSheet(`<h2>Налаштування</h2>
    <p>Тривалість тренування</p>
    <div class="seg" role="group" aria-label="Тривалість">${[75, 90].map(v => `<button data-dur="${v}" aria-pressed="${s.duration === v}">${v} хв</button>`).join('')}</div>
    <p style="margin-top:14px">Тема</p>
    <div class="themes">${THEMES.map(([k, l, bg, ac]) => `<button data-theme="${k}" aria-pressed="${LS.get('trn:theme','dark') === k}" style="background:${bg};color:${ac}"><i><b style="background:${ac}"></b><b style="background:${bg};outline:1px solid ${ac}"></b></i>${l}</button>`).join('')}</div>
    <p style="margin-top:14px">Відпочинок між підходами</p>
    <div class="opts">
      ${[['restMain','Важкі базові (5–8 повторів)'],['restIso','Інші вправи'],['restCore','Кор']].map(([k, l]) => `<div style="padding:4px 0"><div class="small muted" style="margin-bottom:4px">${l}</div><span class="seg">${[45, 60, 90, 120, 150].map(v => `<button data-rest="${k}:${v}" aria-pressed="${s[k] === v}">${v >= 60 ? (v / 60).toString().replace('.', ',') + ' хв' : v + ' с'}</button>`).join('')}</span></div>`).join('')}
    </div>
    <p style="margin-top:14px">Дані</p>
    <div class="opts">
      <button data-act="backup">💾 Зберегти резервну копію<small>${S.lastBackup ? 'Остання: ' + dShort(S.lastBackup) : 'Ще не було'}</small></button>
      <button data-act="restore">📂 Відновити з копії<small>Замінить поточні дані</small></button>
      <button data-act="newblock">🔁 Почати новий 8-тижневий блок<small>Лічильник тижнів почнеться з сьогодні</small></button>
      <button data-act="switchp">👤 Змінити людину<small>Зараз: ${esc(who())}. Дані кожної зберігаються окремо</small></button>
    </div>
    <p class="muted small" style="margin-top:14px">Версія ${APP_VERSION} · програма від ${esc(P.version)}</p>
    <input type="file" id="restorefile" accept="application/json,.json" hidden>`);
}
async function backup(){
  const data = JSON.stringify({app: 'trn', person, exported: Date.now(), data: Object.assign({}, S, {active: null})});
  const name = `zal-${P.people[person]}-${iso(new Date())}.json`;
  try {
    const file = new File([data], name, {type: 'application/json'});
    if (navigator.canShare && navigator.canShare({files: [file]})){ await navigator.share({files: [file], title: name}); }
    else { const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }
    S.lastBackup = Date.now(); save(); toast('Резервну копію збережено 💾'); closeSheet(); render();
  } catch(e){ if (e && e.name !== 'AbortError') toast('Не вдалося зберегти копію'); }
}
function restoreFrom(file){
  const r = new FileReader();
  r.onload = () => { try { const j = JSON.parse(r.result); if (j.app !== 'trn' || !j.data || !Array.isArray(j.data.workouts)) throw 0;
      openSheet(`<h2>Відновити дані?</h2><p>Копія від ${dShort(j.exported)} (${esc(P.people[j.person] || '')}): ${j.data.workouts.length} тренувань. Поточні дані на цьому телефоні буде замінено.</p>
        <div class="opts"><button data-act="dorestore">Так, відновити</button><button data-act="closesheet">Скасувати</button></div>`);
      restoreFrom.pending = j; } catch(e){ toast('Це не файл резервної копії'); } };
  r.readAsText(file);
}

/* ---------- екран не гасне під час тренування ---------- */
let wake = null;
async function requestWake(){ try { if ('wakeLock' in navigator && !wake){ wake = await navigator.wakeLock.request('screen'); wake.addEventListener('release', () => { wake = null; }); } } catch(e){ wake = null; } }
function releaseWake(){ try { wake && wake.release(); } catch(e){} wake = null; }
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && screen === 'workout' && S && S.active) requestWake(); });

/* ---------- рендер ---------- */
function render(){
  if (!person){ app.innerHTML = chooseScreen(); return; }
  const map = {today: todayScreen, workout: workoutScreen, finish: finishScreen, history: historyScreen, progress: progressScreen, measure: measureScreen};
  app.innerHTML = (map[screen] || todayScreen)();
  app.classList.toggle('inworkout', screen === 'workout');
  tick();
}

/* ---------- події ---------- */
document.addEventListener('click', e => {
  const t = e.target.closest('button, [data-hist]'); if (!t) return;
  const d = t.dataset;
  if (d.person){ person = d.person; LS.set('trn:person', person); load(); go('today'); return; }
  if (d.go){ closeSheet(); go(d.go); return; }
  if (d.day && !d.act){ selDay = d.day; render(); return; }
  if (d.hist){ histSheet(d.hist); return; }
  if (d.mood){ const w = S.workouts.find(x => x.id === lastFinished.id); if (w){ w.mood = d.mood; save(); app.querySelectorAll('[data-mood]').forEach(b => b.setAttribute('aria-pressed', b.dataset.mood === d.mood)); } return; }
  if (d.theme){ LS.set('trn:theme', d.theme); applyTheme(); settingsSheet(); return; }
  if (d.dur){ S.settings.duration = +d.dur; save(); settingsSheet(); render(); return; }
  if (d.rest){ const [k, v] = d.rest.split(':'); S.settings[k] = +v; save(); settingsSheet(); return; }
  const A = S && S.active;
  switch (d.act){
    case 'settings': settingsSheet(); break;
    case 'closesheet': closeSheet(); break;
    case 'start': selDay = null; startWorkout(d.dayv); break;
    case 'dayplan': dayPlanSheet(d.dayv); break;
    case 'planex': exSheet(d.day, d.id); break;
    case 'tech': techOpen = !techOpen; render(); break;
    case 'busy': busySheet(); break;
    case 'queue': queueSheet(); break;
    case 'jump': A.idx = +d.i; techOpen = false; save(); closeSheet(); render(); window.scrollTo(0, 0); break;
    case 'prev': if (A.idx > 0){ A.idx--; techOpen = false; save(); render(); window.scrollTo(0, 0); } break;
    case 'next': if (A.idx < A.queue.length - 1){ A.idx++; techOpen = false; save(); render(); window.scrollTo(0, 0); } break;
    case 'done': markDone(+d.i); break;
    case 'warm': { const it = A.items[A.queue[A.idx]]; it.sets[0].done = !it.sets[0].done; save(); render(); if (it.sets[0].done) setTimeout(() => { if (S.active && A.idx < A.queue.length - 1){ A.idx++; save(); render(); window.scrollTo(0, 0); } }, 350); break; }
    case 'dec': case 'inc': {
      const it = A.items[A.queue[A.idx]], s = it.sets[+d.i]; const step = +d.s * (d.act === 'dec' ? -1 : 1);
      const cur = s[d.f] == null ? (d.f === 'w' ? 0 : 0) : s[d.f];
      s[d.f] = Math.max(0, Math.round((cur + step) * 100) / 100); save(); render(); break; }
    case 'rest30': if (A && A.restEnd){ A.restEnd = Math.max(A.restEnd, Date.now()) + 30000; A.restBeeped = false; save(); tick(); } break;
    case 'restx': if (A){ A.restEnd = null; save(); tick(); } break;
    case 'usealt': { const id = A.queue[A.idx]; A.items[id].useAlt = true; fillSets(id); save(); closeSheet(); render(); break; }
    case 'usebase': { const id = A.queue[A.idx]; A.items[id].useAlt = false; fillSets(id); save(); closeSheet(); render(); break; }
    case 'toend': { const id = A.queue.splice(A.idx, 1)[0]; const firstExtra = A.queue.findIndex(q => effStep(A.day, q).kind === 'extra'); A.queue.splice(firstExtra < 0 ? A.queue.length : firstExtra, 0, id); techOpen = false; save(); closeSheet(); render(); toast('Перенесено в кінець черги'); break; }
    case 'finish': {
      const left = mainLeft();
      if (left.length && !t.dataset.confirmed && !t.closest('.sh')){
        openSheet(`<h2>Завершити тренування?</h2><p>Лишилось ${left.length} ${left.length === 1 ? 'вправа' : left.length < 5 ? 'вправи' : 'вправ'}. Збережеться те, що зроблено.</p>
          <div class="opts"><button data-act="finish" data-confirmed="1">✓ Завершити</button><button data-act="closesheet">Продовжити тренування</button></div>`);
      } else finishWorkout();
      break; }
    case 'cancelw': openSheet(`<h2>Скасувати тренування?</h2><p>Нічого з сьогоднішнього не збережеться.</p><div class="opts"><button data-act="docancel">Так, скасувати</button><button data-act="closesheet">Ні, продовжити</button></div>`); break;
    case 'docancel': S.active = null; save(); closeSheet(); releaseWake(); go('today'); break;
    case 'savefin': { const w = S.workouts.find(x => x.id === lastFinished.id); const n = document.getElementById('wnote'); if (w && n){ w.note = n.value.trim(); save(); } toast('Збережено ✓'); go('today'); break; }
    case 'delw': openSheet(`<h2>Видалити тренування?</h2><p>Це не можна скасувати.</p><div class="opts"><button data-act="dodelw" data-id="${d.id}">🗑 Видалити</button><button data-act="closesheet">Ні</button></div>`); break;
    case 'dodelw': S.workouts = S.workouts.filter(w => w.id !== d.id); save(); closeSheet(); render(); break;
    case 'addm': addMeasureSheet(); break;
    case 'savem': {
      const date = document.getElementById('mdate').value || iso(new Date()); const m = {date};
      let any = false; MF.forEach(([k]) => { const v = num(document.getElementById('m_' + k).value); if (v != null){ m[k] = v; any = true; } });
      if (!any){ toast('Заповни хоча б одне поле'); break; }
      S.measurements = S.measurements.filter(x => x.date !== date); S.measurements.push(m);
      const fresh = checkAch(); save(); closeSheet(); render();
      toast(fresh.length ? `${achById(fresh[0])[1]} Нова ачівка: ${esc(achById(fresh[0])[2])}` : 'Заміри збережено ✓'); break; }
    case 'delm': S.measurements = S.measurements.filter(x => x.date !== d.date); save(); render(); break;
    case 'backup': backup(); break;
    case 'restore': { const f = document.getElementById('restorefile'); f.onchange = () => f.files[0] && restoreFrom(f.files[0]); f.click(); break; }
    case 'dorestore': { const j = restoreFrom.pending; if (j){ person = j.person in P.people ? j.person : person; LS.set('trn:person', person); S = Object.assign(blank(), j.data); save(); toast('Дані відновлено ✓'); } closeSheet(); go('today'); break; }
    case 'newblock': S.blockStart = Date.now(); save(); closeSheet(); render(); toast('Новий блок: тиждень 1 з 8'); break;
    case 'switchp': if (S.active){ toast('Спершу заверши тренування'); break; } person = null; LS.set('trn:person', null); closeSheet(); render(); break;
  }
});
document.addEventListener('input', e => {
  const t = e.target;
  if (t.matches('input[data-f]') && S && S.active){ const it = S.active.items[S.active.queue[S.active.idx]]; const s = it.sets[+t.dataset.i]; if (s){ s[t.dataset.f] = num(t.value); save(); } }
});
document.addEventListener('change', e => {
  const t = e.target;
  if (t.matches('input[data-f]') && S && S.active){
    const it = S.active.items[S.active.queue[S.active.idx]]; const s = it.sets[+t.dataset.i]; s[t.dataset.f] = num(t.value); save(); return;
  }
  if (t.dataset.act === 'chartex'){ chartEx = t.value; render(); }
  if (t.dataset.act === 'mkey'){ mKey = t.value; render(); }
});

/* ---------- старт ---------- */
load();
if (S && S.active) screen = 'workout';
render();
