import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import { db } from './db.js';

// Detecta FFmpeg uma vez
export const HAS_FFMPEG = (() => {
  try {
    const r = spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' });
    return r.status === 0;
  } catch {
    return false;
  }
})();

// Le a duracao do video com ffprobe (se disponivel)
function probeDuration(inputPath) {
  try {
    const r = spawnSync('ffprobe', [
      '-v', 'error', '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1', inputPath,
    ], { encoding: 'utf8' });
    const d = parseFloat((r.stdout || '').trim());
    return Number.isFinite(d) ? d : 0;
  } catch {
    return 0;
  }
}

/**
 * OTIMIZA o video pra carregar o mais rapido possivel (estilo VTurb):
 *  - re-encoda em H.264 (libx264) compativel com todo navegador (yuv420p)
 *  - CRF 26: bom equilibrio qualidade/tamanho (reduz drasticamente o peso)
 *  - limita a 1080p (nao faz sentido VSL maior; corta peso)
 *  - audio AAC 128k
 *  - -movflags +faststart: move o indice (moov atom) pro INICIO do arquivo
 *    -> o navegador comeca a tocar quase instantaneo, sem baixar tudo antes.
 * Roda em background; ao terminar, o MP4 otimizado substitui o original servido.
 * Se nao houver FFmpeg, serve o MP4 original direto.
 */
export function processVideo(videoId, inputPath) {
  const outDir = path.join(config.mediaDir, videoId);
  fs.mkdirSync(outDir, { recursive: true });

  const duration = probeDuration(inputPath);
  if (duration) {
    db.prepare('UPDATE videos SET duration = ? WHERE id = ?').run(duration, videoId);
  }

  // Gera thumbnail (1 frame em ~2s) se houver FFmpeg
  if (HAS_FFMPEG) {
    try {
      const thumbRel = `${videoId}/poster.jpg`;
      const at = duration ? Math.min(2, duration / 2) : 1;
      spawnSync('ffmpeg', ['-y', '-ss', String(at), '-i', inputPath, '-frames:v', '1',
        '-vf', 'scale=320:-1', path.join(outDir, 'poster.jpg')], { stdio: 'ignore' });
      if (fs.existsSync(path.join(outDir, 'poster.jpg'))) {
        db.prepare('UPDATE videos SET poster = ? WHERE id = ?').run(thumbRel, videoId);
      }
    } catch { /* ignore */ }
  }

  if (!HAS_FFMPEG) {
    db.prepare("UPDATE videos SET status = 'ready', hls_path = NULL WHERE id = ?").run(videoId);
    return;
  }

  db.prepare("UPDATE videos SET status = 'processing' WHERE id = ?").run(videoId);
  optimizeMp4(videoId, inputPath);
}

/**
 * Recomprime um MP4 com faststart e o deixa como fonte servida (/raw).
 * Substitui o arquivo original no uploadsDir pra economizar espaco.
 */
export function optimizeMp4(videoId, inputPath) {
  // nome unico (timestamp) evita colisao ao re-otimizar um video ja otimizado
  const optName = `${videoId}_${Date.now()}_opt.mp4`;
  const optPath = path.join(config.uploadsDir, optName);

  const args = [
    '-y', '-i', inputPath,
    '-map', '0:v:0', '-map', '0:a:0?',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '26',
    '-pix_fmt', 'yuv420p',                      // compat. maxima (iOS/Safari)
    '-vf', "scale='min(1920,iw)':'min(1080,ih)':force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2",
    '-c:a', 'aac', '-b:a', '128k', '-ac', '2',
    '-movflags', '+faststart',                  // <- chave: toca rapido
    optPath,
  ];

  const proc = spawn('ffmpeg', args, { stdio: 'ignore' });

  proc.on('exit', (code) => {
    if (code === 0 && fs.existsSync(optPath) && fs.statSync(optPath).size > 0) {
      // troca a fonte servida pelo otimizado e apaga o original pesado
      db.prepare("UPDATE videos SET status = 'ready', source_file = ?, hls_path = NULL WHERE id = ?")
        .run(optName, videoId);
      try { if (inputPath !== optPath) fs.rmSync(inputPath, { force: true }); } catch { /* ignore */ }
    } else {
      // falhou a otimizacao: serve o original mesmo assim (nao trava o usuario)
      db.prepare("UPDATE videos SET status = 'ready', hls_path = NULL WHERE id = ?").run(videoId);
    }
  });
}
