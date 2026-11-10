import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createPrivateDownload } from '../lib/private-download.mjs';

const token = 'ab'.repeat(32);
const bytes = new Uint8Array([0, 255, 10, 42]);

function fixture(secret = token) {
  const reads = [];
  const download = createPrivateDownload(async (key) => {
    reads.push(key);
    if (key === 'offline.txt') throw new Error('Storage failure');
    if (key !== 'notes/sample.zip') return null;
    return {
      blob: { contentType: 'application/zip' },
      stream: new Response(bytes).body,
    };
  }, () => secret);

  function request(file, { authorization = `Bearer ${token}`, method = 'GET' } = {}) {
    const headers = authorization ? { Authorization: authorization } : {};
    return download(new Request(`https://repo.example/api/private?${file}`, { method, headers }));
  }

  return { reads, request };
}

test('private download preserves raw bytes, MIME type and no-store headers', async () => {
  const { reads, request } = fixture();
  const response = await request('file=notes%2Fsample.zip');
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'application/zip');
  assert.equal(response.headers.get('content-disposition'), 'attachment; filename="sample.zip"');
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.equal(response.headers.get('vary'), 'Authorization');
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), bytes);
  assert.deepEqual(reads, ['notes/sample.zip']);
});

test('private HEAD and unsupported methods have appropriate responses', async () => {
  const { reads, request } = fixture();
  const head = await request('file=notes/sample.zip', { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
  assert.equal(head.headers.get('content-type'), 'application/zip');
  const post = await request('file=notes/sample.zip', { method: 'POST' });
  assert.equal(post.status, 405);
  assert.equal(post.headers.get('allow'), 'GET, HEAD');
  assert.deepEqual(reads, ['notes/sample.zip']);
});

test('missing and wrong bearer tokens never reach storage', async () => {
  const { reads, request } = fixture();
  for (const authorization of ['', 'Bearer wrong', `Basic ${token}`]) {
    const response = await request('file=notes/sample.zip', { authorization });
    assert.equal(response.status, 401);
    assert.match(response.headers.get('www-authenticate'), /^Bearer/);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
  }
  assert.deepEqual(reads, []);
});

test('malformed paths and duplicate query parameters never reach storage', async () => {
  const { reads, request } = fixture();
  for (const query of ['file=..%2F.env', 'file=%2Fetc%2Fpasswd', 'file=x&file=y', 'file=x%5Cy', 'file=']) {
    assert.equal((await request(query)).status, 404);
  }
  assert.deepEqual(reads, []);
});

test('misconfigured auth fails closed and storage errors are distinct from missing files', async () => {
  const disabled = fixture('');
  assert.equal((await disabled.request('file=notes/sample.zip')).status, 503);
  assert.deepEqual(disabled.reads, []);
  const { request } = fixture();
  assert.equal((await request('file=missing.txt')).status, 404);
  assert.equal((await request('file=offline.txt')).status, 502);
});
