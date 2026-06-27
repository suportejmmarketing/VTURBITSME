import Database from 'better-sqlite3';
import fs from 'node:fs';
import { config } from './config.js';

fs.mkdirSync(config.dataDir, { recursive: true });

export const db = new Database(config.dbPath);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS videos (
    id           TEXT PRIMARY KEY,
    title        TEXT NOT NULL,
    status       TEXT NOT NULL DEFAULT 'ready',   -- ready | processing | error
    source_file  TEXT,                            -- nome do mp4 original
    hls_path     TEXT,                            -- caminho relativo do master.m3u8 (se convertido)
    poster       TEXT,                            -- thumbnail/poster
    duration     REAL DEFAULT 0,
    settings     TEXT NOT NULL DEFAULT '{}',      -- JSON com config do player
    created_at   INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS events (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    video_id   TEXT NOT NULL,
    type       TEXT NOT NULL,                     -- play | progress | ended | cta_view | cta_click
    position   REAL DEFAULT 0,                    -- segundo do video
    session    TEXT,
    created_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_events_video ON events(video_id);
`);

// migracoes idempotentes (adiciona colunas novas em bancos ja existentes)
for (const col of ['vwidth INTEGER DEFAULT 0', 'vheight INTEGER DEFAULT 0']) {
  try { db.exec(`ALTER TABLE videos ADD COLUMN ${col}`); } catch { /* ja existe */ }
}

// Config padrao do player (espelha as opcoes do VTurb)
export const DEFAULT_SETTINGS = {
  // Tema do player
  theme: 'dark',           // dark | light

  // Reproducao
  autoplay: true,          // tenta tocar sozinho
  startMuted: true,        // comeca mudo (necessario p/ autoplay nos navegadores)
  showUnmuteButton: true,  // overlay "clique para ativar o som"
  detectInteraction: true, // audio inicia apos qualquer interacao na pagina
  previewMode: false,      // previa: video roda mudo no fundo; ao clicar reinicia com som
  loop: false,
  allowSeek: false,        // impede arrastar a barra pra frente

  // Overlay de unmute (caixa editavel estilo VTurb) - arrastavel/redimensionavel
  overlay: {
    pulse: false,            // fazer o autoplay pulsar
    icon: 'video-muted',     // video-muted | sound-muted | play | none
    topText: 'Seu vídeo já começou',
    bottomText: 'Clique para ouvir',
    fontSize: 16,              // tamanho base da fonte em px (escala com a caixa)
    textColor: '#ffffff',
    bgColor: '#1f9d6b',
    bgOpacity: 0.82,
    // posicao (x,y = borda esquerda/topo em %) e tamanho (w,h em %) por device
    desktop: { x: 24, y: 20, w: 52, h: 60 },
    mobile:  { x: 10, y: 27, w: 80, h: 46 },
  },

  // Barra de progresso
  progressBar: {
    style: 'thin-handle',   // thin-handle | thick-gradient | hidden
    height: 4,              // altura em px (slider arrastavel)
    hoverGrow: true,        // engorda no hover (estilo VTurb)
    showHandle: true,       // bolinha arrastavel
    smart: true,            // barra inteligente: rapido no inicio, lento no fim (estilo VTurb)
    smartCurve: 2.5,        // intensidade (1 = linear; ate 4 = bem marcado)
    barColor: '#2563eb',    // cor da parte PREENCHIDA (assistida)
    usePlayColor: false,    // usar a cor primaria na barra preenchida
    trackColor: '#ffffff',  // cor do trilho (parte nao assistida)
    trackOpacity: 0.25,     // opacidade do trilho (0-1)
    // a parte assistida usa primaryColor
  },

  // Controles
  controls: {
    minimal: true,         // modo VSL: esconde a barra de botoes, mantem so o progresso
    clickToPause: true,    // play/pause clicando no video
    speed: true,           // botao 1x / 1.5x / 2x
    fullscreen: true,      // botao tela cheia
    volume: true,          // controle de volume
    timeDisplay: true,     // 02:14 / 10:00
    autoHide: true,        // esconde controles apos inatividade
  },

  primaryColor: '#2563eb',
};

// Merge profundo sobre os defaults. So mantem chaves que existem nos defaults
// (descarta campos orfaos de versoes antigas, ex: cta removido).
export function mergeSettings(incoming = {}) {
  const out = {};
  for (const key of Object.keys(DEFAULT_SETTINGS)) {
    const def = DEFAULT_SETTINGS[key];
    if (def && typeof def === 'object' && !Array.isArray(def)) {
      out[key] = { ...def, ...(incoming[key] || {}) };
    } else {
      out[key] = (key in incoming) ? incoming[key] : def;
    }
  }
  // niveis extras: posicao por device dentro do overlay
  out.overlay.desktop = { ...DEFAULT_SETTINGS.overlay.desktop, ...((incoming.overlay || {}).desktop || {}) };
  out.overlay.mobile = { ...DEFAULT_SETTINGS.overlay.mobile, ...((incoming.overlay || {}).mobile || {}) };
  return out;
}

export function rowToVideo(row) {
  if (!row) return null;
  let settings = {};
  try { settings = JSON.parse(row.settings); } catch { /* ignore */ }
  return { ...row, settings: mergeSettings(settings) };
}
