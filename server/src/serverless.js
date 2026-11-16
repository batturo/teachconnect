// Runs the API on platforms that have no long-running server or persistent disk
// (Netlify Functions). The SQLite file lives in /tmp and is copied to and from an
// object store, so every instance sees the latest saved copy.
//
// This suits a demo or a low-traffic site. Two writes landing on different instances
// at the same moment can overwrite each other; for real traffic run `npm start` on a
// host with a disk, where SQLite is used directly.
import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync, rmSync } from 'node:fs';

const KEY = 'teachconnect.db';

// `store` needs get/getMetadata/set in the shape of @netlify/blobs.
export function createHandler(store, { dbFile = '/tmp/teachconnect.db', seed = true } = {}) {
  let mods, base, etag = null, lastLifecycle = 0;

  async function start() {
    // The signing secret is created once and shared by all instances.
    await store.set('jwt-secret', randomBytes(48).toString('hex'), { onlyIfNew: true });
    process.env.JWT_SECRET = await store.get('jwt-secret');
    process.env.DB_PATH = dbFile;
    process.env.DB_JOURNAL_MODE = 'DELETE';

    const saved = await store.getWithMetadata(KEY, { type: 'arrayBuffer' });
    rmSync(dbFile, { force: true });
    if (saved) { writeFileSync(dbFile, Buffer.from(saved.data)); etag = saved.etag; }

    const [db, { app }, lifecycle] = await Promise.all([import('./db.js'), import('./app.js'), import('./lifecycle.js')]);
    mods = { db, lifecycle };
    const server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
    server.unref(); // do not keep the process alive on its own
    base = `http://127.0.0.1:${server.address().port}`;

    if (!saved) {
      if (seed) await (await import('./seed.js')).seedDemo(`${base}/api`);
      await save();
    }
  }

  async function save() {
    etag = (await store.set(KEY, readFileSync(dbFile))).etag ?? (await store.getMetadata(KEY)).etag;
  }

  // Another instance may have written since we last looked: reload its copy.
  async function refresh() {
    const meta = await store.getMetadata(KEY);
    if (!meta || meta.etag === etag) return;
    const saved = await store.getWithMetadata(KEY, { type: 'arrayBuffer' });
    mods.db.closeDb();
    writeFileSync(dbFile, Buffer.from(saved.data));
    mods.db.openDb();
    etag = saved.etag;
  }

  let ready;
  return async function handler(request, clientIp) {
    if (!ready) ready = start().catch((e) => { ready = null; throw e; });
    const first = !mods;
    await ready;
    if (!first) await refresh();

    // There is no background scheduler here, so the vacancy check runs with requests.
    if (Date.now() - lastLifecycle > 60 * 60 * 1000) {
      lastLifecycle = Date.now();
      const r = mods.lifecycle.runVacancyLifecycle();
      if (r.reminded || r.outdated) await save();
    }

    const url = new URL(request.url);
    const write = !['GET', 'HEAD'].includes(request.method);
    const headers = { 'x-forwarded-for': clientIp || '' };
    for (const h of ['content-type', 'authorization']) if (request.headers.get(h)) headers[h] = request.headers.get(h);
    const res = await fetch(base + url.pathname + url.search, {
      method: request.method, headers, body: write ? await request.arrayBuffer() : undefined,
    });
    const body = await res.arrayBuffer();
    if (write && res.ok) await save();
    return new Response(body, {
      status: res.status,
      headers: { 'content-type': res.headers.get('content-type') || 'application/json', 'cache-control': 'no-store' },
    });
  };
}
