import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { makeServer } from './server.mjs';

test('HTTP routes return health, version, and a real 404', async (t) => {
  const server = makeServer().listen(0, '127.0.0.1');
  t.after(() => new Promise((resolve) => server.close(resolve)));
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  for (const route of ['/', '/healthz', '/readyz']) {
    const response = await fetch(base + route);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: 'ok', version: process.env.APP_VERSION || 'local' });
  }
  assert.equal((await fetch(base + '/missing')).status, 404);
});
