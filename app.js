// ═══════════════════════════════════════
//  CONFIG
// ═══════════════════════════════════════
// ═══════════════════════════════════════
//  STATE
// ═══════════════════════════════════════
let uid = 'demo';
let tasks = [], morning = null, notes = [], evening = null;
let ritualStep = 1, ritualData = {};
let eveningStep = 1, eveningData = {};
let monthlyScores = {}, selectedEmotion = null, editingNoteId = null;
let charts = {};
let calYear = new Date().getFullYear();
let calMonth = new Date().getMonth();
let calCache = {};

const EMOTIONS = [
  {emoji:'😊',label:'Радость',     val:8, color:'#E8D5A8'},
  {emoji:'😌',label:'Спокойствие', val:7, color:'#A8C8D4'},
  {emoji:'😔',label:'Грусть',      val:3, color:'#A8B5D4'},
  {emoji:'😤',label:'Раздражение', val:2, color:'#E8C4A8'},
  {emoji:'😰',label:'Тревога',     val:2, color:'#D4B5D4'},
  {emoji:'😴',label:'Усталость',   val:4, color:'#C5C5C5'},
  {emoji:'🔥',label:'Энергия',     val:9, color:'#E8A87C'},
  {emoji:'🤔',label:'Задумчивость',val:6, color:'#B5D4B5'},
];

const MONTH_ITEMS = ['Общее состояние','Благодарность','Осознанность','Семья','Друзья','Личная жизнь','Развлечения','Спокойствие','Время для себя','Здоровая еда','Спорт','Прогулки на свежем воздухе','Здоровье','Творчество','Финансы','Работа и учёба','Мысли и эмоции','Настоящее','Будущее'];

const MOOD_PRIORITY = ['Энергия','Радость','Спокойствие','Задумчивость','Усталость','Тревога','Раздражение','Грусть'];
const MOOD_COLORS = {'Радость':'#B5D4B5','Энергия':'#B5D4B5','Спокойствие':'#E8D5A8','Задумчивость':'#E8D5A8','Усталость':'#C5C5C5','Тревога':'#E8C4A8','Раздражение':'#E8C4A8','Грусть':'#D4B5D4'};

// ═══════════════════════════════════════
//  UTILS
// ═══════════════════════════════════════
const today   = () => new Date().toISOString().split('T')[0];
const nowTime = () => new Date().toTimeString().slice(0,5);

function fmtDate(ds) {
  const d = new Date(ds+'T00:00:00');
  const DN = ['Воскресенье','Понедельник','Вторник','Среда','Четверг','Пятница','Суббота'];
  const MN = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
  return `${DN[d.getDay()]}, ${d.getDate()} ${MN[d.getMonth()]}`;
}
function weekStart(d=new Date()){const dt=new Date(d);const day=dt.getDay();dt.setDate(dt.getDate()-day+(day===0?-6:1));return dt.toISOString().split('T')[0]}
const monthStr=(d=new Date())=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
const isSunday=()=>new Date().getDay()===0;
const isFirst =()=>new Date().getDate()===1;

function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
function toast(msg,ms=2400){const t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),ms)}
function updSl(id,v){document.getElementById(id).textContent=v}

function getDayMood(dayNotes) {
  if (!dayNotes || !dayNotes.length) return null;
  const cnt={};
  dayNotes.forEach(n=>{cnt[n.emotion]=(cnt[n.emotion]||0)+1});
  const maxCnt=Math.max(...Object.values(cnt));
  const tied=Object.entries(cnt).filter(([,v])=>v===maxCnt).map(([k])=>k);
  tied.sort((a,b)=>MOOD_PRIORITY.indexOf(a)-MOOD_PRIORITY.indexOf(b));
  const top=tied[0];
  return {emotion:top, color:MOOD_COLORS[top]||'var(--s3)'};
}

// ═══════════════════════════════════════
//  STORAGE
// ═══════════════════════════════════════
function lsGet(k){try{return JSON.parse(localStorage.getItem(k))}catch{return null}}
function lsSet(k,v){localStorage.setItem(k,JSON.stringify(v))}

const TABLE_PREFIX={daily_tasks:'tasks_',morning_ritual:'morning_',mood_notes:'mood_notes_',evening_ritual:'evening_',weekly_review:'weekly_',monthly_review:'monthly_'};
function tableKey(table,filters){
  const p=TABLE_PREFIX[table]||table+'_';
  if(filters.date)return p+filters.date;
  if(filters.week_start)return p+filters.week_start;
  if(filters.month)return p+filters.month;
  return null;
}
function tablePrefix(table){return TABLE_PREFIX[table]||table+'_'}

function dbGet(table,filters={}){
  const k=tableKey(table,filters);
  if(k)return lsGet(k)||[];
  const prefix=tablePrefix(table),all=[];
  for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(key.startsWith(prefix)){const rows=lsGet(key)||[];all.push(...(Array.isArray(rows)?rows:[rows]))}}
  return Object.keys(filters).length?all.filter(r=>Object.entries(filters).every(([k,v])=>r[k]===v)):all;
}
function dbInsert(table,row){
  const full={...row,user_id:uid,id:Date.now()+'-'+Math.random().toString(36).slice(2,7),created_at:new Date().toISOString()};
  const k=tableKey(table,{date:row.date,week_start:row.week_start,month:row.month})||tablePrefix(table)+today();
  const rows=lsGet(k)||[];rows.push(full);lsSet(k,rows);
  return full;
}
function dbUpdate(table,id,patch){
  const prefix=tablePrefix(table);
  for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k.startsWith(prefix)){const rows=lsGet(k)||[];const idx=rows.findIndex(r=>r.id==id);if(idx>=0){rows[idx]={...rows[idx],...patch};lsSet(k,rows);return}}}
}
function dbDelete(table,id){
  const prefix=tablePrefix(table);
  for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k.startsWith(prefix)){const rows=lsGet(k)||[];const f=rows.filter(r=>r.id!=id);if(f.length!==rows.length){lsSet(k,f);return}}}
}
function dbUpsert(table,matchKeys,row){
  const full={...row,user_id:uid};
  const k=tableKey(table,{date:row.date,week_start:row.week_start,month:row.month})||tablePrefix(table)+today();
  const rows=lsGet(k)||[];
  const i=rows.findIndex(r=>matchKeys.every(mk=>r[mk]===full[mk]));
  const entry={...(i>=0?rows[i]:{}), ...full, id:i>=0?rows[i].id:Date.now(), created_at:i>=0?rows[i].created_at:new Date().toISOString()};
  if(i>=0)rows[i]=entry;else rows.push(entry);
  lsSet(k,rows);
}

// ═══════════════════════════════════════
//  MODALS
// ═══════════════════════════════════════
function openM(id){document.getElementById(id).classList.add('open');document.body.style.overflow='hidden'}
function closeM(id){document.getElementById(id).classList.remove('open');document.body.style.overflow=''}
document.querySelectorAll('.overlay').forEach(o=>{o.addEventListener('click',e=>{if(e.target===o)closeM(o.id)})});

// ═══════════════════════════════════════
//  NAV
// ═══════════════════════════════════════
function switchTab(name,el){
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById(`tab-${name}`).classList.add('active');
  el.classList.add('active');
  if(name==='mood')  renderMood();
  if(name==='cal')   renderCalendar();
  if(name==='stats') loadStats();
  updateFab();
}
function updateFab(){
  const moodActive=document.getElementById('tab-mood').classList.contains('active');
  document.getElementById('fab').style.display=moodActive?'flex':'none';
}

// ═══════════════════════════════════════
//  TASKS
// ═══════════════════════════════════════
function loadTasks(){tasks=dbGet('daily_tasks',{date:today()})}

function renderTasks(){
  document.getElementById('tasks-date').textContent=fmtDate(today());

  // Ritual banner
  const banner=document.getElementById('ritual-banner');
  if(morning){
    banner.innerHTML=`<div class="ritual-banner"><span class="rb-icon">🌅</span><div class="rb-info"><div class="rb-title">Утренний ритуал</div><div class="rb-sub">Выполнен сегодня ✓</div></div></div>`;
  } else {
    banner.innerHTML=`<div class="ritual-banner"><span class="rb-icon">🌅</span><div class="rb-info"><div class="rb-title">Утренний ритуал</div><div class="rb-sub">Ещё не пройден</div></div><button class="btn btn-pink btn-sm" onclick="openRitual()" style="flex-shrink:0;margin-left:8px">Начать</button></div>`;
  }

  // Tasks list
  const list=document.getElementById('tasks-list');
  if(!tasks.length){
    list.innerHTML=`<div class="empty"><div class="ei">📋</div><p>Задачи на сегодня появятся здесь</p></div>`;
  } else {
    list.innerHTML=tasks.map(t=>`
      <div class="task-card">
        <div class="task-cb ${t.completed?'done':''}" onclick="toggleTask('${t.id}')"></div>
        <div class="task-txt ${t.completed?'done':''}" onclick="openEdit('${t.id}')">${esc(t.text)}</div>
        <div class="task-acts">
          <button class="task-act" onclick="openEdit('${t.id}')">✏️</button>
          <button class="task-act" onclick="delTask('${t.id}')">🗑️</button>
        </div>
      </div>`).join('');
  }
  updateProg();
}

function updateProg(){
  const total=tasks.length,done=tasks.filter(t=>t.completed).length;
  const pct=total?Math.round(done/total*100):0;
  document.getElementById('prog-bar').style.width=pct+'%';
  document.getElementById('prog-text').textContent=`${done} из ${total} задач выполнено`;
}

function addTask(){
  const inp=document.getElementById('new-task-inp');
  const txt=inp.value.trim();if(!txt)return;
  const row=dbInsert('daily_tasks',{date:today(),text:txt,completed:false});
  tasks.push(row);inp.value='';renderTasks();toast('Задача добавлена ✓');
}
document.getElementById('new-task-inp').addEventListener('keydown',e=>{if(e.key==='Enter')addTask()});

function toggleTask(id){const t=tasks.find(t=>t.id==id);if(!t)return;t.completed=!t.completed;dbUpdate('daily_tasks',id,{completed:t.completed});renderTasks()}
function delTask(id){dbDelete('daily_tasks',id);tasks=tasks.filter(t=>t.id!=id);renderTasks();toast('Задача удалена')}
function openEdit(id){const t=tasks.find(t=>t.id==id);if(!t)return;document.getElementById('edit-id').value=id;document.getElementById('edit-txt').value=t.text;openM('m-edit-task')}
function saveEdit(){const id=document.getElementById('edit-id').value;const txt=document.getElementById('edit-txt').value.trim();if(!txt)return;const t=tasks.find(t=>t.id==id);if(!t)return;t.text=txt;dbUpdate('daily_tasks',id,{text:txt});renderTasks();closeM('m-edit-task');toast('Задача обновлена')}

function startDay(){
  const inputs=document.querySelectorAll('#mt-list input');
  for(const inp of inputs){const txt=inp.value.trim();if(txt){const row=dbInsert('daily_tasks',{date:today(),text:txt,completed:false});tasks.push(row)}}
  renderTasks();closeM('m-morning-tasks');toast('Удачного дня! 🌟');
}

// ═══════════════════════════════════════
//  DYNAMIC LIST HELPERS
// ═══════════════════════════════════════
function addDyn(listId,ph,min){const list=document.getElementById(listId);const div=document.createElement('div');div.className='dyn-item';div.innerHTML=`<input class="inp" type="text" placeholder="${ph}"/><button class="rem-btn" onclick="remDyn(this,'${listId}',${min})">×</button>`;list.appendChild(div);div.querySelector('input').focus()}
function remDyn(btn,listId,min){const list=document.getElementById(listId);if(list.children.length<=min)return;btn.parentElement.remove()}
function dynVals(listId){return Array.from(document.querySelectorAll(`#${listId} input`)).map(i=>i.value.trim()).filter(Boolean)}

// ═══════════════════════════════════════
//  MORNING RITUAL
// ═══════════════════════════════════════
function loadMorning(){const rows=dbGet('morning_ritual',{date:today()});morning=rows[0]||null}

function openRitual(){ritualStep=1;ritualData={};renderRitual();openM('m-ritual')}
function openEditRitual(){ritualStep=1;ritualData={gratitude:morning.gratitude||[],good_day:morning.good_day||'',affirmation:morning.affirmation||''};renderRitual();openM('m-ritual')}

function renderRitual(){
  const fill=document.getElementById('ritual-topbar-fill');
  if(fill)fill.style.width=(ritualStep/3*100)+'%';
  document.getElementById('ritual-back').style.display=ritualStep>1?'flex':'none';
  document.getElementById('ritual-next').textContent=ritualStep===3?'Завершить ритуал ✨':'Далее →';
  const body=document.getElementById('ritual-body');
  if(ritualStep===1){
    body.innerHTML=`<div class="sheet-title">За что ты благодарен? 🙏</div><div class="sheet-sub">Запиши минимум 3 момента</div><div class="dyn-list" id="grat-list"><div class="dyn-item"><input class="inp" type="text" placeholder="Я благодарен за…" value="${esc((ritualData.gratitude||[])[0]||'')}"/></div><div class="dyn-item"><input class="inp" type="text" placeholder="Я благодарен за…" value="${esc((ritualData.gratitude||[])[1]||'')}"/></div><div class="dyn-item"><input class="inp" type="text" placeholder="Я благодарен за…" value="${esc((ritualData.gratitude||[])[2]||'')}"/></div>${(ritualData.gratitude||[]).slice(3).map(g=>`<div class="dyn-item"><input class="inp" type="text" value="${esc(g)}"/><button class="rem-btn" onclick="remDyn(this,'grat-list',3)">×</button></div>`).join('')}</div><button class="btn btn-ghost" onclick="addDyn('grat-list','Я благодарен за…',3)">+ Добавить ещё</button>`;
  } else if(ritualStep===2){
    body.innerHTML=`<div class="sheet-title">Хороший день 🌸</div><div class="sheet-sub">Что сделает этот день хорошим?</div><textarea class="inp" id="r-good" placeholder="Сегодня будет хороший день, потому что…" style="min-height:120px">${esc(ritualData.good_day||'')}</textarea>`;
  } else {
    body.innerHTML=`<div class="sheet-title">Установка дня ✨</div><div class="sheet-sub">Положительная установка на сегодня</div><textarea class="inp" id="r-aff" placeholder="Сегодня я буду…" style="min-height:120px">${esc(ritualData.affirmation||'')}</textarea>`;
  }
}

function ritualBack(){
  if(ritualStep===2)ritualData.good_day=document.getElementById('r-good')?.value||'';
  if(ritualStep===3)ritualData.affirmation=document.getElementById('r-aff')?.value||'';
  ritualStep--;renderRitual();
}

function ritualNext(){
  try{
    if(ritualStep===1){
      const grats=dynVals('grat-list');if(grats.length<3){toast('Заполни минимум 3 пункта');return}
      ritualData.gratitude=grats;ritualStep++;renderRitual();
    } else if(ritualStep===2){
      ritualData.good_day=document.getElementById('r-good').value.trim();ritualStep++;renderRitual();
    } else {
      ritualData.affirmation=document.getElementById('r-aff').value.trim();
      dbUpsert('morning_ritual',['user_id','date'],{date:today(),gratitude:ritualData.gratitude,good_day:ritualData.good_day,affirmation:ritualData.affirmation});
      morning={...ritualData,date:today()};
      closeM('m-ritual');toast('Утренний ритуал завершён ✨');
      renderMood();renderTasks();updateFab();
    }
  }catch(e){console.error('ritualNext error:',e);alert('Ошибка: '+e.message)}
}

// ═══════════════════════════════════════
//  MOOD NOTES
// ═══════════════════════════════════════
function loadNotes(){
  notes=dbGet('mood_notes',{date:today()});
  const ev=dbGet('evening_ritual',{date:today()});
  evening=ev[0]||null;
}

function renderMood(){
  document.getElementById('mood-date').textContent=fmtDate(today());
  const el=document.getElementById('mood-content');
  let html='';

  if(!morning){
    html+=`<div class="ritual-banner" style="margin-bottom:16px"><span class="rb-icon">🌅</span><div class="rb-info"><div class="rb-title">Утренний ритуал</div><div class="rb-sub">Ещё не пройден сегодня</div></div><button class="btn btn-pink btn-sm" onclick="openRitual()" style="flex-shrink:0;margin-left:8px">Начать ✨</button></div>`;
  } else {
    html+=`<div class="card"><div class="coll-head" onclick="toggleColl('rc','ra')"><span class="ritual-badge">✓ Утренний ритуал</span><div style="display:flex;align-items:center;gap:8px"><button onclick="event.stopPropagation();openEditRitual()" style="background:none;border:none;cursor:pointer;font-size:15px;padding:2px 4px;color:var(--gray)">✏️</button><span class="coll-arrow" id="ra">▼</span></div></div><div class="coll-body" id="rc"><div class="rec-block"><div class="rec-label">Благодарность</div><ul class="rec-list">${(morning.gratitude||[]).map(g=>`<li>${esc(g)}</li>`).join('')}</ul></div>${morning.good_day?`<div class="rec-block"><div class="rec-label">Что сделает день хорошим</div><div class="rec-text">${esc(morning.good_day)}</div></div>`:''} ${morning.affirmation?`<div class="rec-block"><div class="rec-label">Установка дня</div><div class="rec-text">${esc(morning.affirmation)}</div></div>`:''}</div></div>`;
  }

  html+=`<span class="section-label" style="margin-top:8px;display:block">Заметки дня</span>`;
  if(!notes.length){
    html+=`<div class="empty" style="padding:24px 0"><div class="ei">💭</div><p>Нажми + чтобы добавить заметку</p></div>`;
  } else {
    html+=notes.map(n=>{
      const em=EMOTIONS.find(e=>e.label===n.emotion);
      const c=em?em.color:'var(--s4)';
      return `<div class="mood-note" style="box-shadow:inset 3px 0 0 ${c}"><div class="mood-note-top"><span style="font-size:26px">${em?em.emoji:'💭'}</span><div style="display:flex;align-items:center;gap:8px"><span style="font-size:12px;color:var(--gray)">${n.time||''}</span><button onclick="openEditNote('${n.id}')" style="background:none;border:none;cursor:pointer;font-size:15px;padding:2px 4px;color:var(--gray)">✏️</button><button onclick="deleteNote('${n.id}')" style="background:none;border:none;cursor:pointer;font-size:15px;padding:2px 4px;color:var(--gray)">🗑️</button></div></div><div class="mood-note-txt">${esc(n.text)}</div><div class="mood-note-em" style="color:${c}">${n.emotion||''}</div></div>`;
    }).join('');
  }

  if(evening){
    html+=`<div class="card" style="margin-top:8px"><div class="coll-head" onclick="toggleColl('ec','ea')"><span class="ritual-badge ev">🌙 Вечерний ритуал</span><div style="display:flex;align-items:center;gap:8px"><button onclick="event.stopPropagation();openEditEvening()" style="background:none;border:none;cursor:pointer;font-size:15px;padding:2px 4px;color:var(--gray)">✏️</button><span class="coll-arrow" id="ea">▼</span></div></div><div class="coll-body" id="ec">${evening.good_for_others?`<div class="rec-block"><div class="rec-label">Сделал для других</div><div class="rec-text">${esc(evening.good_for_others)}</div></div>`:''} ${evening.improve_tomorrow?`<div class="rec-block"><div class="rec-label">Улучшу завтра</div><div class="rec-text">${esc(evening.improve_tomorrow)}</div></div>`:''} ${evening.beautiful_events?`<div class="rec-block"><div class="rec-label">Прекрасные события</div><ul class="rec-list">${(evening.beautiful_events||[]).map(e=>`<li>${esc(e)}</li>`).join('')}</ul></div>`:''}</div></div>`;
  } else {
    html+=`<button class="btn btn-purple btn-full" onclick="openEvening()" style="margin-top:12px">🌙 Завершить день</button>`;
  }

  el.innerHTML=html;updateFab();
}

function toggleColl(bodyId,arrowId){document.getElementById(bodyId).classList.toggle('open');document.getElementById(arrowId).classList.toggle('open')}

function openAddNote(){
  editingNoteId=null;selectedEmotion=null;
  document.getElementById('note-txt').value='';
  document.getElementById('note-time').textContent=nowTime();
  document.getElementById('em-picker').innerHTML=EMOTIONS.map(e=>`<div class="em-btn" onclick="selEm('${esc(e.label)}',this)" data-color="${e.color}"><span class="ee">${e.emoji}</span><span class="el">${e.label}</span></div>`).join('');
  openM('m-note');
}
function openEditNote(id){
  const n=notes.find(n=>n.id==id);if(!n)return;
  editingNoteId=id;selectedEmotion=n.emotion||null;
  document.getElementById('note-txt').value=n.text||'';
  document.getElementById('note-time').textContent=n.time||'';
  document.getElementById('em-picker').innerHTML=EMOTIONS.map(e=>`<div class="em-btn${e.label===n.emotion?' sel':''}" onclick="selEm('${esc(e.label)}',this)" data-color="${e.color}" style="${e.label===n.emotion?`border-color:${e.color};background:${e.color}28`:''}" ><span class="ee">${e.emoji}</span><span class="el">${e.label}</span></div>`).join('');
  openM('m-note');
}

function selEm(label,el){
  selectedEmotion=label;
  document.querySelectorAll('.em-btn').forEach(b=>{b.classList.remove('sel');b.style.borderColor='transparent';b.style.background='var(--s3)'});
  el.classList.add('sel');const c=el.dataset.color;
  if(c){el.style.borderColor=c;el.style.background=c+'28'}
}

function deleteNote(id){
  dbDelete('mood_notes',id);
  notes=notes.filter(n=>n.id!=id);
  calCache={};renderMood();toast('Заметка удалена');
}
function saveNote(){
  const txt=document.getElementById('note-txt').value.trim();
  if(!txt){toast('Напиши что-нибудь 💬');return}
  if(editingNoteId){
    const n=notes.find(n=>n.id==editingNoteId);if(!n)return;
    n.text=txt;n.emotion=selectedEmotion||n.emotion;
    dbUpdate('mood_notes',editingNoteId,{text:n.text,emotion:n.emotion});
    editingNoteId=null;closeM('m-note');calCache={};renderMood();toast('Заметка обновлена ✏️');
  } else {
    const row=dbInsert('mood_notes',{date:today(),time:nowTime(),text:txt,emotion:selectedEmotion||'Задумчивость'});
    notes.push(row);closeM('m-note');calCache={};renderMood();toast('Заметка добавлена 💙');
  }
}

// ═══════════════════════════════════════
//  EVENING RITUAL
// ═══════════════════════════════════════
function openEvening(){eveningStep=1;eveningData={};renderEvening();openM('m-evening')}
function openEditEvening(){eveningStep=1;eveningData={good_for_others:evening.good_for_others||'',improve_tomorrow:evening.improve_tomorrow||'',beautiful_events:evening.beautiful_events||[]};renderEvening();openM('m-evening')}

function renderEvening(){
  const fill=document.getElementById('evening-topbar-fill');
  if(fill)fill.style.width=(eveningStep/3*100)+'%';
  document.getElementById('evening-back').style.display=eveningStep>1?'flex':'none';
  document.getElementById('evening-next').textContent=eveningStep===3?'Завершить день 🌙':'Далее →';
  const body=document.getElementById('evening-body');
  if(eveningStep===1){
    body.innerHTML=`<div class="sheet-title">Добро дня 💝</div><div class="sheet-sub">Что ты сделал хорошего для других?</div><textarea class="inp" id="ev-others" placeholder="Сегодня я помог/поддержал…" style="min-height:120px">${esc(eveningData.good_for_others||'')}</textarea>`;
  } else if(eveningStep===2){
    body.innerHTML=`<div class="sheet-title">Улучшения 🔄</div><div class="sheet-sub">Что смогу сделать завтра лучше?</div><textarea class="inp" id="ev-improve" placeholder="Завтра я постараюсь…" style="min-height:120px">${esc(eveningData.improve_tomorrow||'')}</textarea>`;
  } else {
    body.innerHTML=`<div class="sheet-title">Прекрасное 🌟</div><div class="sheet-sub">Прекрасные события сегодняшнего дня</div><div class="dyn-list" id="ev-events"><div class="dyn-item"><input class="inp" type="text" placeholder="Сегодня произошло…"/></div><div class="dyn-item"><input class="inp" type="text" placeholder="Сегодня произошло…"/></div><div class="dyn-item"><input class="inp" type="text" placeholder="Сегодня произошло…"/></div></div><button class="btn btn-ghost" onclick="addDyn('ev-events','Сегодня произошло…',3)">+ Добавить ещё</button>`;
    if(eveningData.beautiful_events){const inps=document.querySelectorAll('#ev-events input');eveningData.beautiful_events.slice(0,3).forEach((v,i)=>{if(inps[i])inps[i].value=v})}
  }
}

function eveningBack(){
  if(eveningStep===2)eveningData.good_for_others=document.getElementById('ev-others')?.value||'';
  if(eveningStep===3)eveningData.beautiful_events=dynVals('ev-events');
  eveningStep--;renderEvening();
}

function eveningNext(){
  try{
    if(eveningStep===1){eveningData.good_for_others=document.getElementById('ev-others').value.trim();eveningStep++;renderEvening()}
    else if(eveningStep===2){eveningData.improve_tomorrow=document.getElementById('ev-improve').value.trim();eveningStep++;renderEvening()}
    else {
      const evs=dynVals('ev-events');if(evs.length<3){toast('Запиши минимум 3 события');return}
      eveningData.beautiful_events=evs;
      dbUpsert('evening_ritual',['user_id','date'],{date:today(),good_for_others:eveningData.good_for_others,improve_tomorrow:eveningData.improve_tomorrow,beautiful_events:eveningData.beautiful_events});
      evening={...eveningData,date:today()};
      calCache={};
      closeM('m-evening');toast('Хорошего вечера! 🌙');renderMood();
    }
  }catch(e){console.error('eveningNext error:',e);alert('Ошибка: '+e.message)}
}

// ═══════════════════════════════════════
//  WEEKLY / MONTHLY REVIEWS
// ═══════════════════════════════════════
function checkWeekly(){
  const ws=weekStart();if(lsGet(`wr-shown:${ws}`))return;
  const rows=dbGet('weekly_review',{week_start:ws});if(rows.length)return;
  lsSet(`wr-shown:${ws}`,1);setTimeout(()=>openM('m-weekly'),900);
}
async function saveWeekly(){
  const ach=dynVals('w-ach-list');if(ach.length<3){toast('Запиши минимум 3 успеха');return}
  await dbUpsert('weekly_review',['user_id','week_start'],{week_start:weekStart(),achievements:ach,happiness_score:parseInt(document.getElementById('w-happy-sl').value),happiness_reason:document.getElementById('w-reason').value.trim(),learned:document.getElementById('w-learned').value.trim(),next_week:document.getElementById('w-next').value.trim()});
  closeM('m-weekly');toast('Обзор недели сохранён 🌟');
}

function checkMonthly(){
  if(!isFirst())return;const ms=monthStr();if(lsGet(`mr-shown:${ms}`))return;
  const rows=dbGet('monthly_review',{month:ms});if(rows.length)return;
  lsSet(`mr-shown:${ms}`,1);monthlyScores={};renderMonthlyList();setTimeout(()=>openM('m-monthly'),1200);
}
function renderMonthlyList(){document.getElementById('monthly-list').innerHTML=MONTH_ITEMS.map((name,i)=>`<div class="month-row" id="mr-${i}"><div class="month-row-head"><span class="month-row-name">${name}</span><span class="month-skip" onclick="skipMonth(${i})">Отмечу позже</span></div><div class="score-btns">${[1,2,3,4,5,6,7,8,9,10].map(n=>`<button class="sb${monthlyScores[i]===n?' sel':''}" onclick="setScore(${i},${n},this)">${n}</button>`).join('')}</div></div>`).join('')}
function setScore(idx,val,el){monthlyScores[idx]=val;el.closest('.score-btns').querySelectorAll('.sb').forEach(b=>b.classList.remove('sel'));el.classList.add('sel')}
function skipMonth(idx){const r=document.getElementById(`mr-${idx}`);if(r)r.style.opacity='.35'}
async function saveMonthly(){await dbUpsert('monthly_review',['user_id','month'],{month:monthStr(),scores:monthlyScores,notes:document.getElementById('m-notes').value.trim()});closeM('m-monthly');toast('Обзор месяца сохранён 📅')}

// ═══════════════════════════════════════
//  CALENDAR
// ═══════════════════════════════════════
async function loadCalendarData(year, month) {
  const key=`${year}-${String(month+1).padStart(2,'0')}`;
  if(calCache[key])return;
  const prefix=key+'-';
  const[allNotes,allTasks,allMorning,allEvening]=await Promise.all([
    dbGet('mood_notes',{}),dbGet('daily_tasks',{}),dbGet('morning_ritual',{}),dbGet('evening_ritual',{})
  ]);
  const days={};
  const ensure=ds=>{if(!days[ds])days[ds]={notes:[],tasks:[],morning:null,evening:null};return days[ds]};
  allNotes.filter(n=>n.date&&n.date.startsWith(prefix)).forEach(n=>ensure(n.date).notes.push(n));
  allTasks.filter(t=>t.date&&t.date.startsWith(prefix)).forEach(t=>ensure(t.date).tasks.push(t));
  allMorning.filter(m=>m.date&&m.date.startsWith(prefix)).forEach(m=>ensure(m.date).morning=m);
  allEvening.filter(e=>e.date&&e.date.startsWith(prefix)).forEach(e=>ensure(e.date).evening=e);
  calCache[key]=days;
}

async function renderCalendar(){
  const key=`${calYear}-${String(calMonth+1).padStart(2,'0')}`;
  await loadCalendarData(calYear,calMonth);
  const days=calCache[key]||{};
  const todayStr=today();
  const daysInMonth=new Date(calYear,calMonth+1,0).getDate();
  let startDow=new Date(calYear,calMonth,1).getDay()-1;
  if(startDow<0)startDow=6;
  const MN=['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];

  let gridHtml='';
  for(let i=0;i<startDow;i++)gridHtml+=`<div class="cal-cell cal-empty"></div>`;
  for(let d=1;d<=daysInMonth;d++){
    const ds=`${key}-${String(d).padStart(2,'0')}`;
    const dd=days[ds]||{notes:[],tasks:[],morning:null,evening:null};
    const mood=getDayMood(dd.notes);
    const isToday=ds===todayStr;
    const isFuture=ds>todayStr;
    let cellStyle='';
    if(mood&&!isFuture)cellStyle=`background:${mood.color};color:var(--dark)`;
    const cls=['cal-cell',isToday?'cal-today':'',isFuture?'cal-future':''].filter(Boolean).join(' ');
    const onclick=!isFuture?`onclick="openDayDetail('${ds}')"`: '';
    gridHtml+=`<div class="${cls}" style="${cellStyle}" ${onclick}>${d}${dd.evening&&!isFuture?'<span class="cal-star">✦</span>':''}</div>`;
  }

  // Stats for this month
  const filledDays=Object.keys(days).filter(ds=>days[ds].notes.length>0).length;
  let streak=0,cur=0;
  for(let d=1;d<=daysInMonth;d++){
    const ds=`${key}-${String(d).padStart(2,'0')}`;
    if(days[ds]&&days[ds].notes.length>0){cur++;streak=Math.max(streak,cur)}else cur=0;
  }
  const allMonthNotes=Object.values(days).flatMap(d=>d.notes);
  let topEmoji='—';
  if(allMonthNotes.length){const cnt={};allMonthNotes.forEach(n=>{cnt[n.emotion]=(cnt[n.emotion]||0)+1});const top=Object.entries(cnt).sort((a,b)=>b[1]-a[1])[0];const em=EMOTIONS.find(e=>e.label===top[0]);topEmoji=em?em.emoji:'—'}

  document.getElementById('cal-content').innerHTML=`
    <div class="card">
      <div class="cal-header">
        <button class="cal-nav-btn" onclick="calPrev()">‹</button>
        <div class="cal-month-title">${MN[calMonth]} ${calYear}</div>
        <button class="cal-nav-btn" onclick="calNext()">›</button>
      </div>
      <div class="cal-dow"><span>Пн</span><span>Вт</span><span>Ср</span><span>Чт</span><span>Пт</span><span>Сб</span><span>Вс</span></div>
      <div class="cal-grid">${gridHtml}</div>
      <div class="cal-legend">
        <div class="legend-item"><div class="legend-dot" style="background:#B5D4B5"></div>Отличный</div>
        <div class="legend-item"><div class="legend-dot" style="background:#E8D5A8"></div>Хороший</div>
        <div class="legend-item"><div class="legend-dot" style="background:#C5C5C5"></div>Нейтральный</div>
        <div class="legend-item"><div class="legend-dot" style="background:#E8C4A8"></div>Сложный</div>
        <div class="legend-item"><div class="legend-dot" style="background:#D4B5D4"></div>Тяжёлый</div>
      </div>
    </div>
    <div class="card">
      <span class="section-label">Статистика месяца</span>
      <div class="cal-stats">
        <div class="cal-stat-tile"><div class="cal-stat-val">${streak}</div><div class="cal-stat-lbl">Макс. streak дней</div></div>
        <div class="cal-stat-tile"><div class="cal-stat-val">${filledDays}</div><div class="cal-stat-lbl">Дней заполнено</div></div>
        <div class="cal-stat-tile"><div class="cal-stat-val" style="font-size:26px">${topEmoji}</div><div class="cal-stat-lbl">Частая эмоция</div></div>
      </div>
    </div>`;
}

function calPrev(){calMonth--;if(calMonth<0){calMonth=11;calYear--}renderCalendar()}
function calNext(){calMonth++;if(calMonth>11){calMonth=0;calYear++}renderCalendar()}

function openDayDetail(ds){
  const d=new Date(ds+'T00:00:00');
  const DN=['Воскресенье','Понедельник','Вторник','Среда','Четверг','Пятница','Суббота'];
  const MN=['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];

  const morning = lsGet('morning_'+ds);
  const notes   = lsGet('mood_notes_'+ds)||[];
  const evening = lsGet('evening_'+ds);
  const tasks   = lsGet('tasks_'+ds)||[];

  const hasAny = morning||notes.length||evening||tasks.length;

  let html=`<div class="dd-date">${DN[d.getDay()]}, ${d.getDate()} ${MN[d.getMonth()]}</div>`;

  if(!hasAny){
    html+=`<div class="empty"><div class="ei">📭</div><p>В этот день записей нет</p></div>`;
    document.getElementById('day-detail').innerHTML=html;
    openM('m-day');
    return;
  }

  // Утренний ритуал — благодарности
  if(morning){
    const grats=(morning.gratitude||[]).filter(Boolean);
    if(grats.length){
      html+=`<div class="dd-row" style="flex-direction:column;align-items:flex-start;gap:6px">
        <div style="display:flex;align-items:center;gap:10px"><span class="dd-icon">🙏</span><div><div class="dd-label">Благодарность</div></div></div>
        <ul class="rec-list" style="padding-left:8px">${grats.map(g=>`<li>${esc(g)}</li>`).join('')}</ul>
      </div>`;
    }
  }

  // Задачи — прогресс
  if(tasks.length){
    const done=tasks.filter(t=>t.completed).length;
    const pct=Math.round(done/tasks.length*100);
    html+=`<div class="dd-row" style="flex-direction:column;align-items:flex-start;gap:8px">
      <div style="display:flex;align-items:center;gap:10px"><span class="dd-icon">✅</span><div><div class="dd-label">Задачи</div><div class="dd-val">${done} из ${tasks.length} выполнено</div></div></div>
      <div class="prog-wrap" style="width:100%;margin:0"><div class="prog-bar" style="width:${pct}%"></div></div>
      <div class="prog-text">${pct}%</div>
    </div>`;
  }

  // Заметки настроения с эмоциями
  if(notes.length){
    html+=`<div class="dd-row" style="flex-direction:column;align-items:flex-start;gap:8px">
      <div style="display:flex;align-items:center;gap:10px"><span class="dd-icon">💭</span><div><div class="dd-label">Заметки дня</div></div></div>
      ${notes.map(n=>{
        const em=EMOTIONS.find(e=>e.label===n.emotion);
        const c=em?em.color:'var(--s4)';
        return `<div style="background:var(--s2);border-radius:12px;padding:10px 12px;width:100%;box-shadow:inset 3px 0 0 ${c}">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
            <span style="font-size:18px">${em?em.emoji:'💭'}</span>
            <span style="font-size:12px;font-weight:600;color:${c}">${n.emotion||''}</span>
            <span style="font-size:11px;color:var(--gray);margin-left:auto">${n.time||''}</span>
          </div>
          <div style="font-size:14px;line-height:1.5">${esc(n.text)}</div>
        </div>`;
      }).join('')}
    </div>`;
  }

  // Вечерний ритуал
  if(evening){
    html+=`<div class="dd-row" style="flex-direction:column;align-items:flex-start;gap:8px">
      <div style="display:flex;align-items:center;gap:10px"><span class="dd-icon">🌙</span><div><div class="dd-label">Вечерний ритуал</div></div></div>
      ${evening.good_for_others?`<div class="rec-block" style="width:100%"><div class="rec-label">Сделал для других</div><div class="rec-text">${esc(evening.good_for_others)}</div></div>`:''}
      ${evening.improve_tomorrow?`<div class="rec-block" style="width:100%"><div class="rec-label">Улучшу завтра</div><div class="rec-text">${esc(evening.improve_tomorrow)}</div></div>`:''}
      ${(evening.beautiful_events||[]).length?`<div class="rec-block" style="width:100%"><div class="rec-label">Прекрасные события</div><ul class="rec-list">${(evening.beautiful_events||[]).map(e=>`<li>${esc(e)}</li>`).join('')}</ul></div>`:''}
    </div>`;
  }

  document.getElementById('day-detail').innerHTML=html;
  openM('m-day');
}

// ═══════════════════════════════════════
//  STATISTICS
// ═══════════════════════════════════════
async function loadStats(){
  const days=[],moodVals=[],taskPcts=[];
  const now=new Date();
  for(let i=6;i>=0;i--){
    const d=new Date(now);d.setDate(d.getDate()-i);
    const ds=d.toISOString().split('T')[0];days.push(ds);
    const ns=await dbGet('mood_notes',{date:ds});
    if(ns.length){const last=ns[ns.length-1];const em=EMOTIONS.find(e=>e.label===last.emotion);moodVals.push(em?em.val:5)}else moodVals.push(null);
    const ts=await dbGet('daily_tasks',{date:ds});
    if(ts.length)taskPcts.push(Math.round(ts.filter(t=>t.completed).length/ts.length*100));else taskPcts.push(null);
  }
  const labels=days.map(ds=>{const d=new Date(ds+'T00:00:00');return['Вс','Пн','Вт','Ср','Чт','Пт','Сб'][d.getDay()]});
  const allNotes=(await dbGet('mood_notes',{})).filter(n=>days.includes(n.date));
  if(allNotes.length){const cnt={};allNotes.forEach(n=>{cnt[n.emotion]=(cnt[n.emotion]||0)+1});const top=Object.entries(cnt).sort((a,b)=>b[1]-a[1])[0];const em=EMOTIONS.find(e=>e.label===top[0]);document.getElementById('stat-emotion').textContent=em?em.emoji:'—'}
  const tValid=taskPcts.filter(v=>v!==null);
  document.getElementById('stat-tasks').textContent=tValid.length?Math.round(tValid.reduce((a,b)=>a+b,0)/tValid.length)+'%':'—';
  mkChart('mood-chart','line',labels,moodVals,'Настроение','#D4A5A5',1,10,v=>({1:'😤',2:'😰',3:'😔',4:'😴',5:'—',6:'🤔',7:'😌',8:'😊',9:'🔥',10:'🔥'}[v]||''));
  mkChart('task-chart','bar',labels,taskPcts,'Выполнено %','#B5D4B5',0,100);
  const wks=JSON.parse(localStorage.getItem('weekly_review')||'[]');const wkLast=wks.slice(-7);
  mkChart('happy-chart','line',wkLast.length?wkLast.map(w=>{const d=new Date(w.week_start+'T00:00:00');return`${d.getDate()}.${d.getMonth()+1}`}):[''],wkLast.length?wkLast.map(w=>w.happiness_score||null):[null],'Счастье','#E8D5A8',1,10);

  let actionsEl=document.getElementById('stats-actions');
  if(!actionsEl){actionsEl=document.createElement('div');actionsEl.id='stats-actions';actionsEl.style.cssText='display:flex;gap:10px;margin-bottom:16px';document.getElementById('tab-stats').appendChild(actionsEl)}
  actionsEl.innerHTML=`<button class="btn btn-outline btn-full" onclick="openM('m-weekly')">📊 Обзор недели</button><button class="btn btn-outline btn-full" onclick="openMonthlyReview()">📅 Обзор месяца</button>`;
}

function openMonthlyReview(){monthlyScores={};renderMonthlyList();openM('m-monthly')}

function mkChart(canvasId,type,labels,data,label,color,yMin,yMax,tickCb){
  const ctx=document.getElementById(canvasId).getContext('2d');
  if(charts[canvasId])charts[canvasId].destroy();
  charts[canvasId]=new Chart(ctx,{type,data:{labels,datasets:[{label,data,borderColor:color,backgroundColor:type==='bar'?color+'99':color+'25',fill:type==='line',tension:0.42,borderWidth:2,pointRadius:4,pointBackgroundColor:color,borderRadius:type==='bar'?7:0,spanGaps:true}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{grid:{color:'#4A4A4A'},ticks:{color:'#A8A8A8',font:{family:'Inter',size:11}}},y:{min:yMin,max:yMax,grid:{color:'#4A4A4A'},ticks:{color:'#A8A8A8',font:{family:'Inter',size:11},...(tickCb?{callback:tickCb,stepSize:1}:{})}}}}});
}

// ═══════════════════════════════════════
//  INIT
// ═══════════════════════════════════════
function init(){
  const loading=document.getElementById('loading');
  try{
    const tg=window.Telegram?.WebApp;
    if(tg){tg.ready();tg.expand();uid=tg.initDataUnsafe?.user?.id?.toString()||'local'}

    loadTasks();loadMorning();loadNotes();

    console.log('hiding loader');
    loading.style.display='none';
    document.getElementById('app').style.display='block';
    renderTasks();renderMood();updateFab();

    const shownToday=lsGet(`mt-shown:${today()}`);
    if(!shownToday){lsSet(`mt-shown:${today()}`,1);setTimeout(()=>openM('m-morning-tasks'),700)}
    checkWeekly();
    checkMonthly();
  }catch(e){
    console.error('init error:',e);
    loading.style.display='none';
    document.getElementById('app').style.display='block';
  }
}

init();
