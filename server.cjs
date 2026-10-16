'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { randomBytes, randomInt } = require('node:crypto');
const { WebSocketServer, WebSocket } = require('ws');
const createWorld = require('./server-world.cjs');
const PROTOCOL = 1, CAPACITY = 4;
const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const cars = new Set(['classic', 'rally', 'gt', 'solstice']);
const send = (ws, data) => {
  if (ws?.readyState === WebSocket.OPEN) {
    if (ws.bufferedAmount > 512 * 1024) return ws.close(1013, 'Connection too slow');
    ws.send(JSON.stringify(data));
  }
};
const token = () => randomBytes(24).toString('base64url');
const numeric = (value, min, max) => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;

function createServer({ reconnectMs = 90000, emptyMs = 600000, maxRooms = 32, dev = false } = {}) {
  const { W, buildings } = createWorld();
  const rooms = new Map(), attempts = new Map();
  const publicDir = path.join(__dirname, 'public');
  const allowed = new Set(['index.html', 'style.css', 'three.min.js', 'world.js', 'islands.js', 'ramps.js', 'physics.js', 'aura.js', 'garage.js', 'traffic.js', 'multiplayer.js', 'game.js', 'THREE-LICENSE.txt']);
  const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.txt': 'text/plain' };
  const server = http.createServer((req, res) => {
    let url;
    try { url = new URL(req.url, 'http://localhost'); } catch { res.writeHead(400).end(); return; }
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cache-Control', 'no-store');
    if (!['GET', 'HEAD'].includes(req.method)) return res.writeHead(405).end();
    if (url.pathname === '/healthz') return res.writeHead(200, { 'Content-Type': 'application/json' }).end('{"ok":true}');
    if (url.pathname === '/favicon.ico') return res.writeHead(204).end();
    let name;
    try { name = decodeURIComponent(url.pathname).slice(1) || 'index.html'; } catch { return res.writeHead(400).end(); }
    if (dev && name === 'qa.html') {
      const html = fs.readFileSync(path.join(publicDir, 'index.html'), 'utf8').replace('</body>', '<script src="qa.js"></script></body>');
      return res.writeHead(200, { 'Content-Type': mime['.html'] }).end(req.method === 'HEAD' ? '' : html);
    }
    if (!allowed.has(name) && !(dev && name === 'qa.js')) return res.writeHead(404).end('Not found');
    fs.readFile(path.join(publicDir, name), (err, body) => {
      if (err) return res.writeHead(404).end('Not found');
      res.writeHead(200, { 'Content-Type': mime[path.extname(name)] || 'application/octet-stream' });
      res.end(req.method === 'HEAD' ? '' : body);
    });
  });
  const wss = new WebSocketServer({ noServer: true, maxPayload: 8192, perMessageDeflate: false });
  server.on('upgrade', (req, socket, head) => {
    let originOK = true;
    try { if (req.headers.origin) originOK = new URL(req.headers.origin).host === req.headers.host; } catch { originOK = false; }
    if (req.url !== '/ws' || !originOK || wss.clients.size >= 128) return socket.destroy();
    // Use the direct peer address: never trust arbitrary forwarded headers.
    const ip = req.socket.remoteAddress || 'unknown';
    let bucket = attempts.get(ip);
    if (!bucket || Date.now() - bucket.at > 60000) attempts.set(ip, bucket = { at: Date.now(), count: 0 });
    if (++bucket.count > 120) return socket.destroy();
    wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, req));
  });

  function trafficForRoom() { W.initTraffic(); return W.traffic; }
  function roomCode() { let code; do { code = Array.from({ length: 6 }, () => alphabet[randomInt(alphabet.length)]).join(''); } while (rooms.has(code)); return code; }
  const broadcast = (room, data) => { for (const p of room.players.values()) send(p.ws, data); };
  function roster(room) {
    return [...room.players.values()].map(p => ({ id: p.id, name: p.name, score: p.score, connected: !!p.ws, host: p.id === room.host, car: p.state.car }));
  }
  const announce = room => broadcast(room, { type: 'roster', players: roster(room), host: room.host });
  function removePlayer(room, p) {
    room.players.delete(p.id);
    if (p.ws) p.ws.player = null;
    if (room.host === p.id) room.host = [...room.players.values()].find(q => q.ws)?.id || room.players.keys().next().value;
    room.emptyAt = room.players.size ? 0 : Date.now();
    announce(room);
  }
  function spawn(slot) {
    const x = -slot * 12, z = 700 - slot * 1.6;
    return { x, y: W.driveHeight(x, z) + .12, z, yaw: Math.PI / 2 + .14, vx: 0, vy: 0, vz: 0, pitch: 0, roll: 0, steer: 0, speed: 0, car: 'classic', nitro: false, grounded: true, water: 'dry', brake: false, parked: false };
  }
  function join(ws, data) {
    if (ws.player) return send(ws, { type: 'error', message: 'You are already in a room.' });
    if (data.v !== PROTOCOL) return send(ws, { type: 'error', message: 'Refresh the game to join this version.' });
    const name = typeof data.name === 'string' ? data.name.replace(/[\x00-\x1f\x7f<>]/g, '').trim().slice(0, 18) : '';
    if (!name) return send(ws, { type: 'error', message: 'Choose a driver name first.' });
    let room, p, resumed = false;
    if (data.type === 'create') {
      if (rooms.size >= maxRooms) return send(ws, { type: 'error', message: 'All rooms are busy. Try again shortly.' });
      const code = roomCode();
      room = { code, players: new Map(), hp: buildings.map(() => 100), hits: buildings.map(() => 0), traffic: trafficForRoom(), emptyAt: 0, host: null };
      rooms.set(code, room);
    } else {
      room = rooms.get(typeof data.code === 'string' ? data.code.toUpperCase() : '');
      if (!room) return send(ws, { type: 'error', message: 'Room not found. Check the code, or create a fresh room.', expired: data.type === 'resume' });
      if (data.type === 'resume') {
        p = [...room.players.values()].find(q => q.token === data.token && (!q.disconnectedAt || Date.now() - q.disconnectedAt < reconnectMs));
        if (!p) return send(ws, { type: 'error', message: 'Your reserved spot expired. Join the room again.', expired: true });
        resumed = true;
      } else if (room.players.size >= CAPACITY) return send(ws, { type: 'error', message: 'That room is full (4/4). Ask a friend to leave or create another.' });
    }
    if (!p) {
      const used = new Set([...room.players.values()].map(q => q.slot));
      let slot = 0; while (used.has(slot)) slot++;
      p = { id: randomBytes(8).toString('hex'), token: token(), name, slot, score: 0, scoreSeq: 0, lastScoreAt: 0, state: spawn(slot), previous: null, lastTrafficHit: 0, disconnectedAt: 0, ws: null, room };
      room.players.set(p.id, p);
      if (!room.host) room.host = p.id;
    }
    const old = p.ws; p.ws = ws; ws.player = p;
    if (old && old !== ws) { old.player = null; old.close(4001, 'Resumed in another connection'); }
    p.disconnectedAt = 0; room.emptyAt = 0;
    send(ws, { type: 'welcome', v: PROTOCOL, code: room.code, id: p.id, token: p.token, resumed, state: p.state, scoreSeq: p.scoreSeq, hp: room.hp, buildings: buildings.map(b => [b.id, Math.round(b.x * 100), Math.round(b.z * 100)]), players: roster(room), host: room.host });
    announce(room);
  }
  function validState(s) {
    if (!s || !cars.has(s.car)) return false;
    return [['x', -3000, 4000], ['y', -100, 1500], ['z', -3000, 3000], ['yaw', -100000, 100000], ['vx', -120, 120], ['vy', -150, 150], ['vz', -120, 120], ['pitch', -4, 4], ['roll', -4, 4], ['steer', -2, 2], ['speed', -120, 120]].every(([k, min, max]) => numeric(s[k], min, max)) && ['dry', 'skimming', 'sinking'].includes(s.water);
  }
  function handle(ws, data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return;
    if (['create', 'join', 'resume'].includes(data.type)) {
      if (Date.now() - ws.lastJoin < 700) return;
      ws.lastJoin = Date.now(); return join(ws, data);
    }
    const p = ws.player; if (!p) return;
    const room = p.room, now = Date.now();
    if (data.type === 'state' && validState(data.state)) {
      const s = data.state;
      p.previous = p.state;
      p.state = Object.fromEntries(['x', 'y', 'z', 'yaw', 'vx', 'vy', 'vz', 'pitch', 'roll', 'steer', 'speed', 'car', 'water'].map(k => [k, s[k]]));
      for (const k of ['nitro', 'grounded', 'brake', 'parked']) p.state[k] = s[k] === true;
      if (p.state.parked) { p.state.nitro = false; p.state.vx = p.state.vy = p.state.vz = p.state.speed = 0; }
    } else if (data.type === 'hit') {
      const b = buildings[data.id];
      if (!Number.isInteger(data.id) || !b || room.hp[b.id] <= 0 || now - room.hits[b.id] < 700 || !numeric(data.speed, 15, 95)) return;
      const s = p.state;
      if (Math.hypot(s.x - b.x, s.z - b.z) > Math.hypot(b.w, b.d) / 2 + 10 || s.y > b.y + b.h + 2 || s.y < b.y - 3) return;
      const recentSpeed = Math.max(Math.hypot(s.vx, s.vz), p.previous ? Math.hypot(p.previous.vx, p.previous.vz) : 0);
      if (data.speed > recentSpeed + 12) return;
      room.hits[b.id] = now;
      room.hp[b.id] = Math.max(0, room.hp[b.id] - W.damageForImpact(data.speed));
      broadcast(room, { type: 'building', id: b.id, hp: room.hp[b.id], speed: data.speed });
    } else if (data.type === 'trafficHit') {
      const t = room.traffic[data.id], s = p.state;
      if (!Number.isInteger(data.id) || !t || now - p.lastTrafficHit < 200 || Math.hypot(s.x - t.x, s.z - t.z) > 12 || Math.abs(s.y - t.y) > 3 || !numeric(data.nx, -1, 1) || !numeric(data.nz, -1, 1) || !numeric(data.speed, 0, 95)) return;
      const power = Math.min(data.speed, Math.hypot(s.vx - t.vx, s.vz - t.vz) + 8);
      p.lastTrafficHit = now; t.driftX -= data.nx * power * .3; t.driftZ -= data.nz * power * .3; t.speed *= .45; t.stun = 1.6;
    } else if (data.type === 'aura') {
      // Private friend rooms use client stunt scoring, with duplicate/rate/value limits.
      if (!Number.isSafeInteger(data.seq) || data.seq !== p.scoreSeq + 1 || !Number.isSafeInteger(data.points) || data.points <= 0 || data.points > 25000 || now - p.lastScoreAt < 100) return;
      p.scoreSeq = data.seq; p.lastScoreAt = now; p.score = Math.min(1e9, p.score + data.points); announce(room);
    } else if (data.type === 'reset') {
      if (p.id !== room.host) return send(ws, { type: 'error', message: 'Only the room host can rebuild the islands.' });
      if (room.lastReset && now - room.lastReset < 3000) return;
      room.lastReset = now; room.hp.fill(100); room.hits.fill(0); room.traffic = trafficForRoom();
      for (const q of room.players.values()) { q.state = { ...spawn(q.slot), car: q.state.car }; q.previous = null; }
      broadcast(room, { type: 'reset', players: [...room.players.values()].map(q => ({ id: q.id, state: q.state })) });
    } else if (data.type === 'leave') { removePlayer(room, p); send(ws, { type: 'left' }); }
    else if (data.type === 'ping') send(ws, { type: 'pong', at: data.at });
  }
  wss.on('connection', ws => {
    ws.alive = true; ws.lastJoin = 0; ws.count = 0; ws.rateAt = Date.now(); ws.createdAt = Date.now();
    ws.on('pong', () => ws.alive = true);
    ws.on('error', () => {});
    ws.on('message', (raw, binary) => {
      if (Date.now() - ws.rateAt > 1000) { ws.rateAt = Date.now(); ws.count = 0; }
      if (++ws.count > 90 || binary) return ws.close(1008, 'Invalid traffic');
      try { handle(ws, JSON.parse(raw.toString())); } catch { ws.close(1008, 'Invalid message'); }
    });
    ws.on('close', () => {
      const p = ws.player; if (!p || p.ws !== ws) return;
      p.ws = null; p.disconnectedAt = Date.now(); p.state.parked = true; p.state.nitro = false; p.state.vx = p.state.vy = p.state.vz = p.state.speed = 0;
      if (p.room.host === p.id) p.room.host = [...p.room.players.values()].find(q => q.ws)?.id || p.id;
      announce(p.room);
    });
  });
  let tick = 0;
  const timer = setInterval(() => {
    tick++;
    for (const room of rooms.values()) {
      if (![...room.players.values()].some(p => p.ws)) continue;
      W.traffic = room.traffic;
      W.trafficObstacles = [...room.players.values()].map(p => p.state);
      W.stepTraffic(1 / 30);
      if (tick % 2) continue;
      broadcast(room, { type: 'frame', time: Date.now(), players: [...room.players.values()].map(p => ({ id: p.id, name: p.name, connected: !!p.ws, state: p.state })), traffic: room.traffic.map(t => [t.x, t.y, t.z, t.yaw, t.vx, t.vz, t.speed, t.distance]) });
    }
  }, 1000 / 30);
  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const room of rooms.values()) {
      for (const p of room.players.values()) if (!p.ws && now - p.disconnectedAt >= reconnectMs) removePlayer(room, p);
      if (!room.players.size && now - room.emptyAt > emptyMs) rooms.delete(room.code);
    }
    for (const [ip, bucket] of attempts) if (now - bucket.at > 60000) attempts.delete(ip);
    for (const ws of wss.clients) if (!ws.player && now - ws.createdAt > 30000) ws.close(1008, 'Join a room to continue');
  }, 1000);
  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) { if (!ws.alive) { ws.terminate(); continue; } ws.alive = false; ws.ping(); }
  }, 25000);
  return { server, rooms, buildings, close: async () => {
    clearInterval(timer); clearInterval(cleanup); clearInterval(heartbeat);
    for (const ws of wss.clients) ws.terminate();
    await new Promise(resolve => wss.close(resolve));
    await new Promise(resolve => server.close(resolve));
  } };
}
module.exports = { createServer };
if (require.main === module) {
  const app = createServer({ dev: process.env.ISLA_DEV === '1' });
  const port = Number(process.env.PORT) || 3000;
  app.server.listen(port, '0.0.0.0', () => console.log(`ISLA Drive listening on port ${port}`));
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { await app.close(); process.exit(0); });
}
