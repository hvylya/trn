'use strict';
/* Зал на двох — офлайн-трекер тренувань. Дані зберігаються лише на цьому телефоні. */
const P = window.PROGRAM;
const APP_VERSION = '1.3.0';
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

/* ---------- іконки (власні, лінійні) ---------- */
const IP = {
  gym:'<path d="M6.5 6.5v11M3.5 9v6M17.5 6.5v11M20.5 9v6M6.5 12h11"/>',
  home:'<path d="M3 10.5 12 3l9 7.5"/><path d="M5.5 9v11h13V9"/><path d="M10 20v-5h4v5"/>',
  cal:'<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  chart:'<path d="M3.5 20.5h17"/><path d="M4.5 16l5-5 4 3.5 6-7"/><path d="M15 7.5h4.5V12"/>',
  ruler:'<path d="M14.6 3.4 20.6 9.4 9.4 20.6 3.4 14.6z"/><path d="M7.5 12l1.8 1.8M10 9.5l1.2 1.2M12.5 7l1.8 1.8"/>',
  sliders:'<path d="M4 6.5h9M17 6.5h3M4 12h3M11 12h9M4 17.5h11M19 17.5h1"/><circle cx="15" cy="6.5" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="17.5" r="2"/>',
  x:'<path d="M6 6l12 12M18 6 6 18"/>',
  down:'<path d="M6 9l6 6 6-6"/>',
  left:'<path d="M15 18l-6-6 6-6"/>',
  right:'<path d="M9 6l6 6-6 6"/>',
  list:'<path d="M9 6.5h11M9 12h11M9 17.5h11"/><circle cx="4.5" cy="6.5" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="17.5" r="1"/>',
  check:'<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  book:'<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5v-15"/>',
  video:'<circle cx="12" cy="12" r="9"/><path d="M10 8.5l5.5 3.5-5.5 3.5z"/>',
  swap:'<path d="M7 4 3 8l4 4M3 8h13M17 20l4-4-4-4M21 16H8"/>',
  tool:'<path d="M14.5 6.5a4 4 0 0 0-5.3 5L3.5 17.2l3.3 3.3 5.7-5.7a4 4 0 0 0 5-5.3l-2.4 2.4-2.3-.6-.6-2.3z"/>',
  trash:'<path d="M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13"/>',
  pencil:'<path d="M4 20h4L19.5 8.5l-4-4L4 16z"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  play:'<path d="M8 5.5v13l10.5-6.5z"/>',
  timer:'<circle cx="12" cy="13.5" r="7.5"/><path d="M12 10v3.5l2.5 2M9.5 2.5h5"/>'
};
const ic = (n, cls) => `<svg class="ic ${cls || ''}" viewBox="0 0 24 24" aria-hidden="true">${IP[n]}</svg>`;

/* ---------- сховище ---------- */
const LS = {
  get(k, d){ try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch(e){ return d; } },
  set(k, v){ try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch(e){ toast('Не вдалося зберегти дані'); return false; } }
};
let person = LS.get('trn:person', null);
let S = null;
const blank = () => ({ v:1, settings:{duration:90, restHeavy:150, restMain:120, restIso:90, restCore:45}, blockStart:null, blockLen:8, mnotes:{}, home:{}, deloadUntil:null, deloadSnooze:null, cpSeen:{}, workouts:[], active:null, measurements:[], ach:{}, lastBackup:null });
function load(){ S = Object.assign(blank(), person ? LS.get('trn:data:' + person, {}) : {}); S.settings = Object.assign(blank().settings, S.settings); if (!S.settings.durTouched) S.settings.duration = 90; }
function save(){ if (person) LS.set('trn:data:' + person, S); }
try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch(e){}
const THEMES = [['mocha','Catppuccin Mocha','#1e1e2e','#cba6f7'],['latte','Catppuccin Latte','#eff1f5','#8839ef'],['dawn','Rosé Pine Dawn','#faf4ed','#d7827e'],['nord','Nord','#2e3440','#88c0d0'],['gruvbox','Gruvbox','#282828','#fe8019'],['tokyo','Tokyo Night','#1a1b26','#7aa2f7']];
const curTheme = () => { const t = LS.get('trn:theme', 'mocha'); return THEMES.some(x => x[0] === t) ? t : 'mocha'; };
function applyTheme(){ const t = curTheme(); document.documentElement.dataset.theme = t; const th = THEMES.find(x => x[0] === t) || THEMES[0]; const m = document.querySelector('meta[name="theme-color"]'); if (m) m.content = th[2]; }
applyTheme();

/* ---------- програма ---------- */
const plan = day => P.days.find(d => d.key === day)[person];
const lib = en => P.lib[en] || {};
const stepById = (day, id) => plan(day).find(s => s.id === id);
const who = () => P.people[person];

/* ---------- екрани ---------- */
let screen = 'today', tab = 'today', selDay = null, histOpen = null, chartEx = null, mKey = 'waist';
function go(s){ screen = s; if (['today','home','history','progress','measure'].includes(s)) tab = s; render(); window.scrollTo(0, 0); }

function toast(html, cls, ms){
  toastEl.className = cls || ''; toastEl.innerHTML = html; toastEl.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => { toastEl.hidden = true; }, ms || (cls === 'pr' ? 3600 : 2400));
}
function openSheet(html){
  sheetEl.innerHTML = `<div class="sh" role="dialog" aria-modal="true"><div class="grab" aria-hidden="true"></div><button class="shx" data-act="closesheet" aria-label="Закрити">${ic('x')}</button>${html}</div>`;
  sheetEl.hidden = false;
  const sh = sheetEl.firstElementChild; let y0 = null, dy = 0;
  sh.addEventListener('touchstart', e => { y0 = sh.scrollTop <= 0 ? e.touches[0].clientY : null; dy = 0; }, {passive: true});
  sh.addEventListener('touchmove', e => { if (y0 == null) return; dy = e.touches[0].clientY - y0; if (dy > 0) sh.style.transform = `translateY(${dy}px)`; }, {passive: true});
  sh.addEventListener('touchend', () => { if (y0 == null) return; if (dy > 90) closeSheet(); else sh.style.transform = ''; y0 = null; });
}
function closeSheet(){ sheetEl.hidden = true; sheetEl.innerHTML = ''; }
sheetEl.addEventListener('click', e => { if (e.target === sheetEl) closeSheet(); });

function tabbar(){
  const t = [['today','gym','Зал'],['home','home','Дім'],['history','cal','Історія'],['progress','chart','Прогрес'],['measure','ruler','Заміри']];
  return `${activeBar()}<div class="tabbar"><nav>${t.map(([k,i,l]) => `<button data-go="${k}" ${tab === k ? 'aria-current="page"' : ''}>${ic(i)}${l}</button>`).join('')}</nav></div>`;
}
/* панель «тренування триває» над меню — з будь-якого екрана повертає до тренування */
function activeBar(){
  const A = S && S.active; if (!A || screen === 'today') return '';
  const done = A.queue.filter(q => { const x = A.items[q]; return x && x.sets.length && x.sets.every(s => s.done); }).length;
  return `<button class="activebar" data-act="resume"><span class="pulse"></span><span class="grow"><b>Тренування триває</b><small>${DAY_NAME[A.day]} · ${done}/${A.queue.length} · <span id="abclock">${mmss((Date.now() - A.start) / 1000)}</span></small></span><span class="ab-go">Продовжити ${ic('right')}</span></button>`;
}

/* ---------- обчислення ---------- */
function nextDay(){
  const done = S.workouts.filter(w => !w.deleted);
  if (done.length){ const last = done[done.length - 1].day; return DAY_ORDER[(DAY_ORDER.indexOf(last) + 1) % 3]; }
  const wd = new Date().getDay();
  return wd === 0 || wd === 1 ? 'mon' : wd === 2 || wd === 3 ? 'wed' : 'fri';
}
function weekCounts(){ const m = new Map(); S.workouts.forEach(w => { const k = weekStart(w.start); m.set(k, (m.get(k) || 0) + 1); }); return m; }
/* серія повних тижнів (3 з 3); один неповний тиждень на календарний місяць — «заморозка», серію не рве */
function streakInfo(){
  const m = weekCounts(); if (!S.workouts.length) return {n: 0, frozen: 0};
  const first = weekStart(S.workouts[0].start); let k = weekStart(Date.now()), n = 0; const frozen = new Set();
  if ((m.get(k) || 0) < 3) k = weekStart(k - 3 * 864e5);
  let guard = 0;
  while (k >= first && guard++ < 600){
    if ((m.get(k) || 0) >= 3) n++;
    else { const d = new Date(k), mk = d.getFullYear() * 12 + d.getMonth(); if (frozen.has(mk) || n === 0) break; frozen.add(mk); }
    k = weekStart(k - 3 * 864e5);
  }
  return {n, frozen: frozen.size};
}
const streakWeeks = () => streakInfo().n;
function blockWeek(){ if (!S.blockStart) return 1; return Math.floor((weekStart(Date.now()) - weekStart(S.blockStart)) / (7 * 864e5)) + 1; }
const blockLen = () => S.blockLen || 8;
const isEvening = w => new Date(w.end).getHours() >= 16;
const shakes = () => S.workouts.filter(isEvening).length;
const inDeload = () => S.deloadUntil && Date.now() < S.deloadUntil;
const COMPOUND = new Set(['V-squat','Leg press 45°','Romanian deadlift','Hip thrust','T-bar row','Lat pulldown','Chest-supported row','Chest press','Seated cable row','Cable pulldown','Dumbbell bench press']);
/* сигнал розвантаження: 2 тижні без прогресу в більшості базових вправ, або два важкі тренування поспіль */
function deloadSignal(){
  if (inDeload() || (S.deloadSnooze && Date.now() < S.deloadSnooze) || S.workouts.length < 6) return null;
  const now = Date.now(), D = 864e5; let tot = 0, stuck = 0;
  const score = it => Math.max(...it.sets.filter(x => x.done && x.w).map(x => x.w * (1 + (x.r || 0) / 30)));
  const ens = new Set(S.workouts.flatMap(w => w.items.filter(it => COMPOUND.has(it.en)).map(it => it.en)));
  ens.forEach(en => { const e = entriesFor(en).filter(x => !x.w.deload);
    const recent = e.filter(x => now - x.w.start <= 14 * D), older = e.filter(x => now - x.w.start > 14 * D && now - x.w.start <= 35 * D);
    if (!recent.length || !older.length) return; tot++;
    if (Math.max(...recent.map(x => score(x.it))) <= Math.max(...older.map(x => score(x.it)))) stuck++; });
  if (tot >= 3 && stuck / tot >= 0.6) return 'stuck';
  const last2 = S.workouts.slice(-2);
  if (last2.length === 2 && last2.every(w => w.mood === '😫')) return 'tired';
  if (last2.length === 2 && last2.every(w => { const f = w.items.filter(it => it.feel); return f.length >= 3 && f.filter(it => it.feel === 'hard').length / f.length >= 0.5; })) return 'tired';
  return null;
}
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
  if (inDeload()) return null;
  if (done.every(s => s.w === w0 && (s.r || 0) >= step.max)) return w0 + step.step;
  if (l.it.feel === 'easy' && done.every(s => s.w === w0 && (s.r || 0) >= step.max - 1)) return w0 + step.step;
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
  ['block','🎓','Блок завершено', s => s.blockStart && blockWeek() > blockLen() && s.workouts.filter(w => w.start >= s.blockStart).length >= 20],
  ['pr1','⭐','Перший рекорд', s => s.workouts.some(w => (w.prs || []).length)],
  ['pr10','🌟','10 рекордів', s => s.workouts.reduce((a, w) => a + (w.prs || []).length, 0) >= 10],
  ['up10','📈','+10 разів додала вагу', s => s.workouts.reduce((a, w) => a + (w.ups || 0), 0) >= 10],
  ['t5','🏋️','5 тонн за тренування', s => s.workouts.some(w => w.tonnage >= 5000)],
  ['t100','💯','100 тонн загалом', s => s.workouts.reduce((a, w) => a + (w.tonnage || 0), 0) >= 100000],
  ['extra','⏱️','Встигла «Якщо є час»', s => s.workouts.some(w => w.items.some(it => it.kind === 'extra' && it.sets.some(x => x.done)))],
  ['shake','🥤','10 вечірніх шейків', s => s.workouts.filter(w => new Date(w.end).getHours() >= 16).length >= 10],
  ['m1','📏','Перші заміри', s => s.measurements.length >= 1],
  ['neck7','🦒','Шия 7 днів поспіль', s => homeStreak('neck') >= 7, 'p1'],
  ['calf10','🦵','Ікри вдома 10 разів', s => homeCount('calf') >= 10],
  ['m4','📐','Заміри 4 тижні поспіль', s => { const ws = new Set(s.measurements.map(m => weekStart(new Date(m.date).getTime()))); let k = weekStart(Date.now()), n = 0; if (!ws.has(k)) k = weekStart(k - 3 * 864e5); while (ws.has(k)){ n++; k = weekStart(k - 3 * 864e5); } return n >= 4; }]
];
const achList = () => ACH.filter(a => !a[4] || a[4] === person);
/* після видалення: прибрати ачівки, умова яких більше не виконується */
function recheckAch(){ const lost = []; Object.keys(S.ach).forEach(id => { const a = achById(id); let ok = false; try { ok = a && !!a[3](S); } catch(e){} if (!ok){ lost.push(id); delete S.ach[id]; } }); return lost; }
function checkAch(){ const fresh = []; achList().forEach(([id,,, test]) => { if (!S.ach[id]){ let ok = false; try { ok = !!test(S); } catch(e){} if (ok){ S.ach[id] = Date.now(); fresh.push(id); } } }); return fresh; }
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
  const cont = S.active && S.active.day !== day ? ` (${DAY_NAME[S.active.day].toLowerCase()})` : '';
  const steps = plan(day).filter(s => s.kind !== 'extra');
  const ws = weekStart(Date.now());
  const thisWeek = new Set(S.workouts.filter(w => weekStart(w.start) === ws).map(w => w.day));
  const est = Math.round(steps.reduce((a, s) => a + s.sets * perSet(s), 0) + 6);
  const si = streakInfo(), streak = si.n;
  const bw = blockWeek();
  const backupOld = S.workouts.length >= 3 && (!S.lastBackup || Date.now() - S.lastBackup > 30 * 864e5);
  const names = steps.filter(s => s.kind === 'main').map(s => s.en);
  return `<div class="top"><h1>Привіт, ${esc(who())}</h1><button class="iconbtn" data-act="settings" aria-label="Налаштування">${ic('sliders')}</button></div>
    <div class="row wrap" style="margin-bottom:14px">
      <span class="pill">${bw <= blockLen() ? `Тиждень ${bw} з ${blockLen()}` : 'Блок завершено 🎓'}</span>
      <span class="pill">🔥 Серія: ${streak} ${streak === 1 ? 'тиждень' : streak >= 2 && streak <= 4 ? 'тижні' : 'тижнів'}${si.frozen ? ' · ❄️' : ''}</span>
      ${inDeload() ? '<span class="pill">🪶 Легкий тиждень</span>' : ''}
    </div>
    ${bannersHtml(bw)}
    ${backupOld ? `<div class="banner">💾 <span class="grow">${S.lastBackup ? `Остання резервна копія ${Math.floor((Date.now() - S.lastBackup) / 864e5)} дн. тому` : 'Резервної копії ще немає'}</span><button class="btn" data-act="backup">Зберегти</button></div>` : ''}
    <div class="card">
      <div class="row" style="justify-content:space-between">
        <h2>${DAY_NAME[day]}</h2>
        <div class="seg" role="group" aria-label="День">${DAY_ORDER.map(k => `<button data-day="${k}" aria-pressed="${k === day}">${DAY_TAB[k]}</button>`).join('')}</div>
      </div>
      <p class="muted small" style="margin-top:4px">${steps.length} вправ · ~${est} хв · ${S.settings.duration} хв у залі</p>
      <ul class="preview">${names.map(n => `<li><b>${esc(n)}</b> · ${esc(lib(n).ua || '')}</li>`).join('')}</ul>
      <button class="big" data-act="start" data-dayv="${day}">${S.active ? `${ic('play')} ПРОДОВЖИТИ${cont}` : `${ic('play')} ПОЧАТИ ТРЕНУВАННЯ`}</button>
      <div class="dots">${DAY_ORDER.map(k => `<span class="dot ${thisWeek.has(k) ? 'done' : ''}"><i></i>${DAY_TAB[k]}</span>`).join('')}<span class="dot" style="margin-left:auto">цей тиждень</span></div>
    </div>
    <button class="big ghost" data-act="dayplan" data-dayv="${day}">${ic('book')} План дня й техніка</button>
    ${tabbar()}`;
}

function bannersHtml(bw){
  let h = '';
  const key = String(S.blockStart);
  if (S.blockStart && bw > blockLen()) h += `<div class="banner ok">🎓 <span class="grow"><b>Блок завершено!</b> Подивись підсумок і отримай сертифікат.</span><button class="btn" data-act="blockend">Підсумок</button></div>`;
  else if (S.blockStart && bw === 3 && !S.cpSeen[key + ':3']) h += `<div class="banner">🧭 <span class="grow"><b>Контрольна точка, 3-й тиждень.</b> Якщо якась вправа не заходить — болить, незручно або тренажер вічно зайнятий — запиши в нотатку після тренування, замінимо.</span><button class="btn" data-act="cpok" data-k="${key}:3">Ок</button></div>`;
  const ds = deloadSignal();
  if (ds) h += `<div class="banner">🪫 <span class="grow"><b>${ds === 'stuck' ? 'Прогрес стоїть 2 тижні.' : 'Два важкі тренування поспіль.'}</b> Схоже, час на легкий тиждень: ті самі вправи, вага −25%.</span></div>
    <div class="row" style="margin:-4px 0 12px"><button class="btn acc grow" data-act="deload">Почати легкий тиждень</button><button class="btn" data-act="deloadlater">Пізніше</button></div>`;
  return h;
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
    if (inDeload() && w != null && st.type === 'weight') w = Math.max(0, Math.round(w * 0.75 / st.step) * st.step);
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
      <button class="check" data-act="done" data-i="${i}" aria-label="підхід ${i + 1} зроблено">${ic('check')}</button></div>`).join('')}</div>`;
  }
  const lastTxt = last ? `Минулого разу (${dShort(last.w.start)}): <b>${last.it.sets.filter(s => s.done).map(s => st.type === 'weight' ? `${fmt(s.w)} кг × ${fmt(s.r)}` : `${fmt(s.r)}${unitR ? ' ' + unitR : ''}`).join(', ') || '—'}</b>` : 'Вперше: підбери вагу з запасом 2–3 повтори.';
  const isLast = A.idx === A.queue.length - 1;
  const nextIsExtra = !isLast && effStep(A.day, A.queue[A.idx + 1]).kind === 'extra' && st.kind !== 'extra';
  return `<div class="wtop"><button class="iconbtn wide" data-act="minimize" aria-label="Згорнути тренування">${ic('down')}<span>Згорнути</span></button><button class="iconbtn" data-act="queue" aria-label="Усі вправи">${ic('list')}</button>
      <span class="muted">${A.idx + 1}/${A.queue.length}</span>
      <div class="clock" id="clock"></div></div>
    <div class="progress"><i style="width:${pct}%"></i></div>
    <div class="card">
      <div class="kindtag ${st.kind === 'extra' ? 'extra' : ''}">${kindLbl}${st.isAlt ? ' · заміна' : ''}${inDeload() && st.type === 'weight' ? ' · легкий тиждень −25%' : ''}</div>
      <h1 class="exname">${esc(st.en)}</h1>
      <p class="exua">${esc(st.ua || L.ua || '')}</p>
      ${L.mach ? `<p class="mach">${esc(L.mach)}</p>` : ''}
      ${S.mnotes[st.en] ? `<button class="mnote" data-act="mnote">${ic('tool')} ${esc(S.mnotes[st.en])}</button>` : ''}
      ${st.note ? `<p class="note">${esc(st.note)}</p>` : ''}
      <p class="dose">План: <b>${esc(st.dose)}</b></p>
      ${st.type === 'weight' || last ? `<div class="last">${lastTxt}</div>` : ''}
      ${up != null ? `<div class="up">⬆ Час додати вагу: спробуй ${fmt(up)} кг</div>` : ''}
      ${rows}
      ${feelHtml(st, it)}
      <div class="tools">
        ${L.tech ? `<button class="btn" data-act="tech" aria-expanded="${techOpen}">${ic('book')} Техніка</button>` : ''}
        ${L.video ? `<a class="btn" style="display:grid;place-items:center;text-decoration:none" href="${esc(L.video)}" target="_blank" rel="noopener">${ic('video')} Відео</a>` : ''}
        ${st.kind !== 'warm' ? `<button class="btn" data-act="busy">${ic('swap')} Зайнято?</button>` : ''}
        ${st.kind !== 'warm' && L.mach && L.mach !== 'Каремат' ? `<button class="btn" data-act="mnote">${ic('tool')} ${S.mnotes[st.en] ? 'Тренажер' : 'Тренажер'}</button>` : ''}
      </div>
      ${techOpen ? techHtml(st.en) : ''}
    </div>
    ${nextIsExtra ? `<p class="muted small" style="text-align:center">Основне тренування — до кінця цієї вправи. Далі «Якщо є час».</p>` : ''}
    <div class="rest" id="rest" hidden></div>
    <div class="wnav"><div>
      ${navButtons(st, isLast, nextIsExtra)}
    </div></div>`;
}
function feelHtml(st, it){
  if (st.type !== 'weight' || st.kind === 'warm' || !it.sets.length || !it.sets.every(s => s.done)) return '';
  const o = [['easy','😌 Легко'],['ok','🙂 Норм'],['hard','😤 Важко']];
  return `<div class="feel"><span>Як було?</span>${o.map(([k, l]) => `<button data-feel="${k}" aria-pressed="${it.feel === k}">${l}</button>`).join('')}</div>`;
}
function navButtons(st, isLast, nextIsExtra){
  const A = S.active;
  const back = `<button data-act="prev" ${A.idx === 0 ? 'disabled' : ''}>${ic('left')} Назад</button>`;
  const fin = `<button class="fin" data-act="finish">${ic('check')} Завершити</button>`;
  if (isLast) return back + fin;
  if (st.kind === 'extra') return fin + `<button class="acc" data-act="next">Далі ${ic('right')}</button>`;
  if (nextIsExtra && allMainDone()) return fin + `<button class="acc" data-act="next">Якщо є час ${ic('right')}</button>`;
  return back + `<button class="acc" data-act="next">Далі ${ic('right')}</button>`;
}
function allMainDone(){ const A = S.active; return A.queue.every(q => { const st = effStep(A.day, q); if (st.kind === 'extra') return true; const x = A.items[q]; return x && x.sets.length && x.sets.every(s => s.done); }); }
function mainLeft(){ const A = S.active; return A.queue.filter(q => { const st = effStep(A.day, q); if (st.kind === 'extra') return false; const x = A.items[q]; return !(x && x.sets.length && x.sets.every(s => s.done)); }); }

/* годинник, відпочинок і перевірка часу */
let audioCtx = null;
function beep(){ try { audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)(); const o = audioCtx.createOscillator(), g = audioCtx.createGain(); o.frequency.value = 880; g.gain.setValueAtTime(.001, audioCtx.currentTime); g.gain.exponentialRampToValueAtTime(.3, audioCtx.currentTime + .02); g.gain.exponentialRampToValueAtTime(.001, audioCtx.currentTime + .5); o.connect(g).connect(audioCtx.destination); o.start(); o.stop(audioCtx.currentTime + .55); } catch(e){} }
function tick(){
  const ab = document.getElementById('abclock'); if (ab && S && S.active) ab.textContent = mmss((Date.now() - S.active.start) / 1000);
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

function restFor(st){
  if (st.kind === 'core' || st.type === 'body') return S.settings.restCore;
  if (COMPOUND.has(st.en)) return st.min && st.min <= 8 ? S.settings.restHeavy : S.settings.restMain;
  return S.settings.restIso;
}
const FUN = {
  up: ['Сильніше, ніж минулого разу 💪','Прогрес видно неозброєним оком 👀','Минула ти була б вражена 😎','Мʼязи записали це в щоденник 📈','Оце так! Плюс до минулого разу 🚀'],
  same: ['Стабільно, як швейцарський годинник ⌚','Стабільність — теж сила 🧱','Тримаєш планку. Буквально 😄','Рівно як минулого разу — база тримається 🧘'],
  down: ['Сьогодні гравітація сильніша, ніж зазвичай 🌍','Не день рекордів — день характеру 😌','Навіть Місяць має фази 🌙 Наступного разу надолужиш','Легший день — теж тренування. Шейк не скасовується 🥤','Мʼязи сьогодні в режимі енергозбереження 🔋 Буває!'],
  first: ['Перший раз — є точка відліку ✍️','Записано! Тепер буде з чим порівнювати 📒'],
  deload: ['Легкий тиждень — так і задумано 🪶','Відновлення — це теж частина прогресу 🌿']
};
const pick = a => a[Math.floor(Math.random() * a.length)];
function funPhrase(st, it){
  if (inDeload() && st.type === 'weight') return pick(FUN.deload);
  const l = lastFor(st.en); if (!l) return pick(FUN.first);
  const sc = sets => sets.filter(x => x.done).reduce((a, x) => a + (st.type === 'weight' ? (x.w || 0) * (x.r || 0) : (x.r || 0)), 0);
  const now = sc(it.sets), was = sc(l.it.sets);
  return now > was * 1.005 ? pick(FUN.up) : now < was * 0.995 ? pick(FUN.down) : pick(FUN.same);
}
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
  else { A.restEnd = Date.now() + restFor(st) * 1000; A.restBeeped = false; if (!A.prs.some(p => p.en === st.en)) toast(funPhrase(st, it), 'fun'); }
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
  const items = A.queue.map(id => { const st = effStep(A.day, id), x = A.items[id]; return x ? {en: st.en, kind: st.kind, type: st.type, unit: st.unit, side: !!st.side, alt: !!st.isAlt, feel: x.feel || null, sets: x.sets.filter(s => s.done).map(s => ({w: s.w ?? null, r: s.r ?? null, done: true}))} : null; }).filter(x => x && x.sets.length);
  let ups = 0;
  items.forEach(it => { if (it.type !== 'weight') return; const l = lastFor(it.en); if (l && l.it.sets[0] && it.sets[0] && it.sets[0].w > l.it.sets[0].w) ups++; });
  const rec = { id: 'w' + A.start, day: A.day, start: A.start, end: Date.now(), items, prs: A.prs, ups, tonnage: tonnageOf(items), sets: items.filter(it => it.kind !== 'warm').reduce((a, it) => a + it.sets.length, 0), mood: null, note: '', deload: !!inDeload() };
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
      <div class="stat"><b>${w.items.filter(it => it.kind !== 'warm').length}</b><span>вправ</span></div>
      <div class="stat"><b>${w.prs.length}</b><span>${w.prs.length === 1 ? 'рекорд' : 'рекордів'}</span></div>
    </div>
    <p class="muted small" style="text-align:center;margin:-6px 0 12px">Піднято загалом: ${fmtInt(w.tonnage)} кг${f.evening ? ` · 🥤 шейк №${shakes()}` : ''}</p>
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
    <div class="opts" style="margin-top:14px"><button data-act="delw" data-id="${w.id}">Видалити це тренування<small>Можна буде повернути одразу після видалення</small></button><button data-act="closesheet">Закрити</button></div>`);
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
  const unlocked = achList().filter(a => S.ach[a[0]]).length;
  return `<div class="top"><h1>Прогрес</h1></div>
    <div class="kpis"><div class="stat"><b>${S.workouts.length}</b><span>тренувань</span></div><div class="stat"><b>🔥 ${streakWeeks()}</b><span>тижнів поспіль</span></div><div class="stat"><b>🥤 ${shakes()}</b><span>шейків заслужено</span></div></div>
    <div class="card" style="margin-top:12px"><h3>Мʼязи цього тижня</h3>${weekMap()}</div>
    <div class="card"><h3>Блок: ${bw <= blockLen() ? `тиждень ${bw} з ${blockLen()}` : 'завершено 🎓'}</h3><div class="bar"><i style="width:${Math.min(100, Math.round(Math.min(bw, blockLen()) / blockLen() * 100))}%"></i></div>
      ${calMonth(now.getFullYear(), now.getMonth(), days)}${calMonth(pm.getFullYear(), pm.getMonth(), days)}</div>
    <div class="card"><h3>Ачівки · ${unlocked} з ${achList().length}</h3><div class="achs">${achList().map(([id, e, t]) => `<div class="ach ${S.ach[id] ? '' : 'lock'}"><span>${S.ach[id] ? e : '🔒'}</span>${esc(t)}</div>`).join('')}</div></div>
    <div class="card"><h3>Вага по вправі</h3>${exs.length ? `<select data-act="chartex" aria-label="Вправа">${exs.map(e => `<option ${e === chartEx ? 'selected' : ''}>${esc(e)}</option>`).join('')}</select>${lineChart(pts, 'найбільша вага за тренування, кг')}` : '<p class="muted small">Графік зʼявиться після першого тренування.</p>'}</div>
    ${tabbar()}`;
}

function weekMap(){
  const ws = weekStart(Date.now()), m = {};
  S.workouts.filter(w => weekStart(w.start) === ws).forEach(w => w.items.forEach(it => { if (it.kind === 'warm') return; const L = lib(it.en).muscles; if (!L) return; const n = it.sets.length; L.p.forEach(k => m[k] = (m[k] || 0) + n); L.s.forEach(k => m[k] = (m[k] || 0) + n * .5); }));
  const lv = v => !v ? 0 : v < 3 ? 1 : v < 6 ? 2 : v < 10 ? 3 : 4;
  const any = Object.keys(m).length;
  return `<div class="tfig" style="max-width:260px">${bodySvg(k => 'h' + lv(m[k]), k => `${P.muscles[k] || k}: ${fmt(Math.round((m[k] || 0) * 2) / 2)}`, "Мʼязи цього тижня")}</div>
    <div class="legend"><span><i class="h1"></i>до 3</span><span><i class="h2"></i>3–6</span><span><i class="h3"></i>6–10</span><span><i class="h4"></i>10+</span><span>підходів</span></div>
    ${any ? '' : '<p class="muted small" style="text-align:center">Карта «розгорається» з кожним тренуванням тижня.</p>'}`;
}

/* ---------- дім ---------- */
const HOME = {
  p1: [{id:'neck', icon:'🦒', title:'Шия', desc:'«Кивок» лежачи 10 × 10 с і тиск головою в долоню без руху', per:7, freq:'щодня'},
       {id:'calf', icon:'🦵', title:'Ікри', desc:'Підйоми на носки на сходинці, тримаючись за стіну, 3 × 15–20, внизу пауза 1 с', per:3, freq:'2–3 рази на тиждень'}],
  p2: [{id:'calf', icon:'🦵', title:'Ікри', desc:'Підйоми на носки на сходинці, тримаючись за стіну, 3 × 15–20, внизу пауза 1 с', per:3, freq:'2–3 рази на тиждень'}]
};
const homeDone = (d, id) => (S.home[d] || []).includes(id);
function homeCount(id){ return Object.values(S.home).filter(a => a.includes(id)).length; }
function homeStreak(id){ let d = new Date(), n = 0; if (!homeDone(iso(d), id)) d.setDate(d.getDate() - 1); while (homeDone(iso(d), id)){ n++; d.setDate(d.getDate() - 1); } return n; }
function homeScreen(){
  const today = iso(new Date()), ws = weekStart(Date.now());
  const days = Array.from({length: 7}, (_, i) => { const d = new Date(ws + i * 864e5); return {k: iso(d), l: ['Пн','Вт','Ср','Чт','Пт','Сб','Нд'][i], t: iso(d) === today}; });
  return `<div class="top"><h1>Вдома</h1></div>
    <p class="muted" style="margin:-6px 0 14px">Короткі вправи поза залом. Познач, коли зробила.</p>
    ${HOME[person].map(h => { const done = homeDone(today, h.id); const wk = days.filter(d => homeDone(d.k, h.id)).length;
      return `<div class="card"><div class="row"><span style="font-size:30px">${h.icon}</span><div class="grow"><h2>${h.title}</h2><p class="muted small">${h.freq} · цього тижня ${wk} з ${h.per}</p></div></div>
        <p style="margin:10px 0 12px">${esc(h.desc)}</p>
        <button class="warmcheck ${done ? 'done' : ''}" data-home="${h.id}"><i>${done ? '✓' : ''}</i>${done ? 'Сьогодні зроблено' : 'Зробила сьогодні'}</button>
        <div class="hweek">${days.map(d => `<span class="${homeDone(d.k, h.id) ? 'h' : ''} ${d.t ? 't' : ''}">${d.l}</span>`).join('')}</div>
        ${h.per === 7 ? `<p class="muted small" style="margin-top:8px">Днів поспіль: ${homeStreak(h.id)}</p>` : ''}</div>`; }).join('')}
    ${tabbar()}`;
}

/* ---------- підсумок блоку й сертифікат ---------- */
function blockStats(){
  const ws = S.workouts.filter(w => w.start >= S.blockStart);
  const prog = [];
  new Set(ws.flatMap(w => w.items.filter(it => it.type === 'weight' && it.unit === 'reps' && it.kind !== 'warm').map(it => it.en))).forEach(en => {
    const e = ws.map(w => w.items.find(it => it.en === en)).filter(Boolean).map(it => Math.max(...it.sets.map(x => x.w || 0)));
    if (e.length >= 2 && e[0] > 0 && e[e.length - 1] > e[0]) prog.push({en, from: e[0], to: e[e.length - 1], pct: (e[e.length - 1] / e[0] - 1) * 100});
  });
  prog.sort((a, b) => b.pct - a.pct);
  return { n: ws.length, sets: ws.reduce((a, w) => a + w.sets, 0), prs: ws.reduce((a, w) => a + (w.prs || []).length, 0), shakes: ws.filter(isEvening).length, prog: prog.slice(0, 3), from: S.blockStart, to: Date.now() };
}
function blockEndSheet(){
  const b = blockStats();
  openSheet(`<h2>🎓 Блок завершено!</h2><p>${dShort(b.from)} — ${dShort(b.to)} · ${b.n} тренувань · ${b.sets} підходів · ${b.prs} рекордів · 🥤 ${b.shakes}</p>
    ${b.prog.length ? `<div class="qsec">Найбільший прогрес</div>${b.prog.map(x => `<div class="mrow"><span>${esc(x.en)}</span><span>${fmt(x.from)} → <b>${fmt(x.to)}</b> кг <span class="dn">+${Math.round(x.pct)}%</span></span></div>`).join('')}` : ''}
    <div class="opts" style="margin-top:14px">
      <button data-act="cert">🖼 Сертифікат<small>Картинка з підсумком — зберегти у «Фото» або поділитися</small></button>
      ${blockLen() < 12 ? `<button data-act="extend">➕ Продовжити блок ще на 2 тижні<small>Якщо ваги ще ростуть — нічого не міняємо</small></button>` : ''}
      <button data-act="newblock">🔁 Почати новий блок<small>Тижні рахуються з сьогодні</small></button>
    </div>`);
}
async function certificate(){
  const b = blockStats(), cs = getComputedStyle(document.documentElement);
  const acc = cs.getPropertyValue('--accent').trim() || '#ff7a59', bg = cs.getPropertyValue('--bg').trim() || '#0f1115', ink = cs.getPropertyValue('--ink').trim() || '#fff', mut = cs.getPropertyValue('--muted').trim() || '#999';
  const c = document.createElement('canvas'); c.width = 1080; c.height = 1350; const x = c.getContext('2d');
  x.fillStyle = bg; x.fillRect(0, 0, 1080, 1350);
  const g = x.createLinearGradient(0, 0, 1080, 0); g.addColorStop(0, acc); g.addColorStop(1, '#ffcf5a'); x.fillStyle = g; x.fillRect(0, 0, 1080, 18); x.fillRect(0, 1332, 1080, 18);
  x.textAlign = 'center'; const F = (w, s) => `${w} ${s}px -apple-system, "SF Pro Display", "Segoe UI", Roboto, sans-serif`;
  x.font = F(400, 120); x.fillText('🎓', 540, 210);
  x.fillStyle = acc; x.font = F(800, 46); x.fillText('СЕРТИФІКАТ', 540, 300);
  x.fillStyle = ink; x.font = F(800, 92); x.fillText(who(), 540, 420);
  x.fillStyle = mut; x.font = F(500, 40); x.fillText(`завершила ${blockLen()}-тижневий блок`, 540, 490); x.fillText(`${dShort(b.from)} — ${dShort(b.to)}`, 540, 545);
  const st = [[b.n, 'тренувань'], [b.sets, 'підходів'], [b.prs, 'рекордів'], [b.shakes, 'шейків 🥤']];
  st.forEach(([v, l], i) => { const cx = 150 + i * 260; x.fillStyle = ink; x.font = F(800, 72); x.fillText(String(v), cx, 690); x.fillStyle = mut; x.font = F(500, 30); x.fillText(l, cx, 735); });
  if (b.prog.length){ x.fillStyle = acc; x.font = F(800, 36); x.fillText('НАЙБІЛЬШИЙ ПРОГРЕС', 540, 850);
    b.prog.forEach((p, i) => { x.fillStyle = ink; x.font = F(600, 40); x.fillText(`${p.en}: ${fmt(p.from)} → ${fmt(p.to)} кг (+${Math.round(p.pct)}%)`, 540, 920 + i * 62); }); }
  x.fillStyle = mut; x.font = F(600, 34); x.fillText('Зал на двох 🏋️', 540, 1270);
  const blob = await new Promise(r => c.toBlob(r, 'image/png')); const name = `sertyfikat-${who()}-${iso(new Date())}.png`;
  try { const file = new File([blob], name, {type: 'image/png'});
    if (navigator.canShare && navigator.canShare({files: [file]})) await navigator.share({files: [file], title: 'Сертифікат'});
    else { const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = name; document.body.appendChild(a); a.click(); a.remove(); }
  } catch(e){}
}

/* ---------- заміри ---------- */
const MF = [['weight','Вага','кг'],['chest','Груди','см'],['biceps','Біцепс','см'],['waist','Талія','см'],['hips','Стегна (обхват)','см'],['thigh','Стегно','см']];
function measureScreen(){
  const M = [...S.measurements].sort((a, b) => a.date.localeCompare(b.date));
  const last = M[M.length - 1], prev = M[M.length - 2];
  const pts = M.filter(m => m[mKey] != null).map(m => ({x: new Date(m.date).getTime(), y: m[mKey]}));
  const mf = MF.find(f => f[0] === mKey);
  return `<div class="top"><h1>Заміри</h1></div>
    <button class="big" data-act="addm">${ic('plus')} Додати заміри</button>
    ${last ? `<div class="card" style="margin-top:12px"><h3>Останні · ${dShort(new Date(last.date).getTime())}</h3>
      ${MF.map(([k, l, u]) => { const v = last[k], p = prev ? prev[k] : null; const dlt = v != null && p != null ? v - p : null;
        return `<div class="mrow"><span>${l}</span><span>${p != null && v != null ? `${fmt(p)} → ` : ''}<b>${fmt(v)}</b> ${u}${dlt ? ` <span class="${dlt < 0 ? 'dn' : 'upc'}">${dlt > 0 ? '↑' : '↓'}${fmt(Math.abs(dlt))}</span>` : ''}</span></div>`; }).join('')}</div>
      <div class="card"><h3>Графік</h3><select data-act="mkey" aria-label="Замір">${MF.map(([k, l]) => `<option value="${k}" ${k === mKey ? 'selected' : ''}>${l}</option>`).join('')}</select>${lineChart(pts, mf[1] + ', ' + mf[2])}
      <p class="muted small" style="margin-top:6px">Дивись на тенденцію за 3–4 тижні, а не на різницю між двома тижнями.</p></div>
      <div class="card"><h3>Усі записи</h3><p class="muted small" style="margin:-4px 0 6px">Натисни на запис, щоб змінити.</p>${[...M].reverse().map(m => `<button class="mitem" data-act="editm" data-date="${m.date}"><span>${dShort(new Date(m.date).getTime())}</span><span class="small muted">${MF.filter(([k]) => m[k] != null).map(([k]) => fmt(m[k])).join(' · ')}</span>${ic('right')}</button>`).join('')}</div>`
      : `<div class="empty">Вноси заміри раз на тиждень, вранці натщесерце — тут зʼявляться зміни й графіки.</div>`}
    ${tabbar()}`;
}
function addMeasureSheet(editDate){
  const M = [...S.measurements].sort((a, b) => a.date.localeCompare(b.date)); const last = M[M.length - 1] || {};
  const cur = editDate ? S.measurements.find(x => x.date === editDate) : null;
  openSheet(`<h2>${cur ? 'Змінити заміри' : 'Нові заміри'}</h2><p>Порожні поля можна пропустити.</p>
    <div class="field" style="margin-bottom:10px"><label for="mdate">Дата</label><input type="date" id="mdate" value="${cur ? cur.date : iso(new Date())}"></div>
    <div class="mgrid">${MF.map(([k, l, u]) => `<div class="field"><label for="m_${k}">${l}, ${u}</label><input id="m_${k}" inputmode="decimal" value="${cur && cur[k] != null ? fmt(cur[k]) : ''}" placeholder="${!cur && last[k] != null ? fmt(last[k]) : ''}"></div>`).join('')}</div>
    <button class="big" style="margin-top:14px" data-act="savem" data-orig="${cur ? cur.date : ''}">Зберегти</button>
    ${cur ? `<button class="danger" data-act="delm" data-date="${cur.date}">${ic('trash')} Видалити запис</button>` : ''}`);
}

/* ---------- налаштування й резервна копія ---------- */
function settingsSheet(){
  const s = S.settings;
  openSheet(`<h2>Налаштування</h2>
    <p>Тривалість тренування</p>
    <div class="seg" role="group" aria-label="Тривалість">${[90, 75].map(v => `<button data-dur="${v}" aria-pressed="${s.duration === v}">${v} хв</button>`).join('')}</div>
    <p style="margin-top:14px">Тема</p>
    <div class="themes">${THEMES.map(([k, l, bg, ac]) => `<button data-theme="${k}" aria-pressed="${curTheme() === k}" style="background:${bg};color:${ac}"><i><b style="background:${ac}"></b><b style="background:${bg};outline:1px solid ${ac}"></b></i>${l}</button>`).join('')}</div>
    <p style="margin-top:14px">Відпочинок між підходами</p>
    <div class="opts">
      ${[['restHeavy','Важкі базові (5–8 повторів)',[120,150,180]],['restMain','Інші базові (8–12)',[90,120,150]],['restIso','Ізоляція',[60,90,120]],['restCore','Кор',[30,45,60]]].map(([k, l, vals]) => `<div style="padding:4px 0"><div class="small muted" style="margin-bottom:4px">${l}</div><span class="seg">${vals.map(v => `<button data-rest="${k}:${v}" aria-pressed="${s[k] === v}">${v >= 60 ? (v / 60).toString().replace('.', ',') + ' хв' : v + ' с'}</button>`).join('')}</span></div>`).join('')}
    </div>
    <p style="margin-top:14px">Дані</p>
    <div class="opts">
      <button data-act="backup">💾 Зберегти резервну копію<small>${S.lastBackup ? 'Остання: ' + dShort(S.lastBackup) : 'Ще не було'}</small></button>
      <button data-act="restore">📂 Відновити з копії<small>Замінить поточні дані</small></button>
      <button data-act="newblock">🔁 Почати новий блок<small>Лічильник тижнів почнеться з сьогодні</small></button>
      <button data-act="switchp">👤 Змінити людину<small>Зараз: ${esc(who())}. Дані кожної зберігаються окремо</small></button>
    </div>
    <p class="muted small" style="margin-top:14px">Версія ${APP_VERSION} · програма від ${esc(P.version)}</p>
    <button class="big" style="margin-top:12px" data-act="closesheet">Готово</button>
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
let wake = null, undoBuf = null;
async function requestWake(){ try { if ('wakeLock' in navigator && !wake){ wake = await navigator.wakeLock.request('screen'); wake.addEventListener('release', () => { wake = null; }); } } catch(e){ wake = null; } }
function releaseWake(){ try { wake && wake.release(); } catch(e){} wake = null; }
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && screen === 'workout' && S && S.active) requestWake(); });

/* ---------- рендер ---------- */
function render(){
  if (!person){ app.innerHTML = chooseScreen(); return; }
  const map = {home: homeScreen, today: todayScreen, workout: workoutScreen, finish: finishScreen, history: historyScreen, progress: progressScreen, measure: measureScreen};
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
  if (d.feel && S.active){ const it = S.active.items[S.active.queue[S.active.idx]]; it.feel = it.feel === d.feel ? null : d.feel; save(); render(); return; }
  if (d.home){ const k = iso(new Date()); const a = S.home[k] || []; S.home[k] = a.includes(d.home) ? a.filter(x => x !== d.home) : a.concat(d.home); const fresh = checkAch(); save(); render(); if (fresh.length) toast(`${achById(fresh[0])[1]} Нова ачівка: ${esc(achById(fresh[0])[2])}`); else if (S.home[k].includes(d.home)) toast('Зараховано ✓'); return; }
  if (d.theme){ LS.set('trn:theme', d.theme); applyTheme(); settingsSheet(); return; }
  if (d.dur){ S.settings.duration = +d.dur; S.settings.durTouched = true; save(); settingsSheet(); render(); return; }
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
    case 'dodelw': { const gone = S.workouts.find(w => w.id === d.id); S.workouts = S.workouts.filter(w => w.id !== d.id); undoBuf = {kind: 'w', item: gone, ach: Object.assign({}, S.ach)}; const lostW = recheckAch(); save(); closeSheet(); render(); toast(`Тренування видалено${lostW.length ? ` · ачівок знято: ${lostW.length}` : ''} <button class="undo" data-act="undo">Повернути</button>`, '', 6000); break; }
    case 'addm': addMeasureSheet(); break;
    case 'savem': {
      const date = document.getElementById('mdate').value || iso(new Date()); const m = {date};
      let any = false; MF.forEach(([k]) => { const v = num(document.getElementById('m_' + k).value); if (v != null){ m[k] = v; any = true; } });
      if (!any){ toast('Заповни хоча б одне поле'); break; }
      S.measurements = S.measurements.filter(x => x.date !== date && x.date !== d.orig); S.measurements.push(m);
      const fresh = checkAch(); save(); closeSheet(); render();
      toast(fresh.length ? `${achById(fresh[0])[1]} Нова ачівка: ${esc(achById(fresh[0])[2])}` : 'Заміри збережено ✓'); break; }
    case 'editm': addMeasureSheet(d.date); break;
    case 'delm': { if (!t.classList.contains('armed')){ t.classList.add('armed'); t.innerHTML = `${ic('trash')} Точно видалити? Натисни ще раз`; break; }
      const gone = S.measurements.find(x => x.date === d.date); S.measurements = S.measurements.filter(x => x.date !== d.date); undoBuf = {kind: 'm', item: gone, ach: Object.assign({}, S.ach)}; recheckAch(); save(); closeSheet(); render();
      toast(`Запис видалено <button class="undo" data-act="undo">Повернути</button>`, '', 6000); break; }
    case 'undo': if (undoBuf){ if (undoBuf.kind === 'm') S.measurements.push(undoBuf.item); if (undoBuf.kind === 'w'){ S.workouts.push(undoBuf.item); S.workouts.sort((a, b) => a.start - b.start); } if (undoBuf.ach) S.ach = undoBuf.ach; undoBuf = null; save(); render(); toast('Повернуто ✓'); } break;
    case 'minimize': closeSheet(); releaseWake(); selDay = null; go('today'); break;
    case 'resume': startWorkout(S.active.day); break;
    case 'backup': backup(); break;
    case 'restore': { const f = document.getElementById('restorefile'); f.onchange = () => f.files[0] && restoreFrom(f.files[0]); f.click(); break; }
    case 'dorestore': { const j = restoreFrom.pending; if (j){ person = j.person in P.people ? j.person : person; LS.set('trn:person', person); S = Object.assign(blank(), j.data); save(); toast('Дані відновлено ✓'); } closeSheet(); go('today'); break; }
    case 'newblock': S.blockStart = Date.now(); S.blockLen = 8; save(); closeSheet(); render(); toast('Новий блок: тиждень 1 з 8'); break;
    case 'extend': S.blockLen = Math.min(12, blockLen() + 2); save(); closeSheet(); render(); toast(`Блок продовжено: ${blockLen()} тижнів`); break;
    case 'blockend': blockEndSheet(); break;
    case 'cert': certificate(); break;
    case 'cpok': S.cpSeen[d.k] = 1; save(); render(); break;
    case 'deload': S.deloadUntil = Date.now() + 7 * 864e5; save(); render(); toast('🪶 Легкий тиждень: вага −25% на 7 днів'); break;
    case 'deloadlater': S.deloadSnooze = Date.now() + 7 * 864e5; save(); render(); break;
    case 'mnote': { const id = S.active.queue[S.active.idx], st = effStep(S.active.day, id);
      openSheet(`<h2>Налаштування тренажера</h2><p>${esc(st.en)} — що виставляти, щоб не підбирати щоразу.</p>
        <textarea id="mnotetxt" placeholder="Напр.: сидіння 4, спинка 2, стопи вгорі платформи">${esc(S.mnotes[st.en] || '')}</textarea>
        <div class="opts" style="margin-top:12px"><button class="btn acc" style="text-align:center" data-act="savemnote" data-en="${esc(st.en)}">Зберегти</button></div>`); break; }
    case 'savemnote': { const v = document.getElementById('mnotetxt').value.trim(); if (v) S.mnotes[d.en] = v; else delete S.mnotes[d.en]; save(); closeSheet(); render(); break; }
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
(function(){ const seen = LS.get('trn:version', null); if (seen && seen !== APP_VERSION) setTimeout(() => toast(`Застосунок оновлено ✓ версія ${APP_VERSION}`), 600); LS.set('trn:version', APP_VERSION); })();
load();
if (S && S.active) screen = 'workout';
render();
