process.env.NODE_ENV = 'test';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, copyFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createHandler } from '../src/serverless.js';

// Minimal stand-in for a @netlify/blobs store.
function fakeStore() {
  const items = new Map();
  let n = 0;
  return {
    items,
    async set(key, value, { onlyIfNew } = {}) {
      if (onlyIfNew && items.has(key)) return { modified: false };
      const etag = `"v${++n}"`;
      items.set(key, { value: typeof value === 'string' ? value : Buffer.from(value), etag });
      return { modified: true, etag };
    },
    async get(key) { return items.get(key)?.value ?? null; },
    async getMetadata(key) { const i = items.get(key); return i ? { etag: i.etag, metadata: {} } : null; },
    async getWithMetadata(key) { const i = items.get(key); return i ? { data: i.value, etag: i.etag, metadata: {} } : null; },
  };
}

test('serverless handler seeds, persists writes and picks up newer copies', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'tc-'));
  const store = fakeStore();
  const handler = createHandler(store, { dbFile: join(dir, 'live.db') });
  const call = async (method, path, token, body) => {
    const res = await handler(new Request(`https://site.example${path}`, {
      method, body: body && JSON.stringify(body),
      headers: { 'content-type': 'application/json', ...(token && { authorization: `Bearer ${token}` }) },
    }), '203.0.113.9');
    return { status: res.status, body: await res.json() };
  };

  // First request starts the app, seeds demo data and saves it.
  const login = await call('POST', '/api/auth/login', null, { email: 'teacher@demo.com', password: 'password123' });
  assert.equal(login.status, 200);
  assert.ok(store.items.has('teachconnect.db'));
  const token = login.body.token;
  assert.equal((await call('GET', '/api/vacancies?eligible=1', token)).body.length, 1);

  // A write is saved to the store.
  const before = store.items.get('teachconnect.db').etag;
  const vacancy = (await call('GET', '/api/vacancies?q=TGT', token)).body[0];
  assert.equal((await call('POST', `/api/vacancies/${vacancy.id}/apply`, token, {})).status, 201);
  assert.notEqual(store.items.get('teachconnect.db').etag, before);
  // Reads and failed writes do not save.
  const afterApply = store.items.get('teachconnect.db').etag;
  assert.equal((await call('POST', `/api/vacancies/${vacancy.id}/apply`, token, {})).status, 409);
  assert.equal(store.items.get('teachconnect.db').etag, afterApply);

  // Another instance changes the saved copy: the next request must see it.
  const other = join(dir, 'other.db');
  copyFileSync(join(dir, 'live.db'), other);
  const otherDb = new DatabaseSync(other);
  otherDb.exec("UPDATE vacancies SET title = 'Changed elsewhere' WHERE id = " + Number(vacancy.id));
  otherDb.close();
  await store.set('teachconnect.db', readFileSync(other));
  assert.equal((await call('GET', `/api/vacancies/${vacancy.id}`, token)).body.title, 'Changed elsewhere');
  assert.equal((await call('GET', '/api/applications', token)).body.length, 1);
});
