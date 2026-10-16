'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { WebSocket } = require('ws');
const { createServer } = require('../server.cjs');
let app, url, wsURL;
const clients = [];
const delay = ms => new Promise(r => setTimeout(r, ms));
before(async () => {
  app = createServer({ reconnectMs: 1200, emptyMs: 50 });
  await new Promise(r => app.server.listen(0, '127.0.0.1', r));
  url = 'http://127.0.0.1:' + app.server.address().port; wsURL = url.replace('http:', 'ws:') + '/ws';
});
after(async () => { for (const c of clients) c.ws.terminate(); await app.close(); });
async function client() {
  const ws = new WebSocket(wsURL), messages = [];
  ws.on('message', bytes => messages.push(JSON.parse(bytes)));
  ws.on('error', () => {});
  await new Promise((resolve, reject) => { ws.once('open', resolve); ws.once('error', reject); });
  const c = { ws, messages, send: data => ws.send(JSON.stringify(data)), wait: async (type, predicate = () => true) => {
    const end = Date.now() + 3000;
    while (Date.now() < end) { const match = messages.find(m => m.type === type && predicate(m)); if (match) return match; await delay(10); }
    throw Error('Timed out waiting for ' + type);
  } };
  clients.push(c); return c;
}
async function create(name = 'Host') { const c = await client(); c.send({ type: 'create', v: 1, name }); c.welcome = await c.wait('welcome'); return c; }
async function join(code, name = 'Friend') { const c = await client(); c.send({ type: 'join', v: 1, name, code }); c.welcome = await c.wait('welcome'); return c; }

test('serves the game and health check; keeps source, secrets, and development scenarios private', async () => {
  assert.deepEqual(await (await fetch(url + '/healthz')).json(), { ok: true });
  const game = await fetch(url); assert.equal(game.status, 200); assert.match(await game.text(), /PLAY WITH FRIENDS/);
  for (const file of ['/server.cjs', '/package.json', '/.env', '/qa.html', '/qa.js', '/%2e%2e%2fserver.cjs']) assert.equal((await fetch(url + file)).status, 404, file);
  assert.equal((await fetch(url, { method: 'POST' })).status, 405);
});
test('private codes, four-player cap, unknown codes, and isolated rooms', async () => {
  const a = await create(), code = a.welcome.code;
  assert.match(code, /^[A-HJ-NP-Z2-9]{6}$/);
  const friends = await Promise.all([join(code, 'Two'), join(code, 'Three'), join(code, 'Four')]);
  await a.wait('roster', m => m.players.length === 4);
  const extra = await client(); extra.send({ type: 'join', v: 1, name: 'Five', code }); assert.match((await extra.wait('error')).message, /full/);
  const unknown = await client(); unknown.send({ type: 'join', v: 1, name: 'Lost', code: 'AAAAAA' }); assert.match((await unknown.wait('error')).message, /not found/);
  const other = await create('Separate'); assert.notEqual(other.welcome.code, code); assert.equal(other.welcome.players.length, 1);
  friends[0].send({ type: 'leave' }); await a.wait('roster', m => m.players.length === 3);
  const replacement = await join(code, 'Replacement'); assert.equal(replacement.welcome.players.length, 4);
});
test('live car pose, nitro, water state, and one shared traffic simulation', async () => {
  const a = await create(), b = await join(a.welcome.code);
  const state = { ...a.welcome.state, x: 35, y: 45, z: 700, car: 'solstice', vx: 50, speed: 50, nitro: true, grounded: false, water: 'skimming' };
  a.send({ type: 'state', state });
  const frame = await b.wait('frame', m => m.players.find(p => p.id === a.welcome.id)?.state.car === 'solstice');
  const remote = frame.players.find(p => p.id === a.welcome.id).state;
  assert.equal(remote.x, 35); assert.equal(remote.nitro, true); assert.equal(remote.water, 'skimming'); assert.equal(remote.grounded, false);
  const same = await a.wait('frame', m => m.time === frame.time);
  assert.deepEqual(same.traffic, frame.traffic); assert.equal(frame.traffic.length, 18);
  a.send({ type: 'state', state: { ...state, x: null, car: 'hacked' } });
  await delay(100); assert.equal(app.rooms.get(a.welcome.code).players.get(a.welcome.id).state.x, 35);
});
test('damage is shared, requires proximity and repeated impacts, and reaches late joiners; only host resets', async () => {
  const a = await create(), b = await join(a.welcome.code), room = app.rooms.get(a.welcome.code), building = app.buildings[0];
  a.send({ type: 'hit', id: 0, speed: 50 }); await delay(100); assert.equal(room.hp[0], 100);
  a.send({ type: 'state', state: { ...a.welcome.state, x: building.x, y: building.y + .12, z: building.z + building.d / 2 + 3, vx: 35, speed: 35 } });
  a.send({ type: 'hit', id: 0, speed: 35 }); assert.equal((await b.wait('building')).hp, 57);
  a.send({ type: 'hit', id: 0, speed: 35 }); await delay(100); assert.equal(room.hp[0], 57);
  await delay(650); a.send({ type: 'hit', id: 0, speed: 35 }); await b.wait('building', m => m.hp === 14);
  await delay(720); a.send({ type: 'hit', id: 0, speed: 35 }); await b.wait('building', m => m.hp === 0);
  const late = await join(a.welcome.code, 'Late'); assert.equal(late.welcome.hp[0], 0);
  const separate = await create(); assert.equal(separate.welcome.hp[0], 100);
  b.send({ type: 'reset' }); assert.match((await b.wait('error')).message, /host/); assert.equal(room.hp[0], 0);
  a.send({ type: 'reset' }); await b.wait('reset'); assert.equal(room.hp[0], 100);
  assert(!JSON.stringify(late.welcome.players).includes('token'));
});
test('session aura cannot duplicate awards; reconnect restores identity/score; host transfers', async () => {
  const a = await create('Host'), b = await join(a.welcome.code, '<Friend>');
  assert.equal(b.welcome.players.find(p => p.id === b.welcome.id).name, 'Friend');
  a.send({ type: 'aura', seq: 1, points: 1200 }); await b.wait('roster', m => m.players.some(p => p.score === 1200));
  await delay(110); a.send({ type: 'aura', seq: 1, points: 1200 }); a.send({ type: 'aura', seq: 2, points: 999999 });
  await delay(110); assert.equal(app.rooms.get(a.welcome.code).players.get(a.welcome.id).score, 1200);
  a.ws.close(); await b.wait('roster', m => m.host === b.welcome.id);
  const resumed = await client(); resumed.send({ type: 'resume', v: 1, code: a.welcome.code, token: a.welcome.token, name: 'Host' });
  const welcome = await resumed.wait('welcome'); assert.equal(welcome.id, a.welcome.id); assert.equal(welcome.resumed, true); assert.equal(welcome.scoreSeq, 1); assert.equal(welcome.players.find(p => p.id === welcome.id).score, 1200);
  const wrong = await client(); wrong.send({ type: 'resume', v: 1, code: a.welcome.code, token: 'not-a-token', name: 'Fake' }); assert.equal((await wrong.wait('error')).expired, true);
  resumed.ws.close(); await delay(2300);
  assert(!app.rooms.get(a.welcome.code).players.has(a.welcome.id));
});
test('malformed, oversized, cross-origin, and excessive messages are rejected without crashing', async () => {
  for (const payload of ['{broken', 'x'.repeat(9000)]) {
    const c = await client(); const closed = new Promise(resolve => c.ws.once('close', resolve)); c.ws.send(payload); assert([1008, 1009].includes(await closed));
  }
  const c = await client(); const closed = new Promise(resolve => c.ws.once('close', resolve)); for (let i = 0; i < 95; i++) c.send({ type: 'ping' }); assert.equal(await closed, 1008);
  const evil = new WebSocket(wsURL, { origin: 'https://unrelated.example' });
  await new Promise(resolve => { evil.on('error', resolve); evil.on('open', () => { evil.terminate(); assert.fail('Cross-origin connection accepted'); }); });
  assert.equal((await fetch(url + '/healthz')).status, 200);
});
