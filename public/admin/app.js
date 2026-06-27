let TOKEN = localStorage.getItem('vt_token') || '';
let INFO = null;
let CURRENT = null;          // video atual no editor
let DEVICE = 'desktop';
let SAVE_T = null;

const $ = (id) => document.getElementById(id);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

function toast(msg){ const t=$('toast'); t.textContent=msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),2200); }

// ---- helpers de path "a.b.c" ----
function getPath(obj, path){ return path.split('.').reduce((o,k)=>(o==null?o:o[k]), obj); }
function setPath(obj, path, val){ const ks=path.split('.'); const last=ks.pop(); let o=obj; for(const k of ks){ if(o[k]==null)o[k]={}; o=o[k]; } o[last]=val; }

async function api(path, opts={}){
  opts.headers = Object.assign({ 'x-admin-token': TOKEN }, opts.headers||{});
  const res = await fetch(path, opts);
  if(res.status===401){ logout(); throw new Error('unauthorized'); }
  return res;
}

// ================= TEMA do painel =================
function applyTheme(t){ document.documentElement.setAttribute('data-theme', t); localStorage.setItem('vt_theme', t); $('themeToggle') && ($('themeToggle').textContent = t==='dark'?'🌙':'☀️'); }
applyTheme(localStorage.getItem('vt_theme') || 'light');

// ================= AUTH =================
async function login(){
  const res = await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:$('pwd').value})});
  if(!res.ok){ $('loginErr').textContent='Senha incorreta'; return; }
  TOKEN=(await res.json()).token; localStorage.setItem('vt_token',TOKEN); boot();
}
function logout(){ TOKEN=''; localStorage.removeItem('vt_token'); $('app').classList.add('hidden'); $('editor').classList.add('hidden'); $('login').classList.remove('hidden'); }

async function boot(){
  try{
    const res = await api('/api/info'); if(!res.ok) return logout();
    INFO = await res.json();
    $('login').classList.add('hidden'); $('app').classList.remove('hidden'); $('editor').classList.add('hidden');
    $('envTag').textContent = INFO.hasFfmpeg ? 'HLS ativo' : 'MP4 direto';
    loadList();
  }catch{ logout(); }
}

$('themeToggle') && $('themeToggle').addEventListener('click', ()=> applyTheme(document.documentElement.getAttribute('data-theme')==='dark'?'light':'dark'));

// ================= LISTA =================
let VIDEOS = [];
async function loadList(){
  try {
    VIDEOS = await (await api('/api/videos')).json();
    renderList();
  } catch(e){
    const el = $('list');
    if(el) el.innerHTML = '<p class="muted">Erro ao carregar vídeos: '+escapeHtml(e.message||String(e))+'. Recarregue a página (Ctrl+Shift+R).</p>';
  }
}

function renderList(){
  const q = ($('search')?.value || '').toLowerCase();
  const sort = $('sortBy')?.value || 'recent';
  let list = VIDEOS.filter(v => v.title.toLowerCase().includes(q));
  if(sort==='plays') list.sort((a,b)=>(b.plays||0)-(a.plays||0));
  else if(sort==='name') list.sort((a,b)=>a.title.localeCompare(b.title));
  else list.sort((a,b)=>b.created_at-a.created_at);

  const vc = $('vcount'); if(vc) vc.textContent = VIDEOS.length ? VIDEOS.length+' vídeo(s)' : '';
  const el = $('list');
  if(!el) return;
  if(!VIDEOS.length){ el.innerHTML='<p class="muted">Nenhum vídeo ainda. Envie o primeiro acima.</p>'; return; }
  if(!list.length){ el.innerHTML='<p class="muted">Nenhum vídeo encontrado.</p>'; return; }
  const base = (INFO && INFO.publicUrl) ? INFO.publicUrl : '';
  el.innerHTML = list.map(v=>{
    const thumb = v.poster ? `<img src="${base}/media/${v.poster}" alt="">` : '▶';
    return `<div class="vid">
      <div class="thumb">${thumb}</div>
      <div class="meta"><b>${escapeHtml(v.title)}</b><small>${new Date(v.created_at).toLocaleDateString('pt-BR')} · ▶ ${v.plays||0} plays</small></div>
      <span class="pill ${v.status}">${v.status}</span>
      <button class="btn btn-ghost" onclick="openEditor('${v.id}')">Personalizar</button>
      <button class="btn-icon-del" title="Excluir" onclick="deleteFromList('${v.id}','${escapeAttr(v.title)}')">🗑</button>
    </div>`;
  }).join('');
}

// excluir direto da lista (sem entrar no editor)
async function deleteFromList(id, title){
  if(!confirm('Excluir o vídeo "'+title+'"? Não tem volta.')) return;
  try{
    const res = await api('/api/videos/'+id, {method:'DELETE'});
    if(res.ok){ VIDEOS = VIDEOS.filter(v=>v.id!==id); renderList(); toast('Vídeo excluído'); }
    else toast('Erro ao excluir');
  }catch{ toast('Erro ao excluir'); }
}

// ================= UPLOAD =================
async function uploadVideo(){
  const file=$('upFile').files[0];
  if(!file){ toast('Selecione um arquivo'); return; }
  const fd=new FormData(); fd.append('video',file); fd.append('title',$('upTitle').value||file.name);
  $('upBtn').disabled=true; $('upStatus').textContent='Enviando...';
  try{
    const res=await api('/api/videos',{method:'POST',body:fd});
    if(!res.ok) throw 0;
    $('upStatus').textContent = INFO.hasFfmpeg?'Enviado! Convertendo p/ HLS...':'Enviado!';
    $('upTitle').value=''; $('upFile').value=''; loadList();
  }catch{ $('upStatus').textContent='Erro no envio'; }
  finally{ $('upBtn').disabled=false; }
}

// ================= EDITOR =================
async function openEditor(id){
  CURRENT = await (await api('/api/videos/'+id)).json();
  $('app').classList.add('hidden'); $('editor').classList.remove('hidden');
  $('edTitle').textContent = CURRENT.title;
  $('embedCode').textContent = `<script src="${INFO.publicUrl}/e/${CURRENT.id}.js"><\/script>`;
  DEVICE='desktop'; updateDeviceUI();
  renderTemplates();
  bindControls();
  loadPreview();
  loadStats(id);
  switchTab('install');
}

function loadPreview(){
  const f=$('previewFrame');
  f.src = `${INFO.publicUrl}/p/${CURRENT.id}?preview=1`;
  f.onload = ()=> { pushSettings(); const active=document.querySelector('.tab.active'); if(active) switchTab(active.dataset.tab); };
}
function pushSettings(){ const f=$('previewFrame'); f.contentWindow && f.contentWindow.postMessage({type:'settings',settings:CURRENT.settings},'*'); }
// recebe posicao do overlay arrastado
window.addEventListener('message', (ev)=>{
  const d=ev.data||{};
  if(!CURRENT) return;
  if(d.type==='overlayMoved'){
    CURRENT.settings.overlay[d.device] = d.box;
    scheduleSave();
  }
});
function toggleOverlayEdit(on){ const f=$('previewFrame'); f.contentWindow && f.contentWindow.postMessage({type:'editOverlay',on},'*'); }

// ---- Templates de overlay (aplicam cor/texto com 1 clique) ----
const OVERLAY_TEMPLATES = [
  { name:'Verde',    bgColor:'#1f9d6b', textColor:'#ffffff', topText:'Seu vídeo já começou', bottomText:'Clique para ouvir' },
  { name:'Preto',    bgColor:'#111111', textColor:'#ffffff', topText:'Seu vídeo já começou', bottomText:'Clique para ouvir' },
  { name:'Vermelho', bgColor:'#e01e50', textColor:'#ffffff', topText:'Seu vídeo já começou', bottomText:'Clique para ouvir' },
  { name:'Azul',     bgColor:'#2563eb', textColor:'#ffffff', topText:'Seu vídeo já começou', bottomText:'Clique para ouvir' },
  { name:'Branco',   bgColor:'#ffffff', textColor:'#111111', topText:'Seu vídeo já começou', bottomText:'Clique para ouvir' },
  { name:'ES (verde)', bgColor:'#1f9d6b', textColor:'#ffffff', topText:'Tu vídeo ya ha comenzado', bottomText:'Haz clic para escuchar' },
];
function renderTemplates(){
  const el = $('overlayTemplates'); if(!el) return;
  el.innerHTML = OVERLAY_TEMPLATES.map((t,i)=>`
    <button class="tpl" onclick="applyTemplate(${i})" title="${t.name}">
      <span class="tpl-prev" style="background:${t.bgColor};color:${t.textColor}">A̲</span>
      <span class="tpl-name">${t.name}</span>
    </button>`).join('');
}
function applyTemplate(i){
  const t = OVERLAY_TEMPLATES[i];
  ['bgColor','textColor','topText','bottomText'].forEach(k=> setPath(CURRENT.settings, 'overlay.'+k, t[k]));
  bindControls(); pushSettings(); scheduleSave(); toast('Template aplicado');
}

// atualiza labels de valor ao vivo + visibilidade condicional
function refreshDynamicUI(){
  const s = CURRENT.settings;
  const bh = $('barHVal'); if(bh) bh.textContent = (s.progressBar.height||4)+'px';
  const to = $('trackOpVal'); if(to) to.textContent = Math.round((s.progressBar.trackOpacity??0.25)*100)+'%';
  const bo = $('barOptions'); if(bo) bo.style.display = (s.progressBar.style==='hidden') ? 'none' : '';
  const ov = $('ovOpVal'); if(ov) ov.textContent = Math.round((s.overlay.bgOpacity??0.82)*100)+'%';
  const fs = $('ovFsVal'); if(fs) fs.textContent = (s.overlay.fontSize||16);
  // sincroniza slider <-> campo numerico da altura
  const h = s.progressBar.height||4;
  if($('barHRange')) $('barHRange').value = h;
  if($('barHNum')) $('barHNum').value = h;
  // esconde "cor da barra" quando usa cor primaria
  const bcw = $('barColorWrap'); if(bcw) bcw.style.display = s.progressBar.usePlayColor ? 'none' : '';
  // barra smart: mostra intensidade so quando ligada
  const sv = $('smartVal'); if(sv) sv.textContent = (s.progressBar.smartCurve??2.2).toFixed(1);
  const scw = $('smartCurveWrap'); if(scw) scw.style.display = s.progressBar.smart ? '' : 'none';
}

// ---- bind de todos os data-setting ----
function bindControls(){
  // checkboxes / inputs / colors (ignora as divs .seg, tratadas separado abaixo)
  $$('input[data-setting], select[data-setting]').forEach(el=>{
    const path = el.dataset.setting;
    let val = readSettingForControl(path);
    if(el.type==='checkbox') el.checked = !!val;
    else el.value = (val ?? '');
    if(!el._bound){
      el._bound=true;
      const evt = (el.type==='checkbox'||el.type==='color'||el.tagName==='SELECT')?'change':'input';
      el.addEventListener(evt, ()=> writeSettingFromControl(path, el));
    }
  });
  // segment controls
  $$('.seg').forEach(seg=>{
    const path=seg.dataset.setting; const cur=getPath(CURRENT.settings,path);
    seg.querySelectorAll('button').forEach(b=> b.classList.toggle('active', b.dataset.val===cur));
    if(!seg._bound){ seg._bound=true;
      seg.querySelectorAll('button').forEach(b=> b.addEventListener('click',()=>{
        setPath(CURRENT.settings,path,b.dataset.val);
        seg.querySelectorAll('button').forEach(x=>x.classList.remove('active')); b.classList.add('active');
        pushSettings(); scheduleSave(); refreshDynamicUI();
      }));
    }
  });
  refreshDynamicUI();
}

function readSettingForControl(path){
  return getPath(CURRENT.settings, path);
}
function writeSettingFromControl(path, el){
  let val = el.type==='checkbox' ? el.checked : (el.type==='number' ? Number(el.value) : el.value);
  setPath(CURRENT.settings, path, val);
  pushSettings();
  refreshDynamicUI();
  scheduleSave();
}

// salva automatico (debounce) alem do botao Salvar
function scheduleSave(){ clearTimeout(SAVE_T); SAVE_T=setTimeout(saveVideo, 900); }

async function saveVideo(manual){
  if(!CURRENT) return;
  try{
    const res=await api('/api/videos/'+CURRENT.id,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:CURRENT.title,settings:CURRENT.settings})});
    if(res.ok){ CURRENT=await res.json(); if(manual===true) toast('✓ Salvo!'); }
    else { toast('Erro ao salvar (HTTP '+res.status+')'); }
  }catch(e){ toast('Erro ao salvar: '+(e.message||e)); }
}
async function deleteVideo(){
  if(!confirm('Excluir este vídeo? Não tem volta.')) return;
  if((await api('/api/videos/'+CURRENT.id,{method:'DELETE'})).ok){ toast('Excluído'); closeEditor(); }
}
function closeEditor(){ $('previewFrame').src='about:blank'; $('editor').classList.add('hidden'); $('app').classList.remove('hidden'); loadList(); }

// ---- device toggle ----
function setDevice(d){ DEVICE=d; updateDeviceUI(); bindControls();
  $('previewFrame').contentWindow && $('previewFrame').contentWindow.postMessage({type:'device',device:d},'*'); }
function updateDeviceUI(){
  $('frameWrap').classList.toggle('mobile', DEVICE==='mobile');
  $('devDesktop').classList.toggle('active', DEVICE==='desktop');
  $('devMobile').classList.toggle('active', DEVICE==='mobile');
}

// ---- tabs ----
$$('.tab').forEach(t=> t.addEventListener('click', ()=> switchTab(t.dataset.tab)));
function switchTab(name){
  $$('.tab').forEach(t=>t.classList.toggle('active', t.dataset.tab===name));
  $$('.tabpane').forEach(p=>p.classList.toggle('hidden', p.dataset.pane!==name));
  // garante que o preview tem as settings atuais ANTES de ligar/desligar edicao
  pushSettings();
  toggleOverlayEdit(name==='overlay');
}

async function loadStats(id){
  try{ const s=await (await api(`/api/videos/${id}/stats`)).json();
    $('stats').innerHTML = `▶️ Plays: <b>${s.plays}</b><br>✅ Completaram: <b>${s.ended}</b> (${s.completionRate}%)`;
  }catch{ $('stats').textContent='—'; }
}

function copyEmbed(){ navigator.clipboard.writeText($('embedCode').textContent).then(()=>toast('Código copiado!')); }
function escapeHtml(s){ return String(s).replace(/[<>&"]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c])); }
function escapeAttr(s){ return String(s).replace(/['"\\]/g,'').replace(/[<>&]/g,''); }

if(TOKEN) boot();
