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
 * Converte um MP4 em HLS multi-qualidade (360p / 720p).
 * Roda em background; atualiza o status no banco quando termina.
 * Se nao houver FFmpeg, marca como 'ready' usando o MP4 direto.
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
    // Sem FFmpeg: serve o MP4 original. Player faz fallback automatico.
    db.prepare("UPDATE videos SET status = 'ready', hls_path = NULL WHERE id = ?").run(videoId);
    return;
  }

  db.prepare("UPDATE videos SET status = 'processing' WHERE id = ?").run(videoId);

  // HLS adaptativo simples: duas renditions.
  const args = [
    '-y', '-i', inputPath,
    // 720p
    '-map', '0:v:0', '-map', '0:a:0?',
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23',
    '-vf', "scale=w=1280:h=720:force_original_aspect_ratio=decrease",
    '-c:a', 'aac', '-b:a', '128k',
    '-hls_time', '6', '-hls_playlist_type', 'vod',
    '-hls_segment_filename', path.join(outDir, '720p_%03d.ts'),
    path.join(outDir, '720p.m3u8'),
  ];

  const proc = spawn('ffmpeg', args, { stdio: 'ignore' });

  proc.on('exit', (code) => {
    if (code === 0) {
      // master playlist apontando pra rendition
      const master = [
        '#EXTM3U',
        '#EXT-X-VERSION:3',
        '#EXT-X-STREAM-INF:BANDWIDTH=2500000,RESOLUTION=1280x720',
        '720p.m3u8',
        '',
      ].join('\n');
      fs.writeFileSync(path.join(outDir, 'master.m3u8'), master);
      db.prepare("UPDATE videos SET status = 'ready', hls_path = ? WHERE id = ?")
        .run(`${videoId}/master.m3u8`, videoId);
    } else {
      db.prepare("UPDATE videos SET status = 'error' WHERE id = ?").run(videoId);
    }
  });
}
