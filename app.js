const KEY = 'deepwork.v1';
const GOAL_KEY = 'deepwork.goal.v1';
const THEME_KEY = 'deepwork.theme.v1';
const RANGE_KEY = 'deepwork.range.v1';
const SESSION_KEY = 'deepwork.session.v1';
const MUSIC_KEY = 'deepwork.music.v1';
const DEFAULT_MUSIC = 'https://open.spotify.com/artist/557O0QveNw9BAeUsDfVHo4';

const WD = ['sun','mon','tue','wed','thu','fri','sat'];
const WDS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const WD_LONG = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONTHS_LONG = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const RANGES = {13:'in the last 3 months', 26:'in the last 6 months', 52:'this year'};
const RING_C = 339.292;
const STATUS_TEXT = { idle:'ready', running:'locked in', paused:'paused', completed:'completed' };

const ICONS = {
  calendar: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="2.25" y="3.25" width="11.5" height="10.5" rx="2"/><path d="M2.25 6.75h11.5M5.75 1.75v3M10.25 1.75v3"/></svg>',
  flame: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true"><path d="M8.4 1.5c.3 1.9 1.4 3 2.5 4.2 1 1.1 1.85 2.3 1.85 4A4.85 4.85 0 0 1 8 14.6a4.85 4.85 0 0 1-4.85-4.9c0-1.85 1-3.1 2-4.2.55-.6 1.15-1.3 1.5-2.2.3.85.55 1.75.7 2.9.5-.6.9-1.6 1.05-4.7Z"/></svg>',
  trophy: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5.25 2h5.5v3.75a2.75 2.75 0 0 1-5.5 0Z"/><path d="M5.25 3H3a2.25 2.25 0 0 0 2.4 3M10.75 3H13a2.25 2.25 0 0 1-2.4 3M8 8.5v2.5M5.5 13.5h5M6.5 13.5c0-1.5.5-2.5 1.5-2.5s1.5 1 1.5 2.5"/></svg>',
  check: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="8" cy="8" r="6.25"/><path d="M5.25 8.25l1.75 1.75 3.75-4.25" stroke-linecap="round" stroke-linejoin="round"/></svg>'
};

const $ = id => document.getElementById(id);
const graph = $('graph');
const graphScroll = $('graphScroll');
const pop = $('pop');
const tip = $('tooltip');
const cupLiquid = $('liquidGroup');
const cupKnob = $('ringKnob');

function p2(n){ return String(n).padStart(2,'0'); }
function ymd(d){ return `${d.getFullYear()}-${p2(d.getMonth()+1)}-${p2(d.getDate())}`; }
function parseYmd(s){ const [y,m,d] = s.split('-').map(Number); return new Date(y, m-1, d); }
function addDays(d,n){ const x = new Date(d); x.setDate(x.getDate()+n); return x; }
function startOfDay(d){ const x = new Date(d); x.setHours(0,0,0,0); return x; }
function startOfWeek(d){ const x = startOfDay(d); x.setDate(x.getDate() - ((x.getDay()+6)%7)); return x; }

function mulberry32(a){
  return function(){
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function fmtH(h){
  const m = Math.round(h*60);
  if (m <= 0) return '0h';
  const H = Math.floor(m/60), M = m%60;
  if (!H) return M + 'm';
  if (!M) return H + 'h';
  return H + 'h ' + M + 'm';
}

function fmtClock(sec){
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s/3600)}:${p2(Math.floor(s%3600/60))}:${p2(s%60)}`;
}

function level(h){
  if (h <= 0) return 0;
  if (h <= 2) return 1;
  if (h <= 4) return 2;
  if (h <= 6) return 3;
  return 4;
}

function hash7(s){
  let h = 0x811c9dc5;
  for (const c of s){ h ^= c.charCodeAt(0); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(16).padStart(8,'0').slice(0,7);
}

function shortDate(d){ return `${WDS[d.getDay()]} ${MONTHS[d.getMonth()]} ${d.getDate()}`; }
function longDate(d){ return `${WD_LONG[d.getDay()]}, ${MONTHS_LONG[d.getMonth()]} ${d.getDate()}`; }

let data = load();
let editing = null;
let goal = loadGoal();
let rangeWeeks = loadRange();
let session = loadSession();
let controlsKey = null;

function load(){
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch(e){}
  return seed();
}

function save(){
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch(e){}
}

function loadGoal(){
  const v = parseFloat(localStorage.getItem(GOAL_KEY));
  return v >= 0.5 ? v : 3;
}

function loadRange(){
  const v = parseInt(localStorage.getItem(RANGE_KEY), 10);
  return [13,26,52].includes(v) ? v : 26;
}

function loadSession(){
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s || !['running','paused','completed'].includes(s.state)) return null;
    if (!(s.targetSec > 0)) return null;
    if (typeof s.accSec !== 'number' || s.accSec < 0) s.accSec = 0;
    if (s.state === 'running' && typeof s.startedAt !== 'number') return null;
    return s;
  } catch(e){ return null; }
}

function saveSession(){
  try {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else localStorage.removeItem(SESSION_KEY);
  } catch(e){}
}

function seed(){
  const rnd = mulberry32(20261005);
  const out = {};
  const today = startOfDay(new Date());
  const weekStart = startOfWeek(today);
  for (let w = 10; w >= 1; w--){
    const monday = addDays(weekStart, -w*7);
    for (let d = 0; d < 7; d++){
      const date = addDays(monday, d);
      const p = d < 5 ? 0.62 : 0.28;
      if (rnd() < p) out[ymd(date)] = Math.round((0.5 + rnd()*6.5)*2)/2;
    }
  }
  const demo = { 0:4.5, 1:6, 2:4, 3:2 };
  for (const [k,v] of Object.entries(demo)){
    const date = addDays(weekStart, Number(k));
    if (date <= today) out[ymd(date)] = v;
  }
  return out;
}

function sessionElapsedSec(s){
  if (!s) return 0;
  if (s.state === 'completed') return s.targetSec;
  return s.accSec + (s.state === 'running' ? (Date.now() - s.startedAt)/1000 : 0);
}

function tick(){
  const n = new Date();
  $('hh').textContent = p2(n.getHours());
  $('mm').textContent = p2(n.getMinutes());
  $('ss').textContent = p2(n.getSeconds());
  if (session && session.state === 'running'){
    if (sessionElapsedSec(session) >= session.targetSec) completeSession();
    else renderCupSession();
  }
  if (ymd(n) !== tick.day){
    tick.day = ymd(n);
    renderAll();
  }
}
tick.day = null;

function renderHero(){
  const n = new Date();
  $('heroDate').textContent = `${longDate(n)}, ${n.getFullYear()}`;
}

function renderCupSession(){
  const s = session;
  const todayH = data[ymd(new Date())] || 0;
  const goalSec = goal*3600;
  const elapsed = s ? sessionElapsedSec(s) : todayH*3600;
  const target = s ? s.targetSec : goalSec;
  const f = target > 0 ? Math.min(1, elapsed/target) : 0;

  cupLiquid.style.transform = `translateY(${((1-f)*42).toFixed(2)}px)`;
  const cup = $('cup');
  cup.classList.toggle('full', f >= 1);
  cup.classList.toggle('running', !!s && s.state === 'running');
  cupKnob.style.transform = `rotate(${(f*360).toFixed(1)}deg)`;
  cupKnob.style.opacity = f > 0 ? '1' : '0';
  $('cupGlow').style.opacity = (0.15 + 0.85*f).toFixed(3);
  $('cupRing').style.strokeDashoffset = (RING_C*(1-f)).toFixed(2);
  $('cupPct').textContent = Math.round(f*100) + '%';

  const st = s ? s.state : 'idle';
  $('statusDot').className = 'status-dot ' + st;
  $('sessionStatus').textContent = STATUS_TEXT[st];

  if (s){
    $('sessionTimer').textContent = fmtClock(elapsed);
    if (st === 'completed') $('sessionSub').textContent = `added to today · ${fmtH(s.targetSec/3600)}`;
    else if (st === 'paused') $('sessionSub').textContent = `of ${fmtClock(s.targetSec)} · paused`;
    else $('sessionSub').textContent = `of ${fmtClock(s.targetSec)} · ${fmtClock(Math.max(0, s.targetSec - elapsed))} left`;
    $('cupSub').textContent = st === 'completed'
      ? 'session complete'
      : `${fmtClock(Math.max(0, s.targetSec - elapsed))} left`;
  } else {
    $('sessionTimer').textContent = fmtH(todayH);
    $('sessionSub').textContent = `${fmtH(todayH)} logged today · goal ${fmtH(goal)}`;
    $('cupSub').textContent = `today · ${fmtH(todayH)} / ${fmtH(goal)}`;
  }

  $('goalLabel').textContent = fmtH(goal);
  $('goalMinus').disabled = !!s;
  $('goalPlus').disabled = !!s;

  if (st !== controlsKey){ controlsKey = st; renderSessionControls(st); }
}

function renderSessionControls(st){
  const el = $('sessionControls');
  if (st === 'idle'){
    el.innerHTML = '<button class="btn btn-primary btn-block" id="startBtn" type="button">Start session</button>';
  } else if (st === 'running'){
    el.innerHTML = '<button class="btn btn-block" id="pauseBtn" type="button">Pause</button>'
      + '<button class="btn btn-primary btn-block" id="finishBtn" type="button">Finish &amp; save</button>'
      + '<button class="btn btn-invisible btn-block" id="discardBtn" type="button">discard</button>';
  } else if (st === 'paused'){
    el.innerHTML = '<button class="btn btn-primary btn-block" id="resumeBtn" type="button">Resume</button>'
      + '<button class="btn btn-block" id="finishBtn" type="button">Finish &amp; save</button>'
      + '<button class="btn btn-invisible btn-block" id="discardBtn" type="button">discard</button>';
  } else {
    el.innerHTML = '<button class="btn btn-block" id="newSessionBtn" type="button">Start another</button>';
  }
}

function completeSession(){
  const sec = session.targetSec;
  commitSession(sec);
  session = { state:'completed', startedAt:null, accSec:sec, targetSec:sec };
  saveSession();
  renderAll();
}

function commitSession(sec){
  const key = ymd(new Date());
  const h = Math.max(0.25, Math.round(sec/900)/4);
  setHours(key, (data[key] || 0) + h);
}

function finishSession(){
  const elapsed = sessionElapsedSec(session);
  if (elapsed >= 60) commitSession(Math.min(elapsed, session.targetSec));
  session = null;
  saveSession();
  renderAll();
}

function weekDays(){
  const monday = startOfWeek(new Date());
  return Array.from({length:7}, (_,i) => {
    const date = addDays(monday, i);
    return { date, key: ymd(date), hours: data[ymd(date)] || 0 };
  });
}

function streak(){
  const today = startOfDay(new Date());
  let cursor = (data[ymd(today)] || 0) > 0 ? today : addDays(today,-1);
  let n = 0;
  while ((data[ymd(cursor)] || 0) > 0){ n++; cursor = addDays(cursor,-1); }
  return n;
}

function renderStats(){
  const days = weekDays();
  const total = days.reduce((a,d) => a + d.hours, 0);
  const best = days.reduce((a,d) => d.hours > a.hours ? d : a, days[0]);
  const registered = Object.values(data).filter(h => h > 0).length;
  const items = [
    { icon:'calendar', label:'This week', value: fmtH(total), sub: 'of 7 days' },
    { icon:'flame', label:'Streak', value: streak() + 'd', sub: 'days in a row' },
    { icon:'trophy', label:'Best day', value: best.hours ? fmtH(best.hours) : '—', sub: best.hours ? shortDate(best.date) : 'no data' },
    { icon:'check', label:'Logged days', value: registered + 'd', sub: 'days with deep work' }
  ];
  $('stats').innerHTML = items.map(i => `
    <div class="stat card">
      <div class="stat-head">${ICONS[i.icon]}<span>${i.label}</span></div>
      <div class="stat-value">${i.value}</div>
      <div class="stat-sub">${i.sub}</div>
    </div>`).join('');
}

function renderLeader(){
  const days = weekDays();
  const sorted = [...days].sort((a,b) => b.hours - a.hours);
  const max = Math.max(...days.map(d => d.hours), 1);
  const todayKey = ymd(new Date());
  $('leaderRange').textContent = `${WDS[days[0].date.getDay()]} ${days[0].date.getDate()} — ${WDS[days[6].date.getDay()]} ${days[6].date.getDate()} ${MONTHS[days[6].date.getMonth()]}`;
  $('leaderList').innerHTML = sorted.map((d, i) => {
    const pct = d.hours ? Math.max(6, Math.round(d.hours/max*100)) : 0;
    const cls = [
      'leader-row',
      i === 0 && d.hours > 0 ? 'top1' : '',
      d.hours === 0 ? 'zero' : '',
      d.key === todayKey ? 'today' : ''
    ].filter(Boolean).join(' ');
    return `
      <li class="${cls}">
        <span class="rank">${p2(i+1)}</span>
        <span class="day">${WDS[d.date.getDay()]} ${d.date.getDate()}</span>
        <span class="bar"><span class="bar-fill" style="width:${pct}%"></span></span>
        <span class="hours">${fmtH(d.hours)}</span>
      </li>`;
  }).join('');
}

function rangeWindow(){
  const today = startOfDay(new Date());
  const end = startOfWeek(today);
  return { start: addDays(end, -(rangeWeeks-1)*7), end, today };
}

function renderContribTitle(){
  const { start, today } = rangeWindow();
  const count = Object.entries(data)
    .filter(([k,h]) => h > 0 && parseYmd(k) >= start && parseYmd(k) <= today)
    .length;
  const label = RANGES[rangeWeeks] || RANGES[26];
  $('contribTitle').textContent = count === 1
    ? `1 contribution ${label}`
    : `${count} contributions ${label}`;
}

function renderGraph(){
  graph.innerHTML = '';
  const { start, today } = rangeWindow();
  const dayRows = ['Mon','','Wed','','Fri','',''];

  dayRows.forEach((name, d) => {
    if (!name) return;
    const el = document.createElement('div');
    el.className = 'dlabel';
    el.textContent = name;
    el.style.gridRow = d + 2;
    graph.appendChild(el);
  });

  let lastLabelCol = -99;
  for (let w = 0; w < rangeWeeks; w++){
    const monday = addDays(start, w*7);
    const prevMonday = addDays(start, (w-1)*7);
    if (w === 0 || monday.getMonth() !== prevMonday.getMonth()){
      if (w - lastLabelCol >= 3){
        const lab = document.createElement('div');
        lab.className = 'mlabel';
        lab.textContent = MONTHS[monday.getMonth()];
        lab.style.gridColumn = w + 2;
        graph.appendChild(lab);
        lastLabelCol = w;
      }
    }
    for (let d = 0; d < 7; d++){
      const date = addDays(monday, d);
      const key = ymd(date);
      const h = data[key] || 0;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cell lv' + level(h);
      btn.style.gridColumn = w + 2;
      btn.style.gridRow = d + 2;
      btn.dataset.date = key;
      btn.dataset.tip = h > 0 ? `${fmtH(h)} of deep work · ${longDate(date)}` : `no record · ${longDate(date)}`;
      btn.setAttribute('aria-label', btn.dataset.tip);
      if (date > today){
        btn.classList.add('future');
        btn.disabled = true;
      } else if (date.getTime() === today.getTime()){
        btn.classList.add('today');
      }
      graph.appendChild(btn);
    }
  }
  renderContribTitle();
}

function renderLog(){
  const all = Object.entries(data).filter(([,h]) => h > 0);
  const entries = all.sort((a,b) => a[0] < b[0] ? 1 : -1).slice(0, 8);
  $('activityCount').textContent = `${all.length} ${all.length === 1 ? 'day' : 'days'}`;
  const el = $('log');
  if (!entries.length){
    el.innerHTML = '<div class="log-empty">— no sessions yet —</div>';
    return;
  }
  const max = Math.max(...entries.map(([,h]) => h), 1);
  el.innerHTML = entries.map(([key,h]) => `
    <div class="entry">
      <div class="entry-main">
        <span class="entry-msg">Logged <b>${fmtH(h)}</b> of deep work</span>
        <span class="entry-bar"><span style="width:${Math.round(h/max*100)}%"></span></span>
      </div>
      <div class="entry-meta">${longDate(parseYmd(key))} · <span class="hash">${hash7(key)}</span></div>
    </div>`).join('');
}

function updateRangeButtons(){
  document.querySelectorAll('#rangeSwitch button').forEach(b => {
    b.classList.toggle('active', parseInt(b.dataset.weeks, 10) === rangeWeeks);
  });
}

function renderAll(){
  renderHero();
  renderCupSession();
  renderStats();
  renderLeader();
  renderGraph();
  renderLog();
  updateRangeButtons();
}

function updateCell(dateStr){
  const cell = graph.querySelector(`.cell[data-date="${dateStr}"]`);
  if (!cell) return;
  const d = parseYmd(dateStr);
  const today = startOfDay(new Date());
  const h = data[dateStr] || 0;
  cell.className = 'cell lv' + level(h)
    + (d.getTime() === today.getTime() ? ' today' : '')
    + (editing === dateStr ? ' editing' : '');
  cell.dataset.tip = h > 0 ? `${fmtH(h)} of deep work · ${longDate(d)}` : `no record · ${longDate(d)}`;
  cell.setAttribute('aria-label', cell.dataset.tip);
  if (editing === dateStr) $('popHours').textContent = fmtH(h);
}

function openEditor(cell){
  editing = cell.dataset.date;
  const d = parseYmd(editing);
  const h = data[editing] || 0;
  $('popDate').textContent = longDate(d);
  $('popHours').textContent = fmtH(h);
  pop.hidden = false;
  const r = cell.getBoundingClientRect();
  const half = pop.offsetWidth/2 || 112;
  const x = Math.min(Math.max(r.left + r.width/2, half + 8), window.innerWidth - half - 8);
  const below = r.top < pop.offsetHeight + 20;
  pop.classList.toggle('below', below);
  pop.style.left = x + 'px';
  pop.style.top = (below ? r.bottom + 10 : r.top - 10) + 'px';
  graph.querySelectorAll('.cell.editing').forEach(c => { if (c !== cell) updateCell(c.dataset.date); });
  updateCell(editing);
}

function closeEditor(){
  if (!editing) return;
  const prev = editing;
  editing = null;
  pop.hidden = true;
  updateCell(prev);
}

function setHours(dateStr, h){
  const v = Math.max(0, Math.round(h*4)/4);
  if (v === 0) delete data[dateStr]; else data[dateStr] = v;
  save();
  updateCell(dateStr);
  renderStats();
  renderLeader();
  renderLog();
  renderHero();
  if (dateStr === ymd(new Date())) renderCupSession();
}

graph.addEventListener('click', e => {
  const cell = e.target.closest('.cell');
  if (!cell || cell.disabled) return;
  tip.hidden = true;
  openEditor(cell);
});

graph.addEventListener('mouseover', e => {
  const cell = e.target.closest('.cell');
  if (!cell || cell.disabled || !pop.hidden) return;
  const r = cell.getBoundingClientRect();
  tip.textContent = cell.dataset.tip;
  tip.hidden = false;
  const below = r.top < 48;
  tip.classList.toggle('below', below);
  tip.style.left = (r.left + r.width/2) + 'px';
  tip.style.top = (below ? r.bottom : r.top) + 'px';
});

graph.addEventListener('mouseout', e => {
  if (e.target.closest('.cell')) tip.hidden = true;
});

graphScroll.addEventListener('scroll', () => { tip.hidden = true; closeEditor(); });
window.addEventListener('resize', closeEditor);

pop.addEventListener('click', e => {
  const step = e.target.closest('button[data-d]');
  if (step && editing){
    setHours(editing, (data[editing] || 0) + parseFloat(step.dataset.d));
    return;
  }
  if (e.target.id === 'popReset' && editing) setHours(editing, 0);
});

$('sessionControls').addEventListener('click', e => {
  const id = e.target.id;
  if (id === 'startBtn'){
    session = { state:'running', startedAt: Date.now(), accSec: 0, targetSec: goal*3600 };
    saveSession();
    renderCupSession();
  } else if (id === 'pauseBtn'){
    session.accSec += (Date.now() - session.startedAt)/1000;
    session.state = 'paused';
    session.startedAt = null;
    saveSession();
    renderCupSession();
  } else if (id === 'resumeBtn'){
    session.state = 'running';
    session.startedAt = Date.now();
    saveSession();
    renderCupSession();
  } else if (id === 'finishBtn'){
    finishSession();
  } else if (id === 'discardBtn'){
    if (confirm('Discard this session without saving it to today?')){
      session = null;
      saveSession();
      renderCupSession();
    }
  } else if (id === 'newSessionBtn'){
    session = null;
    saveSession();
    renderCupSession();
  }
});

document.addEventListener('pointerdown', e => {
  if (pop.hidden) return;
  if (e.target.closest('.pop') || e.target.closest('.cell')) return;
  closeEditor();
});

document.addEventListener('mouseover', e => {
  const b = e.target.closest('.btn');
  if (!b || b.disabled) return;
  const r = b.getBoundingClientRect();
  b.style.setProperty('--cx', (e.clientX - r.left) + 'px');
  b.style.setProperty('--cy', (e.clientY - r.top) + 'px');
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeEditor();
});

$('rangeSwitch').addEventListener('click', e => {
  const b = e.target.closest('button[data-weeks]');
  if (!b) return;
  rangeWeeks = parseInt(b.dataset.weeks, 10);
  try { localStorage.setItem(RANGE_KEY, String(rangeWeeks)); } catch(err){}
  closeEditor();
  renderGraph();
  updateRangeButtons();
});

function setGoal(g){
  goal = Math.min(12, Math.max(0.5, Math.round(g*2)/2));
  try { localStorage.setItem(GOAL_KEY, String(goal)); } catch(e){}
  renderCupSession();
}

$('goalMinus').addEventListener('click', () => { if (!session) setGoal(goal - 0.5); });
$('goalPlus').addEventListener('click', () => { if (!session) setGoal(goal + 0.5); });

$('themeBtn').addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem(THEME_KEY, next); } catch(e){}
});

$('resetBtn').addEventListener('click', () => {
  if (!confirm('Clear all deep work records?')) return;
  data = {};
  session = null;
  save();
  saveSession();
  closeEditor();
  renderAll();
});

function spotifyEmbed(url){
  const m = url.match(/(?:open\.spotify\.com\/(?:intl-[a-z-]+\/)?|spotify:)(playlist|album|artist|track|episode|show)[\/:]([A-Za-z0-9]+)/);
  if (!m) return null;
  const compact = m[1] === 'track' || m[1] === 'episode';
  return { src: `https://open.spotify.com/embed/${m[1]}/${m[2]}`, height: compact ? 80 : 152 };
}

function youtubeEmbed(url){
  const list = url.match(/[?&]list=([A-Za-z0-9_-]+)/);
  if (list) return { src: `https://www.youtube.com/embed/videoseries?list=${list[1]}`, height: 152 };
  const vid = url.match(/(?:youtu\.be\/|[?&]v=)([A-Za-z0-9_-]{6,})/);
  if (vid) return { src: `https://www.youtube.com/embed/${vid[1]}`, height: 152 };
  return null;
}

function musicEmbed(url){
  return spotifyEmbed(url) || youtubeEmbed(url);
}

function renderMusic(){
  const url = localStorage.getItem(MUSIC_KEY) || DEFAULT_MUSIC;
  const emb = musicEmbed(url);
  const box = $('musicFrame');
  if (!emb){ box.innerHTML = ''; return; }
  box.innerHTML = `<iframe src="${emb.src}" width="100%" height="${emb.height}" frameborder="0" loading="lazy" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" title="focus music"></iframe>`;
}

$('musicEdit').addEventListener('click', () => {
  const current = localStorage.getItem(MUSIC_KEY) || '';
  const url = prompt('Paste your Spotify or YouTube playlist link:', current);
  if (url === null) return;
  if (url.trim() === ''){
    localStorage.removeItem(MUSIC_KEY);
  } else if (musicEmbed(url.trim())){
    localStorage.setItem(MUSIC_KEY, url.trim());
  } else {
    alert('Link not recognized. Use a Spotify (playlist, album, artist, track) or YouTube playlist URL.');
    return;
  }
  renderMusic();
});

renderAll();
renderMusic();
setInterval(tick, 1000);
tick();
