FROM node:22-slim

# FFmpeg para conversao HLS (igual VTurb). Remova estas 2 linhas se nao quiser HLS.
RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY . .

ENV PORT=4000
EXPOSE 4000
VOLUME ["/app/data"]
CMD ["node", "src/server.js"]
