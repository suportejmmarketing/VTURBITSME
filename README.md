# 🎬 VTurb-Self

Plataforma **self-hosted** de player de vídeo inteligente, estilo VTurb, para VSL e checkout.
Sobe o vídeo, configura, copia 1 linha de `<script>` e cola no seu site. **Sem assinatura mensal.**

## O que ela faz

- ✅ Player HTML5 com **autoplay smart** (toca sozinho mudo, com overlay "clique para ativar o som")
- ✅ Bloqueio de avanço da barra (estilo VSL)
- ✅ **Botão de compra (CTA) que aparece no minuto X** do vídeo
- ✅ Embed de **1 linha** funciona em qualquer site/checkout
- ✅ Painel admin pra subir vídeo, configurar e gerar o script
- ✅ Conversão **HLS** automática (se tiver FFmpeg) ou MP4 direto (sem FFmpeg)
- ✅ Métricas básicas de retenção (plays, % que completou, cliques no CTA)
- ✅ Hospedagem 100% sua (local ou Hostinger)

---

## 🖥️ Rodar LOCAL (Windows, seu PC)

```powershell
cd vturb-self
npm install
npm start
```

Abra **http://localhost:4000/admin** — senha padrão `admin123`.

> Sem FFmpeg instalado, o vídeo é servido como MP4 direto (funciona 100%).
> Para ter HLS multi-qualidade (igual VTurb), instale o FFmpeg e coloque no PATH.

---

## 🚀 Rodar na HOSTINGER (VPS com Docker)

A hospedagem **compartilhada** não roda isso bem (precisa de Node + FFmpeg).
Use uma **Hostinger VPS** (plano fixo barato, sem assinatura de SaaS).

```bash
# na VPS, depois de clonar/enviar a pasta:
cp .env.example .env
nano .env          # ajuste PUBLIC_URL e ADMIN_PASSWORD
docker compose up -d --build
```

No `.env`:
```
PUBLIC_URL=https://video.seudominio.com
ADMIN_PASSWORD=umaSenhaForte
```

Aponte um subdomínio (ex: `video.seudominio.com`) pra VPS e coloque um proxy
(Nginx/Caddy) na frente na porta 4000, com HTTPS. Pronto.

---

## 📋 Como usar (fluxo)

1. Entre no painel `/admin`
2. **Envie o vídeo** (.mp4) com um título
3. Clique em **Configurar** no vídeo
4. Ajuste autoplay, CTA (botão de compra no segundo X), cores
5. **Copie o código** e cole no seu site/checkout:

```html
<script src="https://seudominio.com/e/SEU_ID.js"></script>
```

O script injeta um player responsivo 16:9 exatamente onde você colar a tag.

---

## ⚙️ Variáveis de ambiente

| Variável | Padrão | Descrição |
|---|---|---|
| `PORT` | `4000` | Porta do servidor |
| `PUBLIC_URL` | `http://localhost:4000` | URL pública (importante pro embed!) |
| `ADMIN_PASSWORD` | `admin123` | Senha do painel |
| `MAX_UPLOAD_MB` | `2000` | Limite de upload |

---

## 📂 Onde ficam os dados

Tudo em `./data/`:
- `data/uploads/` — vídeos originais
- `data/media/` — HLS convertido
- `data/vturb.db` — banco SQLite (vídeos, config, métricas)

Faça backup dessa pasta e você não perde nada.

---

## 🔜 Próximos passos possíveis (v2)

- Gráfico de retenção por segundo (heatmap de abandono)
- Thumbnail/poster customizável
- Múltiplos usuários
- Pixel do Facebook/Meta integrado ao evento de CTA
- A/B test de thumbnail e CTA
