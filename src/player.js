// Gera o HTML do player premium (estilo VTurb) e o script de embed de 1 linha.

function esc(s) {
  return String(s).replace(/[<>&"']/g, (c) => (
    { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

/**
 * HTML completo do player premium, servido em /p/:id e embutido via iframe.
 * Aceita ?preview=1 para o editor ao vivo (desativa autoplay forcado e
 * escuta postMessage para atualizar settings em tempo real).
 */
export function renderPlayerHtml(video, publicUrl) {
  const s = video.settings;
  const hlsSrc = video.hls_path ? `${publicUrl}/media/${video.hls_path}` : null;
  const mp4Src = `${publicUrl}/raw/${video.id}`;

  const cfg = {
    id: video.id,
    track: `${publicUrl}/t`,
    hls: hlsSrc,
    mp4: mp4Src,
    settings: s,
  };

  return `<!doctype html>
<html lang="pt-br" data-theme="${esc(s.theme)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(video.title)}</title>
<style>${PLAYER_CSS}</style>
</head>
<body>
  <div id="stage">
    <video id="v" playsinline webkit-playsinline preload="metadata"></video>

    <!-- Loading circular (anel + % no meio) enquanto o video carrega -->
    <div id="loading" class="loading">
      <div class="ring">
        <svg viewBox="0 0 100 100">
          <circle class="ring-bg" cx="50" cy="50" r="42"/>
          <circle class="ring-fg" cx="50" cy="50" r="42"/>
        </svg>
        <span id="loadPct" class="load-pct">0%</span>
      </div>
    </div>

    <!-- Tela "Continuar / Recomecar" (aparece ao voltar tendo assistido 100% ou ao terminar) -->
    <div id="resume" class="resume">
      <div class="resume-box">
        <p class="resume-title">Você já começou a assistir esse vídeo</p>
        <button id="resumeContinue" class="resume-btn">
          <span class="resume-ic"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></span>
          <span>Continuar assistindo?</span>
        </button>
        <button id="resumeRestart" class="resume-btn">
          <span class="resume-ic"><svg viewBox="0 0 24 24"><path d="M12 5V1L7 6l5 5V7a6 6 0 1 1-6 6H4a8 8 0 1 0 8-8z"/></svg></span>
          <span>Assistir do início?</span>
        </button>
      </div>
    </div>

    <!-- Overlay de unmute (caixa editavel arrastavel/redimensionavel) -->
    <div id="bigplay" class="bigplay">
      <div id="obox" class="obox">
        <span id="oTop" class="o-top"></span>
        <div class="o-ic" id="oIc"></div>
        <span id="oBot" class="o-bot"></span>
        <!-- handles de redimensionamento (so no modo edicao) -->
        <i class="oh oh-nw" data-h="nw"></i><i class="oh oh-n" data-h="n"></i><i class="oh oh-ne" data-h="ne"></i>
        <i class="oh oh-e" data-h="e"></i><i class="oh oh-se" data-h="se"></i><i class="oh oh-s" data-h="s"></i>
        <i class="oh oh-sw" data-h="sw"></i><i class="oh oh-w" data-h="w"></i>
      </div>
    </div>

    <!-- Play pequeno no canto (estilo VTurb, aparece quando pausado) -->
    <button id="cornerPlay" class="corner-play" aria-label="Reproduzir">
      <svg class="i-play" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
      <svg class="i-pause" viewBox="0 0 24 24"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>
    </button>

    <!-- Barra de controles -->
    <div id="controls" class="controls">
      <div id="track" class="track">
        <div class="track-bg"></div>
        <div id="buffered" class="track-buffered"></div>
        <div id="played" class="track-played"></div>
        <div id="handle" class="handle"></div>
        <div id="tip" class="tip">00:00</div>
      </div>
      <div class="bottom">
        <button id="btnPlay" class="ctl" aria-label="Play/Pause">
          <svg class="i-play" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
          <svg class="i-pause" viewBox="0 0 24 24"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>
        </button>
        <div id="volWrap" class="ctl-vol">
          <button id="btnMute" class="ctl" aria-label="Volume">
            <svg class="i-vol" viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4z"/></svg>
            <svg class="i-muted" viewBox="0 0 24 24"><path d="M16.5 12a4.5 4.5 0 0 0-2.5-4v2.2l2.4 2.4c.07-.2.1-.4.1-.6zM3 9v6h4l5 5v-6.6L6.4 9H3zm16.7 9.3 1.3-1.3L4.3 0 3 1.3 7.7 6H7v.7L19.7 18.3z"/></svg>
          </button>
          <input id="vol" class="vol-slider" type="range" min="0" max="1" step="0.05" value="1">
        </div>
        <span id="time" class="time">00:00 / 00:00</span>
        <div class="spacer"></div>
        <button id="btnSpeed" class="ctl ctl-text" aria-label="Velocidade">1x</button>
        <button id="btnFs" class="ctl" aria-label="Tela cheia">
          <svg viewBox="0 0 24 24"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>
        </button>
      </div>
    </div>
  </div>
<script>${PLAYER_JS.replace('__CFG__', JSON.stringify(cfg))}</script>
${video.hls_path ? '<script src="https://cdn.jsdelivr.net/npm/hls.js@1"></script>' : ''}
</body>
</html>`;
}

// ====================================================================
//  CSS DO PLAYER (premium, dark/light)
// ====================================================================
const PLAYER_CSS = `
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:100%;height:100%;background:#000;overflow:hidden;font-family:system-ui,-apple-system,Segoe UI,Arial,sans-serif}
#stage{position:relative;width:100%;height:100vh;background:#000;cursor:pointer}
video{width:100%;height:100%;object-fit:contain;background:#000;display:block}

/* ---- Tema ---- */
html[data-theme="dark"]{--ctl-bg:rgba(15,16,22,.78);--ctl-fg:#fff;--track-bg:rgba(255,255,255,.25);--track-buf:rgba(255,255,255,.45)}
html[data-theme="light"]{--ctl-bg:rgba(255,255,255,.88);--ctl-fg:#10131a;--track-bg:rgba(0,0,0,.18);--track-buf:rgba(0,0,0,.32)}

/* ---- Overlay de unmute (caixa editavel) ---- */
.bigplay{position:absolute;inset:0;display:none;z-index:5;cursor:pointer}
.bigplay.show{display:block}
.obox{position:absolute;display:flex;flex-direction:column;align-items:center;justify-content:space-between;
  text-align:center;padding:4% 5%;gap:4%;border-radius:10px;box-sizing:border-box;overflow:hidden;
  left:24%;top:20%;width:52%;height:60%;transition:none;
  container-type:size}
.bigplay.pulse .obox{animation:opulse 1.6s ease-in-out infinite}
@keyframes opulse{0%,100%{transform:scale(1)}50%{transform:scale(1.04)}}
/* fonte escala pelo tamanho da CAIXA; --ov-fs e sobrescrito pelo JS via applyVisual */
.o-top,.o-bot{font-weight:800;line-height:1.1;width:100%;text-shadow:0 2px 6px rgba(0,0,0,.25);
  font-size:var(--ov-fs,16px);overflow:hidden;text-overflow:ellipsis;flex:none}
.o-ic{flex:1 1 auto;min-height:24px;display:flex;align-items:center;justify-content:center;width:100%}
.o-ic:empty{display:none}
.o-ic svg{height:min(100%,30cqh);max-height:170px;width:auto;max-width:70%;fill:currentColor;filter:drop-shadow(0 4px 14px rgba(0,0,0,.35))}
/* 3 ondas de som aparecendo em sequencia */
.o-ic .wave{opacity:0;animation:waveSeq 2.1s ease-in-out infinite}
.o-ic .w1{animation-delay:.0s}
.o-ic .w2{animation-delay:.35s}
.o-ic .w3{animation-delay:.7s}
@keyframes waveSeq{0%{opacity:0}25%{opacity:1}55%{opacity:1}80%,100%{opacity:0}}
/* handles (so aparecem em modo edicao) */
.oh{position:absolute;width:12px;height:12px;background:#3b82f6;border:2px solid #fff;border-radius:50%;display:none;z-index:2;box-shadow:0 1px 4px rgba(0,0,0,.4)}
.obox.editing{outline:1.5px solid #3b82f6;cursor:move}
.obox.editing .oh{display:block}
.oh-nw{left:-7px;top:-7px;cursor:nwse-resize}.oh-n{left:calc(50% - 6px);top:-7px;cursor:ns-resize}
.oh-ne{right:-7px;top:-7px;cursor:nesw-resize}.oh-e{right:-7px;top:calc(50% - 6px);cursor:ew-resize}
.oh-se{right:-7px;bottom:-7px;cursor:nwse-resize}.oh-s{left:calc(50% - 6px);bottom:-7px;cursor:ns-resize}
.oh-sw{left:-7px;bottom:-7px;cursor:nesw-resize}.oh-w{left:-7px;top:calc(50% - 6px);cursor:ew-resize}

/* ---- Tela "Continuar / Recomecar" ---- */
.resume{position:absolute;inset:0;z-index:10;display:none;align-items:center;justify-content:center;
  background:rgba(0,0,0,.35);padding:5%}
.resume.show{display:flex}
.resume-box{background:var(--pri);color:#fff;border-radius:12px;padding:7% 8%;text-align:center;
  width:min(92%,520px);box-shadow:0 16px 50px rgba(0,0,0,.4)}
.resume-title{font-size:clamp(16px,2.6vw,22px);font-weight:800;margin:0 0 6%;line-height:1.25}
.resume-btn{display:flex;align-items:center;gap:14px;width:100%;background:transparent;border:0;cursor:pointer;
  color:#fff;font-size:clamp(14px,2vw,18px);font-weight:700;padding:10px 4px;text-align:left}
.resume-btn+.resume-btn{margin-top:6px}
.resume-ic{flex:none;width:44px;height:44px;border-radius:50%;border:2.5px solid rgba(255,255,255,.9);
  display:flex;align-items:center;justify-content:center;transition:background .15s}
.resume-btn:hover .resume-ic{background:rgba(255,255,255,.18)}
.resume-ic svg{width:22px;height:22px;fill:#fff}

/* ---- Loading circular (anel vermelho + %) ---- */
.loading{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;z-index:9;background:#000;transition:opacity .4s}
.loading.done{opacity:0;pointer-events:none}
.ring{position:relative;width:clamp(80px,18%,130px);aspect-ratio:1}
.ring svg{width:100%;height:100%;transform:rotate(-90deg)}
.ring-bg{fill:none;stroke:rgba(255,255,255,.12);stroke-width:6}
.ring-fg{fill:none;stroke:#e01212;stroke-width:6;stroke-linecap:round;
  stroke-dasharray:264;stroke-dashoffset:264;
  filter:drop-shadow(0 0 6px rgba(224,18,18,.6))}
.load-pct{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
  color:#fff;font-weight:800;font-size:clamp(13px,3.5cqi,20px)}

/* ---- Play pequeno no canto inferior esquerdo (estilo VTurb) ---- */
.corner-play{position:absolute;left:14px;bottom:14px;z-index:7;width:42px;height:42px;border-radius:50%;
  border:0;cursor:pointer;background:rgba(0,0,0,.55);color:#fff;display:none;align-items:center;justify-content:center;
  transition:background .15s,transform .15s;backdrop-filter:blur(2px)}
.corner-play:hover{background:rgba(0,0,0,.75);transform:scale(1.08)}
.corner-play svg{width:22px;height:22px;fill:#fff}
.corner-play .i-play{margin-left:2px}.corner-play .i-pause{display:none}
.corner-play.on{display:flex}
#stage.playing .corner-play .i-play{display:none}
#stage.playing .corner-play .i-pause{display:block}

/* ---- Controles ---- */
.controls{position:absolute;left:0;right:0;bottom:0;padding:8px 14px 12px;z-index:6;
  background:linear-gradient(transparent,rgba(0,0,0,.55));opacity:1;transition:opacity .3s}
html[data-theme="light"] .controls{background:linear-gradient(transparent,rgba(0,0,0,.18))}
/* auto-hide esconde so os BOTOES, nunca a barra de progresso */
.controls.hidden .bottom{opacity:0;pointer-events:none;transition:opacity .3s}
.controls.off{display:none}
/* durante a previa mudo, esconde a barra/controles inteiros */
.controls.preview-hidden{display:none}
.track{transition:none}
/* modo VSL: esconde os botoes, mantem so a barra de progresso colada na base */
.controls.minimal{background:none;padding:0}
.controls.minimal .bottom{display:none}
.controls.minimal .track{margin:0;position:absolute;left:0;right:0;bottom:0;height:auto;align-items:flex-end}
/* barra ponta a ponta, sem cantos arredondados quando colada na base */
.controls.minimal .track-bg,.controls.minimal .track-buffered,.controls.minimal .track-played{border-radius:0;position:relative}
.controls.minimal .track-bg{position:absolute;left:0;right:0;bottom:0}
.controls.minimal .track-buffered,.controls.minimal .track-played{position:absolute;left:0;bottom:0}

/* barra de progresso (altura/cor/opacidade controladas por --bar-h, --track-c) */
.track{position:relative;height:18px;display:flex;align-items:center;cursor:pointer;margin-bottom:4px;--bar-h:4px}
.track-bg{position:absolute;left:0;right:0;height:var(--bar-h);border-radius:99px;background:var(--track-c,var(--track-bg));transition:height .12s}
.track-buffered{position:absolute;left:0;height:var(--bar-h);border-radius:99px;background:var(--track-buf);width:0;opacity:.5}
.track-played{position:absolute;left:0;height:var(--bar-h);border-radius:99px;background:var(--bar-fill,var(--pri));width:0}
.track.grow:hover .track-bg,.track.grow:hover .track-buffered,.track.grow:hover .track-played{height:calc(var(--bar-h) + 2px)}
.handle{position:absolute;width:14px;height:14px;border-radius:50%;background:var(--bar-fill,var(--pri));
  box-shadow:0 0 0 4px rgba(255,255,255,.2);left:0;transform:translateX(-50%) scale(0);transition:transform .12s;pointer-events:none}
.track.has-handle:hover .handle{transform:translateX(-50%) scale(1)}
.tip{position:absolute;bottom:calc(var(--bar-h) + 14px);transform:translateX(-50%);background:#000;color:#fff;
  font-size:11px;padding:3px 7px;border-radius:4px;display:none;white-space:nowrap;pointer-events:none}
.track:hover .tip{display:block}

/* barra grossa gradiente (variacao) */
.track.thick .track-played{background:linear-gradient(90deg,var(--bar-fill,var(--pri)),rgba(255,255,255,.2))}

.bottom{display:flex;align-items:center;gap:6px;color:var(--ctl-fg)}
.ctl{background:transparent;border:0;cursor:pointer;padding:6px;border-radius:6px;display:flex;align-items:center;color:var(--ctl-fg);transition:background .15s}
.ctl:hover{background:rgba(127,127,127,.25)}
.ctl svg{width:22px;height:22px;fill:currentColor}
.ctl-text{font-size:13px;font-weight:700;min-width:34px;justify-content:center}
.i-pause,.i-muted{display:none}
#stage.playing .i-play{display:none}
#stage.playing .i-pause{display:block}
#stage.muted .i-vol{display:none}
#stage.muted .i-muted{display:block}
.time{font-size:12px;font-variant-numeric:tabular-nums;opacity:.95;padding:0 4px}
.spacer{flex:1}
.ctl-vol{display:flex;align-items:center}
.vol-slider{width:0;opacity:0;transition:width .2s,opacity .2s;accent-color:var(--pri);cursor:pointer}
.ctl-vol:hover .vol-slider{width:70px;opacity:1;margin-left:4px}

`;

// ====================================================================
//  JS DO PLAYER
// ====================================================================
const PLAYER_JS = `
(function(){
  var CFG = __CFG__;
  // Icone animado: camera de video + 3 ondas de som que aparecem em sequencia + risco diagonal
  var ICON_VIDEO_WAVES = '<svg viewBox="0 0 64 48" class="ic-anim">'
    + '<rect x="6" y="15" width="26" height="18" rx="3" fill="currentColor"/>'
    + '<path d="M34 21 L44 15 L44 33 L34 27 Z" fill="currentColor"/>'
    + '<path class="wave w1" d="M48 19 a8 8 0 0 1 0 10" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>'
    + '<path class="wave w2" d="M51 15 a13 13 0 0 1 0 18" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>'
    + '<path class="wave w3" d="M54 11 a18 18 0 0 1 0 26" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>'
    + '<line class="ic-slash" x1="8" y1="9" x2="58" y2="41" stroke="currentColor" stroke-width="3.4" stroke-linecap="round"/>'
    + '</svg>';
  var OVERLAY_ICONS = {
    'video-muted': ICON_VIDEO_WAVES,
    'sound-muted': '<svg viewBox="0 0 24 24"><path d="M16.5 12a4.5 4.5 0 0 0-2.5-4v2.2l2.4 2.4c.07-.2.1-.4.1-.6zM3 9v6h4l5 5V4L7 9H3zm16.7 9.3 1.3-1.3L4.3 0 3 1.3 7.7 6H7v.7L19.7 18.3z"/></svg>',
    'play': '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>',
    'none': ''
  };
  var S = CFG.settings;
  var qs = new URLSearchParams(location.search);
  var PREVIEW = qs.get('preview') === '1';

  var stage = document.getElementById('stage');
  var v = document.getElementById('v');
  var big = document.getElementById('bigplay');
  var controls = document.getElementById('controls');
  var session = Math.random().toString(36).slice(2);
  var tracked = {};

  document.documentElement.style.setProperty('--pri', S.primaryColor);

  function track(type, position){
    if(PREVIEW) return;
    try{ navigator.sendBeacon(CFG.track, new Blob([JSON.stringify(
      {videoId:CFG.id,type:type,position:position||v.currentTime||0,session:session})],{type:'application/json'})); }catch(e){}
  }
  function fmt(t){ t=Math.max(0,t||0); var m=Math.floor(t/60),s=Math.floor(t%60); return (m<10?'0':'')+m+':'+(s<10?'0':'')+s; }
  function hexToRgba(hex,a){ var h=String(hex).replace('#',''); if(h.length===3) h=h.replace(/./g,'$&$&');
    var n=parseInt(h,16); return 'rgba('+((n>>16)&255)+','+((n>>8)&255)+','+(n&255)+','+a+')'; }
  // Barra de progresso SMART (estilo VTurb): a barra anda um pouco mais rapido no
  // inicio e desacelera suavemente perto do fim. O efeito e SUTIL (nao um salto).
  // 'intensity' (0..1, derivado de smartCurve) controla o quanto desvia do linear.
  // Usamos uma mistura entre linear e ease-out suave -> aceleracao gradual, sem pulo.
  function smartProgress(real, curve){
    real = Math.max(0, Math.min(1, real || 0));
    var c = curve || 2; // 1 = linear; maior = efeito mais perceptivel
    if(c <= 1.01) return real;
    // ease-out: rapido no inicio, desacelera no fim. Expoente cresce com a intensidade.
    // c=2 -> exp 1.9 (efeito claro mas natural); c=4 -> exp ~3.3 (bem marcado)
    var exp = 1 + (c - 1) * 0.75;
    return 1 - Math.pow(1 - real, exp);
  }

  // ---------- aplica settings visuais ----------
  function applyVisual(){
    document.documentElement.setAttribute('data-theme', S.theme);
    document.documentElement.style.setProperty('--pri', S.primaryColor);
    // overlay de unmute (caixa)
    var ov = S.overlay, obox = document.getElementById('obox');
    var wasShow = big.classList.contains('show'), wasEdit = obox.classList.contains('editing');
    big.className = 'bigplay' + (wasShow?' show':'') + (ov.pulse?' pulse':'');
    if(wasEdit) obox.classList.add('editing');
    document.getElementById('oTop').textContent = ov.topText || '';
    document.getElementById('oBot').textContent = ov.bottomText || '';
    var oIc = document.getElementById('oIc');
    // so recria o SVG quando o icone MUDA (evita resetar a animacao das ondas a cada update)
    if(oIc._icon !== ov.icon){
      oIc._icon = ov.icon;
      oIc.innerHTML = OVERLAY_ICONS[ov.icon] != null ? OVERLAY_ICONS[ov.icon] : OVERLAY_ICONS['video-muted'];
    }
    obox.style.color = ov.textColor;
    obox.style.background = hexToRgba(ov.bgColor||'#1f9d6b', ov.bgOpacity==null?0.82:ov.bgOpacity);
    obox.style.setProperty('--ov-fs', (ov.fontSize||16)+'px');
    var op = isMobile() ? ov.mobile : ov.desktop;
    obox.style.left = op.x+'%'; obox.style.top = op.y+'%';
    obox.style.width = op.w+'%'; obox.style.height = op.h+'%';
    // barra
    var track = document.getElementById('track');
    var pb = S.progressBar;
    track.classList.toggle('thick', pb.style==='thick-gradient');
    track.classList.toggle('grow', pb.hoverGrow !== false);
    track.classList.toggle('has-handle', pb.showHandle !== false);
    track.style.setProperty('--bar-h', (pb.height||4) + 'px');
    // cor da barra PREENCHIDA (assistida)
    var fill = pb.usePlayColor ? S.primaryColor : (pb.barColor || S.primaryColor);
    track.style.setProperty('--bar-fill', fill);
    // cor + opacidade do TRILHO (parte nao assistida)
    var tc = hexToRgba(pb.trackColor||'#ffffff', pb.trackOpacity==null?0.25:pb.trackOpacity);
    track.style.setProperty('--track-c', tc);
    // modo VSL minimal: esconde botoes, mantem so a barra; play vai pro canto
    controls.classList.toggle('minimal', !!S.controls.minimal);
    document.getElementById('cornerPlay').classList.toggle('on', !!S.controls.minimal);
    controls.classList.toggle('off', pb.style==='hidden' && (S.controls.minimal || !anyControl()));
    // controles individuais
    document.getElementById('btnSpeed').style.display = S.controls.speed?'':'none';
    document.getElementById('btnFs').style.display = S.controls.fullscreen?'':'none';
    document.getElementById('volWrap').style.display = S.controls.volume?'':'none';
    document.getElementById('time').style.display = S.controls.timeDisplay?'':'none';
    document.getElementById('track').style.display = S.progressBar.style==='hidden'?'none':'';
  }
  function anyControl(){ return S.controls.speed||S.controls.fullscreen||S.controls.volume||S.controls.timeDisplay; }

  // usa largura do stage (iframe), nao da janela, pra detectar mobile corretamente
  function isMobile(){ return stage.offsetWidth < 640; }

  // ---------- fonte (streaming normal: video carrega conforme assiste) ----------
  function loadSource(){
    if(CFG.hls && v.canPlayType('application/vnd.apple.mpegurl')){ v.src=CFG.hls; return; }
    if(CFG.hls && window.Hls && window.Hls.isSupported()){ var h=new Hls(); h.loadSource(CFG.hls); h.attachMedia(v); return; }
    v.src = CFG.mp4;
  }

  // ---------- autoplay smart ----------
  var inPreview = false; // true enquanto a previa mudo no fundo esta rolando
  function start(){
    if(S.startMuted) v.muted = true;
    if(S.loop) v.loop = true;
    updateMuteUI();

    // MODO PREVIA: video roda MUDO no fundo (loop), caixa por cima.
    // Funciona TAMBEM no editor (PREVIEW) pra ficar igual ao site.
    // Ao clicar pra ouvir, reinicia do 0:00 com som.
    if(S.previewMode){
      inPreview = true;
      v.muted = true; v.loop = true;
      updateMuteUI();
      controls.classList.add('preview-hidden'); // esconde a barra durante a previa
      if(S.showUnmuteButton) showBig();          // mostra a caixa "clique para ouvir"
      var pp = v.play();
      if(pp&&pp.catch) pp.catch(function(){});
      // garante que a caixa fique visivel mesmo apos o play disparar
      setTimeout(function(){ if(inPreview && S.showUnmuteButton) showBig(); }, 50);
      return;
    }

    if(PREVIEW){ showBig(); return; }      // no editor nao forca play (sem previewMode)

    if(!S.autoplay){ showBig(); return; }
    var p = v.play();
    if(p&&p.catch){ p.then(function(){ if(v.muted&&S.showUnmuteButton) showBig(); })
      .catch(function(){ if(S.showUnmuteButton) showBig(); }); }
  }
  function showBig(){ applyVisual(); big.classList.add('show'); }
  function hideBig(){ big.classList.remove('show'); }

  function doUnmute(){
    if(inPreview){
      // sai da previa: reinicia do comeco, tira loop, liga som, mostra a barra
      inPreview = false;
      v.loop = !!S.loop;
      try{ v.currentTime = 0; }catch(e){}
      maxT = 0;
      controls.classList.remove('preview-hidden');
    }
    v.muted = false;
    updateMuteUI();
    hideBig();
    var p = v.play();
    if(p && p.catch) p.catch(function(){});
  }
  big.addEventListener('click', function(e){
    if(document.getElementById('obox').classList.contains('editing')) return; // editor: nao fecha
    e.preventDefault(); e.stopPropagation();
    doUnmute();
  });
  // Detectar interacao: qualquer clique/tecla/scroll na pagina libera o som
  if(S.detectInteraction && !PREVIEW){
    var onInteract = function(){
      if(big.classList.contains('show')){ doUnmute(); }
      window.removeEventListener('pointerdown', onInteract);
      window.removeEventListener('keydown', onInteract);
      window.removeEventListener('scroll', onInteract);
    };
    window.addEventListener('pointerdown', onInteract);
    window.addEventListener('keydown', onInteract);
    window.addEventListener('scroll', onInteract, {passive:true});
  }

  // ---------- play/pause ----------
  function toggle(){ if(v.paused){ v.play(); } else { v.pause(); } }
  document.getElementById('btnPlay').addEventListener('click', function(e){ e.stopPropagation(); toggle(); });
  document.getElementById('cornerPlay').addEventListener('click', function(e){ e.stopPropagation(); toggle(); });
  stage.addEventListener('click', function(e){
    if(e.target.closest('.controls')||e.target.closest('.bigplay')) return;
    // nunca pausa durante a previa ou com a caixa visivel
    if(inPreview || big.classList.contains('show')) return;
    if(S.controls.clickToPause) toggle();
  });
  v.addEventListener('play', function(){
    stage.classList.add('playing');
    if(!inPreview) hideBig();   // na previa, mantem a caixa "clique para ouvir" visivel
    if(!inPreview && !tracked.play){ tracked.play=1; track('play'); }
  });
  v.addEventListener('pause', function(){ stage.classList.remove('playing'); });
  v.addEventListener('ended', function(){ track('ended'); });

  // ---------- mute / volume ----------
  function updateMuteUI(){ stage.classList.toggle('muted', v.muted||v.volume===0); }
  document.getElementById('btnMute').addEventListener('click', function(e){ e.stopPropagation(); v.muted=!v.muted; updateMuteUI(); });
  document.getElementById('vol').addEventListener('input', function(e){ v.volume=parseFloat(e.target.value); v.muted=v.volume===0; updateMuteUI(); });

  // ---------- velocidade ----------
  var speeds=[1,1.5,2], si=0;
  document.getElementById('btnSpeed').addEventListener('click', function(e){ e.stopPropagation(); si=(si+1)%speeds.length; v.playbackRate=speeds[si]; e.target.textContent=speeds[si]+'x'; });

  // ---------- fullscreen ----------
  document.getElementById('btnFs').addEventListener('click', function(e){ e.stopPropagation();
    if(document.fullscreenElement){ document.exitFullscreen(); } else { stage.requestFullscreen&&stage.requestFullscreen(); } });

  // ---------- barra de progresso ----------
  var track=document.getElementById('track'), played=document.getElementById('played'),
      buffered=document.getElementById('buffered'), handle=document.getElementById('handle'), tip=document.getElementById('tip');
  var maxT=0;
  function pct(e){ var r=track.getBoundingClientRect(); return Math.min(1,Math.max(0,(e.clientX-r.left)/r.width)); }
  track.addEventListener('mousemove', function(e){ var p=pct(e); tip.style.left=(p*100)+'%'; tip.textContent=fmt(p*(v.duration||0)); });
  track.addEventListener('click', function(e){
    if(!S.allowSeek){ var p=pct(e); if(p*(v.duration||0) <= maxT+0.5){ v.currentTime=p*v.duration; } return; }
    v.currentTime = pct(e)*(v.duration||0);
  });
  v.addEventListener('timeupdate', function(){
    var t=v.currentTime, d=v.duration||0;
    maxT=Math.max(maxT,t);
    if(!S.allowSeek && t>maxT+0.6){ v.currentTime=maxT; }
    if(S.controls.timeDisplay) document.getElementById('time').textContent=fmt(t)+' / '+fmt(d);
    // progress buckets (tracking sempre pelo tempo real)
    var realP = d?(t/d):0;
    if(d){ var b=Math.floor(realP*10); if(!tracked['p'+b]){tracked['p'+b]=1;track('progress',t);} }
  });

  // ---------- Animacao SUAVE da barra (requestAnimationFrame ~60fps) ----------
  // Em vez de depender do timeupdate (esporadico, causa "pulos"), atualizamos a
  // barra todo frame, interpolando suavemente ate o valor alvo.
  var shownP = 0; // progresso visual atualmente exibido (0-1)
  function rafLoop(){
    var d = v.duration||0;
    var realP = d ? (v.currentTime/d) : 0;
    var targetP = S.progressBar.smart ? smartProgress(realP, S.progressBar.smartCurve) : realP;
    // interpola suavemente em direcao ao alvo (lerp) -> elimina os saltos
    shownP += (targetP - shownP) * 0.18;
    if(Math.abs(targetP - shownP) < 0.0005) shownP = targetP;
    var w = (shownP*100);
    played.style.width = w+'%';
    handle.style.left = w+'%';
    requestAnimationFrame(rafLoop);
  }
  requestAnimationFrame(rafLoop);
  // ao pular/reiniciar, salta direto pro ponto certo (sem animar de volta)
  v.addEventListener('seeked', function(){ var d=v.duration||0; var rp=d?(v.currentTime/d):0; shownP = S.progressBar.smart?smartProgress(rp,S.progressBar.smartCurve):rp; });
  v.addEventListener('progress', function(){ try{ if(v.buffered.length){ buffered.style.width=((v.buffered.end(v.buffered.length-1)/(v.duration||1))*100)+'%'; } }catch(e){} });

  // ---------- auto-hide controles ----------
  var hideTimer;
  function poke(){ controls.classList.remove('hidden'); clearTimeout(hideTimer);
    if(S.controls.autoHide && !v.paused) hideTimer=setTimeout(function(){ controls.classList.add('hidden'); },2600); }
  stage.addEventListener('mousemove', poke); stage.addEventListener('touchstart', poke);

  // ================= PREVIEW / EDITOR AO VIVO =================
  if(PREVIEW){
    document.body.style.cursor='default';
    var obox = document.getElementById('obox');
    function dev(){ return isMobile()?'mobile':'desktop'; }

    // recebe comandos do painel
    window.addEventListener('message', function(ev){
      var d=ev.data||{};
      if(d.type==='settings'){
        var wasPreviewMode = S.previewMode;
        S=d.settings; document.documentElement.style.setProperty('--pri',S.primaryColor); applyVisual(); poke();
        // ligou/desligou a previa no painel -> reflete no preview ao vivo
        if(S.previewMode && !inPreview){ inPreview=true; v.muted=true; v.loop=true; updateMuteUI(); var pp=v.play(); if(pp&&pp.catch)pp.catch(function(){}); if(S.showUnmuteButton) showBig(); }
        else if(!S.previewMode && wasPreviewMode){ inPreview=false; v.pause(); try{v.currentTime=0;}catch(e){} v.loop=!!S.loop; }
      }
      if(d.type==='editOverlay'){ enterOverlayEdit(d.on); }
      if(d.type==='device'){ applyVisual(); }
    });

    // ----- OVERLAY: arrastar + redimensionar pelos handles -----
    function enterOverlayEdit(on){ if(on){ big.classList.add('show'); obox.classList.add('editing'); } else { obox.classList.remove('editing'); if(!PREVIEW) big.classList.remove('show'); } }
    var ovMode=null, ovStart=null;  // ovMode: 'move' ou handle 'nw','se'...
    function pct(e){ var r=stage.getBoundingClientRect(); return {x:((e.clientX-r.left)/r.width)*100, y:((e.clientY-r.top)/r.height)*100}; }
    obox.addEventListener('mousedown', function(e){
      if(!obox.classList.contains('editing'))return;
      e.preventDefault(); e.stopPropagation();
      var h=e.target.getAttribute('data-h');
      var o=S.overlay[dev()];
      ovMode = h || 'move';
      ovStart = { p:pct(e), o:{x:o.x,y:o.y,w:o.w,h:o.h} };
    });
    window.addEventListener('mousemove', function(e){
      if(!ovMode)return;
      var p=pct(e), o=ovStart.o, dx=p.x-ovStart.p.x, dy=p.y-ovStart.p.y;
      var n={x:o.x,y:o.y,w:o.w,h:o.h};
      if(ovMode==='move'){ n.x=o.x+dx; n.y=o.y+dy; }
      else {
        if(ovMode.indexOf('e')>=0){ n.w=o.w+dx; n.x=o.x+dx/2; }
        if(ovMode.indexOf('w')>=0){ n.w=o.w-dx; n.x=o.x+dx/2; }
        if(ovMode.indexOf('s')>=0){ n.h=o.h+dy; n.y=o.y+dy/2; }
        if(ovMode.indexOf('n')>=0){ n.h=o.h-dy; n.y=o.y+dy/2; }
      }
      n.w=Math.max(15,Math.min(100,n.w)); n.h=Math.max(15,Math.min(100,n.h));
      n.x=Math.max(0,Math.min(100,n.x)); n.y=Math.max(0,Math.min(100,n.y));
      obox.style.left=n.x+'%'; obox.style.top=n.y+'%'; obox.style.width=n.w+'%'; obox.style.height=n.h+'%';
      S.overlay[dev()]={x:n.x,y:n.y,w:n.w,h:n.h};
      parent.postMessage({type:'overlayMoved',device:dev(),box:{x:Math.round(n.x),y:Math.round(n.y),w:Math.round(n.w),h:Math.round(n.h)}},'*');
    });

    window.addEventListener('mouseup', function(){ ovMode=null; });
  }

  // ---------- Loading TEMPORAL (UMA vez, definitivo) ----------
  // Baseado em TEMPO DECORRIDO (performance.now). Vai de 0 a 100% em ~6 segundos.
  // Como depende so do relogio (que so avanca) e trava com loadDone, e
  // MATEMATICAMENTE IMPOSSIVEL voltar atras ou repetir.
  var loadEl = document.getElementById('loading');
  var loadPctEl = document.getElementById('loadPct');
  var ringFg = document.querySelector('.ring-fg');
  var DASH = 264; // deve bater com stroke-dasharray no CSS
  var loadDone = false, playerStarted = false, loadRaf = null;
  var LOAD_MS = 6000; // duracao fixa do loading
  var loadStart = (window.performance && performance.now) ? performance.now() : Date.now();
  function nowMs(){ return (window.performance && performance.now) ? performance.now() : Date.now(); }
  function setLoad(p){
    p = Math.max(0, Math.min(100, p));
    loadPctEl.textContent = Math.round(p) + '%';
    if(ringFg) ringFg.style.strokeDashoffset = DASH * (1 - p / 100);
  }
  function finishLoad(){
    if(loadDone) return; loadDone = true;
    if(loadRaf) cancelAnimationFrame(loadRaf);
    setLoad(100);
    // inicia o player UMA vez (video ja vinha bufferizando via preload)
    if(!playerStarted){
      playerStarted = true;
      applyVisual(); checkResumeOnLoad();
      if(!resumeEl.classList.contains('show')) start();
      poke();
    }
    setTimeout(function(){
      loadEl.classList.add('done');
      setTimeout(function(){ loadEl.style.display = 'none'; }, 400);
    }, 120);
  }
  function loadTick(){
    if(loadDone) return;
    var elapsed = nowMs() - loadStart;
    var p = (elapsed / LOAD_MS) * 100;
    setLoad(p);
    if(p >= 100){ finishLoad(); return; }
    loadRaf = requestAnimationFrame(loadTick);
  }

  // ---------- Tela "Continuar / Recomecar" (salva progresso no localStorage) ----------
  var resumeEl = document.getElementById('resume');
  var STORE_KEY = 'vt_progress_' + CFG.id;
  function loadProgress(){ try{ return JSON.parse(localStorage.getItem(STORE_KEY)||'null'); }catch(e){ return null; } }
  function saveProgress(time, completed){
    try{ localStorage.setItem(STORE_KEY, JSON.stringify({ t: time||0, done: !!completed })); }catch(e){}
  }
  function showResume(){ if(!PREVIEW) resumeEl.classList.add('show'); }
  function hideResume(){ resumeEl.classList.remove('show'); }

  // salva o tempo a cada poucos segundos
  var lastSave = 0;
  v.addEventListener('timeupdate', function(){
    if(v.currentTime - lastSave > 3){ lastSave = v.currentTime; saveProgress(v.currentTime, false); }
  });
  // ao terminar -> marca completo e mostra a tela
  v.addEventListener('ended', function(){ saveProgress(v.duration||0, true); showResume(); });

  // botoes da tela
  document.getElementById('resumeContinue').addEventListener('click', function(e){
    e.stopPropagation(); hideResume();
    var pr = loadProgress();
    if(pr && pr.t && !pr.done){ try{ v.currentTime = pr.t; }catch(e2){} }
    else { try{ v.currentTime = 0; }catch(e2){} }
    v.muted=false; updateMuteUI(); v.play(); hideBig();
  });
  document.getElementById('resumeRestart').addEventListener('click', function(e){
    e.stopPropagation(); hideResume();
    try{ v.currentTime = 0; }catch(e2){} maxT = 0; saveProgress(0, false);
    v.pause(); v.muted=true; updateMuteUI();
    showBig(); // volta pra tela de play/unmute
  });

  // ao carregar: so mostra tela de retomar se JA assistiu o video completo (done=true)
  function checkResumeOnLoad(){
    var pr = loadProgress();
    if(!pr || !pr.done) return;
    hideBig();
    showResume();
    v.pause();
  }

  // init
  applyVisual();
  setLoad(0);
  loadSource();                         // video comeca a bufferizar via preload="auto"
  loadStart = nowMs();                  // marca inicio do loading temporal
  loadRaf = requestAnimationFrame(loadTick);
})();
`;

/**
 * Script de embed de 1 linha.
 */
export function renderPlayerScript(video, publicUrl) {
  const playerUrl = `${publicUrl}/p/${video.id}`;
  return `(function(){
  var current = document.currentScript;
  var box = document.createElement('div');
  box.style.cssText = 'position:relative;width:100%;max-width:100%;aspect-ratio:16/9;min-height:200px;margin:0 auto;background:#000;overflow:visible;';
  var iframe = document.createElement('iframe');
  iframe.src = ${JSON.stringify(playerUrl)};
  iframe.allow = 'autoplay; fullscreen; encrypted-media';
  iframe.setAttribute('allowfullscreen','');
  iframe.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border:0;';
  box.appendChild(iframe);
  if (current && current.parentNode) current.parentNode.insertBefore(box, current);
  else document.body.appendChild(box);
})();`;
}
