import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const ROOT = path.resolve(__dirname, '..');

export const config = {
  port: process.env.PORT || 4000,

  // URL publica base. Em producao na Hostinger, defina PUBLIC_URL=https://seudominio.com
  // Local fica http://localhost:4000
  publicUrl: process.env.PUBLIC_URL || `http://localhost:${process.env.PORT || 4000}`,

  // Senha do painel admin (mude no .env em producao!)
  adminPassword: process.env.ADMIN_PASSWORD || 'admin123',

  // Pastas de dados
  dataDir: path.join(ROOT, 'data'),
  uploadsDir: path.join(ROOT, 'data', 'uploads'),
  mediaDir: path.join(ROOT, 'data', 'media'),
  dbPath: path.join(ROOT, 'data', 'vturb.db'),

  // Limite de upload (MB)
  maxUploadMb: parseInt(process.env.MAX_UPLOAD_MB || '2000', 10),
};
