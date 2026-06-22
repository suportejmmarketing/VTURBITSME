import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const ROOT = path.resolve(__dirname, '..');

export const config = {
  port: process.env.PORT || 4000,

  // URL publica base. Se PUBLIC_URL estiver definida, usa ela (forca).
  // Senao, fica null e o servidor DETECTA automaticamente pela requisicao
  // (host + protocolo). Assim funciona em qualquer servidor sem configurar nada.
  publicUrl: process.env.PUBLIC_URL || null,

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
