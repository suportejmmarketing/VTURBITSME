import express from 'express';
import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';
import { nanoid } from 'nanoid';
import { config, ROOT } from './config.js';
import { db, rowToVideo, mergeSettings, DEFAULT_SETTINGS } from './db.js';
import { processVideo, HAS_FFMPEG } from './transcode.js';
import { renderPlayerHtml, renderPlayerScript } from './player.js';

fs.mkdirSync(config.uploadsDir, { recursive: true });
fs.mkdirSync(config.mediaDir, { recursive: true });

const app = express();
app.set('trust proxy', true); // respeita X-Forwarded-* (proxies: Render, Nginx, Hostinger)
app.use(express.json());

// Detecta a URL publica automaticamente pela requisicao (protocolo + host).
// Se PUBLIC_URL estiver definida, ela tem prioridade (forca).
function baseUrl(req) {
  if (config.publicUrl) return config.publicUrl.replace(/\/$/, '');
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${proto}://${host}`;
}

// ---- Upload config ----
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, config.uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.mp4';
    cb(null, `${nanoid()}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: config.maxUploadMb * 1024 * 1024 },
});

// ---- Auth simples para o painel (cookie de senha) ----
function checkAdmin(req, res, next) {
  const token = req.headers['x-admin-token'] || req.query.token;
  if (token === config.adminPassword) return next();
  return res.status(401).json({ error: 'unauthorized' });
}

// ====================================================================
//  PAINEL ADMIN (UI estatica)
// ====================================================================
app.use('/admin', express.static(path.join(ROOT, 'public', 'admin')));
app.get('/', (_req, res) => res.redirect('/admin'));

// ====================================================================
//  API ADMIN
// ====================================================================
app.post('/api/login', (req, res) => {
  const { password } = req.body || {};
  if (password === config.adminPassword) return res.json({ ok: true, token: config.adminPassword });
  return res.status(401).json({ error: 'senha incorreta' });
});

app.get('/api/info', checkAdmin, (req, res) => {
  res.json({ hasFfmpeg: HAS_FFMPEG, publicUrl: baseUrl(req), defaults: DEFAULT_SETTINGS });
});

app.get('/api/videos', checkAdmin, (_req, res) => {
  const rows = db.prepare('SELECT * FROM videos ORDER BY created_at DESC').all();
  const playStmt = db.prepare("SELECT COUNT(*) n FROM events WHERE video_id = ? AND type = 'play'");
  res.json(rows.map((r) => ({ ...rowToVideo(r), plays: playStmt.get(r.id).n })));
});

app.get('/api/videos/:id', checkAdmin, (req, res) => {
  const row = db.prepare('SELECT * FROM videos WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'nao encontrado' });
  res.json(rowToVideo(row));
});

app.post('/api/videos', checkAdmin, upload.single('video'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'envie um arquivo de video' });
  const id = nanoid(10);
  const title = (req.body.title || req.file.originalname || 'Sem titulo').slice(0, 200);

  db.prepare(`INSERT INTO videos (id, title, status, source_file, settings, created_at)
              VALUES (?, ?, 'processing', ?, ?, ?)`)
    .run(id, title, req.file.filename, JSON.stringify(DEFAULT_SETTINGS), Date.now());

  // converte em background (ou marca ready se nao houver ffmpeg)
  processVideo(id, req.file.path);

  res.json(rowToVideo(db.prepare('SELECT * FROM videos WHERE id = ?').get(id)));
});

app.put('/api/videos/:id', checkAdmin, (req, res) => {
  const row = db.prepare('SELECT * FROM videos WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'nao encontrado' });

  const current = rowToVideo(row);
  const incoming = req.body.settings || {};
  // mescla settings atuais + alteracoes recebidas, garantindo defaults profundos
  const merged = mergeSettings({
    ...current.settings,
    ...incoming,
    progressBar: { ...current.settings.progressBar, ...(incoming.progressBar || {}) },
    controls: { ...current.settings.controls, ...(incoming.controls || {}) },
    overlay: {
      ...current.settings.overlay,
      ...(incoming.overlay || {}),
      desktop: { ...current.settings.overlay.desktop, ...((incoming.overlay || {}).desktop || {}) },
      mobile: { ...current.settings.overlay.mobile, ...((incoming.overlay || {}).mobile || {}) },
    },
  });
  const title = req.body.title ?? current.title;

  db.prepare('UPDATE videos SET title = ?, settings = ? WHERE id = ?')
    .run(title, JSON.stringify(merged), req.params.id);

  res.json(rowToVideo(db.prepare('SELECT * FROM videos WHERE id = ?').get(req.params.id)));
});

app.delete('/api/videos/:id', checkAdmin, (req, res) => {
  const row = db.prepare('SELECT * FROM videos WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'nao encontrado' });
  db.prepare('DELETE FROM videos WHERE id = ?').run(req.params.id);
  // limpa arquivos
  try { fs.rmSync(path.join(config.mediaDir, req.params.id), { recursive: true, force: true }); } catch {}
  try { if (row.source_file) fs.rmSync(path.join(config.uploadsDir, row.source_file), { force: true }); } catch {}
  res.json({ ok: true });
});

// Metricas de retencao agregadas
app.get('/api/videos/:id/stats', checkAdmin, (req, res) => {
  const id = req.params.id;
  const plays = db.prepare("SELECT COUNT(*) n FROM events WHERE video_id=? AND type='play'").get(id).n;
  const ended = db.prepare("SELECT COUNT(*) n FROM events WHERE video_id=? AND type='ended'").get(id).n;
  res.json({ plays, ended, completionRate: plays ? Math.round((ended / plays) * 100) : 0 });
});

// ====================================================================
//  EMBED / PLAYER PUBLICO  (sem auth)
// ====================================================================

// Script de 1 linha: <script src=".../e/<id>.js"></script>
app.get('/e/:id.js', (req, res) => {
  const row = db.prepare('SELECT * FROM videos WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).type('js').send('console.error("[vturb] video nao encontrado")');
  res.type('application/javascript').send(renderPlayerScript(rowToVideo(row), baseUrl(req)));
});

// Player em iframe (o script injeta um iframe apontando aqui)
app.get('/p/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM videos WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).send('Video nao encontrado');
  res.type('html').send(renderPlayerHtml(rowToVideo(row), baseUrl(req)));
});

// Stream do media: HLS (se convertido) ou MP4 original
app.use('/media', express.static(config.mediaDir));
// Serve o MP4 com suporte a Range (necessario pra player externo avancar/buscar).
app.get('/raw/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM videos WHERE id = ?').get(req.params.id);
  if (!row || !row.source_file) return res.status(404).end();
  const filePath = path.join(config.uploadsDir, row.source_file);
  if (!fs.existsSync(filePath)) return res.status(404).end();

  const stat = fs.statSync(filePath);
  const total = stat.size;
  const ext = path.extname(filePath).toLowerCase();
  const mime = ext === '.webm' ? 'video/webm' : ext === '.ogg' ? 'video/ogg' : 'video/mp4';
  res.setHeader('Content-Type', mime);
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Access-Control-Allow-Origin', '*'); // permite uso em outros dominios (checkout)

  const range = req.headers.range;
  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range) || [];
    const start = m[1] ? parseInt(m[1], 10) : 0;
    const end = m[2] ? parseInt(m[2], 10) : total - 1;
    if (start >= total || end >= total) {
      res.status(416).setHeader('Content-Range', `bytes */${total}`).end();
      return;
    }
    res.status(206);
    res.setHeader('Content-Range', `bytes ${start}-${end}/${total}`);
    res.setHeader('Content-Length', end - start + 1);
    fs.createReadStream(filePath, { start, end }).pipe(res);
  } else {
    res.setHeader('Content-Length', total);
    fs.createReadStream(filePath).pipe(res);
  }
});

// Tracking (chamado pelo player)
app.post('/t', (req, res) => {
  const { videoId, type, position, session } = req.body || {};
  if (!videoId || !type) return res.status(204).end();
  try {
    db.prepare('INSERT INTO events (video_id, type, position, session, created_at) VALUES (?,?,?,?,?)')
      .run(videoId, String(type).slice(0, 20), Number(position) || 0, String(session || '').slice(0, 40), Date.now());
  } catch {}
  res.status(204).end();
});

app.listen(config.port, () => {
  const url = config.publicUrl || `http://localhost:${config.port}`;
  console.log(`\n  VTurb-Self rodando!`);
  console.log(`  Painel:  ${url}/admin`);
  console.log(`  URL:     ${config.publicUrl ? config.publicUrl + ' (fixa)' : 'auto-detectada pela requisicao'}`);
  console.log(`  FFmpeg:  ${HAS_FFMPEG ? 'OK (HLS ativo)' : 'ausente (usando MP4 direto)'}`);
  console.log(`  Senha:   ${config.adminPassword}\n`);
});
