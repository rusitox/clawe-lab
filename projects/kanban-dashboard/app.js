/*
  Clawe Kanban — simple.
  - Server-side: GET/PUT /api/tasks (tasks.json) para multi-dispositivo
  - UI: drag & drop + editar/borrar + export/import
*/

const API_URL = './api/tasks';
const ACTIVITY_URL = './api/activity';
const TEAMS_URL = './api/teams';
const TOKEN_KEY = 'clawe_kanban_token_v1';

/** @typedef {{id:string, title:string, desc:string, col:'backlog'|'todo'|'inprogress'|'done', prio:'P0'|'P1'|'P2'|'P3', createdAt:number, updatedAt:number}} Task */

function uid(){
  return Math.random().toString(16).slice(2) + '-' + Date.now().toString(16);
}
function now(){ return Date.now(); }
function fmt(ts){
  try{
    const d = new Date(ts);
    return d.toLocaleString(undefined, { year:'2-digit', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' });
  }catch{ return ''+ts; }
}

function getToken(){
  return (localStorage.getItem(TOKEN_KEY) || '').trim();
}
function setToken(t){
  localStorage.setItem(TOKEN_KEY, (t||'').trim());
}

async function apiLoad(){
  const res = await fetch(API_URL, { cache: 'no-store' });
  if(!res.ok) throw new Error('load failed');
  return await res.json();
}

async function apiLoadActivity(){
  const res = await fetch(ACTIVITY_URL, { cache: 'no-store' });
  if(!res.ok) throw new Error('activity load failed');
  return await res.json();
}

async function apiLoadTeams(){
  const res = await fetch(TEAMS_URL, { cache: 'no-store' });
  if(!res.ok) throw new Error('teams load failed');
  return await res.json();
}

async function apiSaveTeams(teamsState){
  const token = getToken();
  if(!token) throw new Error('missing token');
  const res = await fetch(TEAMS_URL, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-Kanban-Token': token,
    },
    body: JSON.stringify(teamsState),
  });
  if(!res.ok) throw new Error('teams save failed');
}

async function apiSave(state){
  const token = getToken();
  if(!token){
    throw new Error('missing token');
  }
  const res = await fetch(API_URL, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-Kanban-Token': token,
    },
    body: JSON.stringify(state),
  });
  if(!res.ok) throw new Error('save failed');
}

function seed(){
  const t = now();
  return {
    version: 1,
    tasks: [
      { id: uid(), title: 'Ejemplo: agregá tus tareas reales', desc: 'Con “+ Nueva tarea”.', col:'backlog', prio:'P2', createdAt:t, updatedAt:t },
    ]
  };
}

let state = seed();
let lastHash = '';
const POLL_MS = 3000;

function hashState(s){
  // stable enough for our small payload
  try{ return JSON.stringify(s); }catch{ return String(Date.now()); }
}

const board = document.getElementById('board');
const activityFeed = document.getElementById('activityFeed');
const colorGeneral = document.getElementById('colorGeneral');
const colorEngineering = document.getElementById('colorEngineering');
const countActivity = document.getElementById('count-activity');
const filterTeam = document.getElementById('filterTeam');
const filterAgent = document.getElementById('filterAgent');

// Top-level teams (what you want to filter by in the UI)
const TEAM_MAP = {
  'Clawe': 'General',

  // Engineering team (all sub-roles)
  'SE-Lead': 'Engineering',
  'Arch-Design': 'Engineering',
  'UX-UI': 'Engineering',
  'Implementation': 'Engineering',
  'Testing': 'Engineering',
  'Review-Docs': 'Engineering',
};

function teamOf(agent){
  return TEAM_MAP[agent] || 'General';
}

// Allowed teams shown in the combo
const TEAMS = {
  'General': ['Clawe'],
  'Engineering': ['SE-Lead','Arch-Design','UX-UI','Implementation','Testing','Review-Docs'],
};

function taskTeam(task){
  // Normalize legacy granular teams into top-level
  const explicit = (task && task.team) ? String(task.team) : '';
  if(explicit){
    if(explicit === 'Engineering-Lead' || explicit === 'Arch-Design' || explicit === 'UX-UI' || explicit === 'Implementation' || explicit === 'Testing' || explicit === 'Review-Docs'){
      return 'Engineering';
    }
    return explicit;
  }
  const a = String(task?.agent || '');
  return a ? teamOf(a) : 'General';
}
function taskAgent(task){
  if(task && task.agent) return String(task.agent);
  return 'Clawe';
}

function currentFilters(){
  return {
    team: (filterTeam?.value || '').trim(),
    agent: (filterAgent?.value || '').trim(),
  };
}
const tpl = document.getElementById('tplCard');
const dlg = document.getElementById('dlg');

const btnAdd = document.getElementById('btnAdd');
const btnReset = document.getElementById('btnReset');
const btnExport = document.getElementById('btnExport');
const btnImport = document.getElementById('btnImport');
const btnToken = document.getElementById('btnToken');
const fileImport = document.getElementById('fileImport');

const formTask = document.getElementById('formTask');
const dlgTitle = document.getElementById('dlgTitle');
const taskId = document.getElementById('taskId');
const taskTitle = document.getElementById('taskTitle');
const taskDesc = document.getElementById('taskDesc');
const taskCol = document.getElementById('taskCol');
const taskPrio = document.getElementById('taskPrio');

function byId(id){ return state.tasks.find(t => t.id === id); }

function counts(tasks){
  const c = { backlog:0, todo:0, inprogress:0, done:0 };
  for(const t of tasks) c[t.col]++;
  for(const k of Object.keys(c)){
    const el = document.getElementById('count-'+k);
    if(el) el.textContent = c[k];
  }
}

let lastActivity = { version: 1, events: [] };
let teamsState = { version: 1, teams: { General: { color: '#00d1ff' }, Engineering: { color: '#7c5cff' } } };

function teamColor(team){
  const c = teamsState?.teams?.[team]?.color;
  return (typeof c === 'string' && c.startsWith('#')) ? c : (team === 'Engineering' ? '#7c5cff' : '#00d1ff');
}

function hexToRgba(hex, a){
  const h = hex.replace('#','').trim();
  const full = h.length === 3 ? h.split('').map(x=>x+x).join('') : h;
  const n = parseInt(full,16);
  const r = (n>>16)&255, g=(n>>8)&255, b=n&255;
  return `rgba(${r},${g},${b},${a})`;
}

function applyTeamColorsToConfigUI(){
  if(colorGeneral) colorGeneral.value = teamColor('General');
  if(colorEngineering) colorEngineering.value = teamColor('Engineering');
}

function updateFilters({eventsAll=[], tasksAll=[]} = {}){
  if(!filterTeam || !filterAgent) return;

  // Only show allowed top-level teams
  const teams = new Set(Object.keys(TEAMS));
  const agentsByTeam = new Map();
  for(const t of Object.keys(TEAMS)) agentsByTeam.set(t, new Set(TEAMS[t]));

  // Learn agents seen in payload, but bucket them into top-level teams
  for(const ev of eventsAll){
    const agent = String(ev.agent || 'unknown');
    const team = String(ev.team || teamOf(agent));
    if(!agentsByTeam.has(team)) continue;
    agentsByTeam.get(team).add(agent);
  }
  for(const task of tasksAll){
    const agent = taskAgent(task);
    const team = taskTeam(task);
    if(!agentsByTeam.has(team)) continue;
    agentsByTeam.get(team).add(agent);
  }

  const prevTeam = (filterTeam.value || '').trim();
  const prevAgent = (filterAgent.value || '').trim();

  // Teams dropdown
  const teamOptions = [''].concat([...teams].sort());
  filterTeam.innerHTML = '';
  for(const t of teamOptions){
    const opt = document.createElement('option');
    opt.value = t;
    opt.textContent = t ? `Equipo: ${t}` : 'Equipo: Todos';
    filterTeam.appendChild(opt);
  }
  filterTeam.value = teamOptions.includes(prevTeam) ? prevTeam : '';

  // Agents dropdown depends on selected team
  const selectedTeam = (filterTeam.value || '').trim();
  let agents = [];
  if(selectedTeam){
    agents = [...(agentsByTeam.get(selectedTeam) || new Set())].sort();
  }else{
    const all = new Set();
    for(const s of agentsByTeam.values()) for(const a of s) all.add(a);
    agents = [...all].sort();
  }

  const agentOptions = [''].concat(agents);
  filterAgent.innerHTML = '';
  for(const a of agentOptions){
    const opt = document.createElement('option');
    opt.value = a;
    opt.textContent = a ? `Agente: ${a}` : 'Agente: Todos';
    filterAgent.appendChild(opt);
  }

  // keep agent if still valid, otherwise reset
  filterAgent.value = agentOptions.includes(prevAgent) ? prevAgent : '';
}

function renderActivity(activity){
  if(!activityFeed) return;
  const eventsAll = Array.isArray(activity?.events) ? activity.events : [];

  // Keep cached
  lastActivity = activity && typeof activity === 'object' ? activity : lastActivity;

  // Update filter options based on both activity + tasks
  updateFilters({ eventsAll, tasksAll: state.tasks });

  const { team: teamSel, agent: agentSel } = currentFilters();

  const events = eventsAll.filter(ev => {
    const agent = String(ev.agent || 'unknown');
    const team = String(ev.team || teamOf(agent));
    if(teamSel && team !== teamSel) return false;
    if(agentSel && agent !== agentSel) return false;
    return true;
  });

  countActivity.textContent = String(events.length);
  activityFeed.innerHTML = '';

  // newest first
  for(const ev of [...events].slice(-80).reverse()){
    const div = document.createElement('div');
    div.className = 'feeditem';

    const top = document.createElement('div');
    top.className = 'feeditem__top';

    const left = document.createElement('div');
    const agent = String(ev.agent || 'unknown');
    const team = String(ev.team || teamOf(agent));
    left.textContent = `${team} / ${agent} • ${fmt(ev.ts || 0)}`;

    const tag = document.createElement('span');
    const typ = String(ev.type || 'info');
    tag.className = 'tag' + (typ === 'warn' ? ' tag--warn' : typ === 'error' ? ' tag--error' : '');
    tag.textContent = typ;

    top.appendChild(left);
    top.appendChild(tag);

    const text = document.createElement('div');
    text.className = 'feeditem__text';
    text.textContent = String(ev.text || '');

    div.appendChild(top);
    div.appendChild(text);
    activityFeed.appendChild(div);
  }
}

function render(){
  const zones = {
    backlog: board.querySelector('[data-dropzone="backlog"]'),
    todo: board.querySelector('[data-dropzone="todo"]'),
    inprogress: board.querySelector('[data-dropzone="inprogress"]'),
    done: board.querySelector('[data-dropzone="done"]'),
  };
  for(const z of Object.values(zones)) z.innerHTML = '';

  // Ensure filters exist even if activity feed hasn't loaded yet
  updateFilters({ eventsAll: Array.isArray(lastActivity?.events) ? lastActivity.events : [], tasksAll: state.tasks });
  const { team: teamSel, agent: agentSel } = currentFilters();

  const prioRank = { P0:0, P1:1, P2:2, P3:3 };
  const tasks = [...state.tasks]
    .filter(t => {
      const team = taskTeam(t);
      const agent = taskAgent(t);
      if(teamSel && team !== teamSel) return false;
      if(agentSel && agent !== agentSel) return false;
      return true;
    })
    .sort((a,b) => {
      const pa = prioRank[a.prio] ?? 9;
      const pb = prioRank[b.prio] ?? 9;
      if(pa !== pb) return pa - pb;
      return (b.updatedAt||0) - (a.updatedAt||0);
    });

  for(const t of tasks){
    const node = tpl.content.firstElementChild.cloneNode(true);
    node.dataset.id = t.id;
    const team = taskTeam(t);
    node.dataset.team = team;

    // Paint interior + border based on team color
    const col = teamColor(team);
    node.style.borderColor = hexToRgba(col, 0.40);
    node.style.background = `linear-gradient(180deg, ${hexToRgba(col, 0.18)}, rgba(11,16,32,.55))`;

    const badge = node.querySelector('[data-prio]');
    badge.textContent = t.prio;
    badge.setAttribute('data-prio', t.prio);

    node.querySelector('.card__title').textContent = t.title;
    const descEl = node.querySelector('.card__desc');
    descEl.textContent = t.desc || '';
    if(!t.desc) descEl.style.display = 'none';

    node.querySelector('[data-created]').textContent = 'C: ' + fmt(t.createdAt);
    node.querySelector('[data-updated]').textContent = 'U: ' + fmt(t.updatedAt);

    node.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', t.id);
      e.dataTransfer.effectAllowed = 'move';
      node.classList.add('dragging');
    });
    node.addEventListener('dragend', () => node.classList.remove('dragging'));

    node.querySelector('[data-action="edit"]').addEventListener('click', () => openEdit(t.id));
    node.querySelector('[data-action="delete"]').addEventListener('click', () => del(t.id));

    zones[t.col].appendChild(node);
  }

  counts(tasks);
}

function openNew(){
  dlgTitle.textContent = 'Nueva tarea';
  taskId.value = '';
  taskTitle.value = '';
  taskDesc.value = '';
  taskCol.value = 'backlog';
  taskPrio.value = 'P2';
  dlg.showModal();
  setTimeout(() => taskTitle.focus(), 50);
}

function openEdit(id){
  const t = byId(id);
  if(!t) return;
  dlgTitle.textContent = 'Editar tarea';
  taskId.value = t.id;
  taskTitle.value = t.title;
  taskDesc.value = t.desc || '';
  taskCol.value = t.col;
  taskPrio.value = t.prio;
  dlg.showModal();
  setTimeout(() => taskTitle.focus(), 50);
}

async function upsert(){
  const title = taskTitle.value.trim();
  const desc = taskDesc.value.trim();
  const col = taskCol.value;
  const prio = taskPrio.value;
  const t = now();
  if(!title) return;

  const id = taskId.value;
  if(id){
    const existing = byId(id);
    if(!existing) return;
    existing.title = title;
    existing.desc = desc;
    existing.col = col;
    existing.prio = prio;
    existing.updatedAt = t;
  }else{
    state.tasks.push({ id: uid(), title, desc, col, prio, createdAt: t, updatedAt: t });
  }

  await persist();
  render();
}

async function del(id){
  const t = byId(id);
  if(!t) return;
  const ok = confirm(`Borrar tarea?\n\n${t.title}`);
  if(!ok) return;
  state.tasks = state.tasks.filter(x => x.id !== id);
  await persist();
  render();
}

async function move(id, col){
  const t = byId(id);
  if(!t) return;
  if(t.col === col) return;
  t.col = col;
  t.updatedAt = now();
  await persist();
  render();
}

async function persist(){
  try{
    await apiSave(state);
    lastHash = hashState(state);
  }catch(e){
    if((e && String(e.message).includes('missing token'))){
      const token = prompt('Seteá el token del tablero (KANBAN_TOKEN):');
      if(token){
        setToken(token);
        await apiSave(state);
        lastHash = hashState(state);
        return;
      }
    }
    alert('No pude guardar en el servidor. Revisá token/conectividad.');
    throw e;
  }
}

// DnD dropzones
for(const zone of document.querySelectorAll('[data-dropzone]')){
  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    zone.classList.add('dragover');
  });
  zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
  zone.addEventListener('drop', async (e) => {
    e.preventDefault();
    zone.classList.remove('dragover');
    const id = e.dataTransfer.getData('text/plain');
    const col = zone.getAttribute('data-dropzone');
    await move(id, col);
  });
}

btnAdd.addEventListener('click', openNew);

btnReset.addEventListener('click', async () => {
  const ok = confirm('Resetear el tablero? (Sobrescribe tasks.json en el server)');
  if(!ok) return;
  state = seed();
  await persist();
  render();
});

btnToken.addEventListener('click', () => {
  const cur = getToken();
  const token = prompt('Token actual (KANBAN_TOKEN):', cur);
  if(token !== null) setToken(token);
});

btnExport.addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `clawe-kanban-${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

btnImport.addEventListener('click', () => fileImport.click());
fileImport.addEventListener('change', async () => {
  const file = fileImport.files?.[0];
  if(!file) return;
  const text = await file.text();
  try{
    const data = JSON.parse(text);
    if(!data || !Array.isArray(data.tasks)) throw new Error('Formato inválido');

    const t = now();
    data.version = 1;
    data.tasks = data.tasks.map(x => ({
      id: String(x.id || uid()),
      title: String(x.title || '').slice(0,140),
      desc: String(x.desc || '').slice(0,2000),
      col: ['backlog','todo','inprogress','done'].includes(x.col) ? x.col : 'backlog',
      prio: ['P0','P1','P2','P3'].includes(x.prio) ? x.prio : 'P2',
      createdAt: Number(x.createdAt || t),
      updatedAt: Number(x.updatedAt || t),
    }));

    state = data;
    await persist();
    render();
  }catch(err){
    alert('No pude importar ese JSON.');
  }finally{
    fileImport.value = '';
  }
});

formTask.addEventListener('submit', async (e) => {
  e.preventDefault();
  await upsert();
  dlg.close();
});

async function refreshFromServer({silent=false} = {}){
  // Avoid clobbering while user is editing/dragging
  if(dlg.open) return;
  if(document.querySelector('.dragging')) return;

  try{
    const [remote, activity, teams] = await Promise.all([
      apiLoad(),
      apiLoadActivity().catch(() => null),
      apiLoadTeams().catch(() => null),
    ]);

    if(teams){
      teamsState = teams;
      applyTeamColorsToConfigUI();
    }
    if(activity) renderActivity(activity);

    const h = hashState(remote);
    if(h !== lastHash){
      state = remote;
      lastHash = h;
      render();
    }
  }catch(e){
    if(!silent) console.warn('refresh failed', e);
  }
}

if(colorGeneral) colorGeneral.addEventListener('change', async () => {
  teamsState = { version: 1, teams: { General: { color: colorGeneral.value }, Engineering: { color: teamColor('Engineering') } } };
  try{ await apiSaveTeams(teamsState); }catch{ /* ignore */ }
  render();
});
if(colorEngineering) colorEngineering.addEventListener('change', async () => {
  teamsState = { version: 1, teams: { General: { color: teamColor('General') }, Engineering: { color: colorEngineering.value } } };
  try{ await apiSaveTeams(teamsState); }catch{ /* ignore */ }
  render();
});

if(filterTeam) filterTeam.addEventListener('change', () => {
  // when team changes, agent list becomes constrained
  updateFilters({ eventsAll: Array.isArray(lastActivity?.events) ? lastActivity.events : [], tasksAll: state.tasks });
  render();
  renderActivity(lastActivity);
});
if(filterAgent) filterAgent.addEventListener('change', () => {
  render();
  renderActivity(lastActivity);
});

async function init(){
  try{
    const [remote, activity, teams] = await Promise.all([
      apiLoad(),
      apiLoadActivity().catch(() => null),
      apiLoadTeams().catch(() => null),
    ]);
    state = remote;
    if(teams) teamsState = teams;
    applyTeamColorsToConfigUI();
    if(activity) renderActivity(activity);
  }catch{
    state = seed();
  }
  lastHash = hashState(state);
  render();

  // Auto-refresh for multi-device updates
  setInterval(() => refreshFromServer({silent:true}), POLL_MS);
}

init();
