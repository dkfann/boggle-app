import express from 'express';
import { createServer } from 'node:http';
import { WebSocketServer } from 'ws';
import { join } from 'node:path';
import { loadDictionary } from './dictionary.js';
import { setupWebSocket } from './ws.js';
import { roomCount } from './rooms.js';

const PORT = Number(process.env.PORT ?? 3001);

// Load before accepting traffic: a round cannot start without the dictionary.
loadDictionary();

const app = express();
const server = createServer(app);

const wss = new WebSocketServer({
  server,
  path: '/ws',
  maxPayload: 4 * 1024, // no legitimate client message comes close
});
setupWebSocket(wss);

app.get('/health', (_req, res) => {
  res.json({ ok: true, rooms: roomCount(), uptime: process.uptime() });
});

// In production the built client is served from this same origin, so the
// WebSocket needs no CORS handling and no separate host to configure.
// Resolved from the working directory (npm runs this with cwd=server/) so it
// holds for both `tsx src/index.ts` and the compiled dist/ layout.
const clientDist = process.env.CLIENT_DIST ?? join(process.cwd(), '..', 'client', 'dist');
app.use(express.static(clientDist, { maxAge: '1h', index: false }));
app.get('*', (_req, res) => {
  res.sendFile(join(clientDist, 'index.html'));
});

server.listen(PORT, () => {
  console.log(`Boggle server listening on http://localhost:${PORT}`);
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    console.log(`\n${signal} received, shutting down.`);
    wss.close();
    server.close(() => process.exit(0));
  });
}
