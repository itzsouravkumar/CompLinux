import { createHash, timingSafeEqual } from 'node:crypto';

const digest = (value) => createHash('sha256').update(value).digest();

const privateHeaders = {
  'Cache-Control': 'private, no-store',
  'X-Content-Type-Options': 'nosniff',
  'Content-Security-Policy': "sandbox; default-src 'none'",
  'Vary': 'Authorization',
};

export function createPrivateDownload(readBlob, readSecret) {
  return async (request) => {
    const head = request.method === 'HEAD';
    const reply = (status, body, headers = {}) =>
      new Response(head ? null : body, {
        status,
        headers: { ...privateHeaders, 'Content-Type': 'text/plain; charset=utf-8', ...headers },
      });

    if (request.method !== 'GET' && !head) {
      return reply(405, 'Method not allowed\n', { Allow: 'GET, HEAD' });
    }

    const secret = readSecret();
    if (!secret || !/^[a-f0-9]{64}$/.test(secret)) {
      return reply(503, 'Private downloads are unavailable\n');
    }
    const authorization = request.headers.get('authorization') ?? '';
    if (!timingSafeEqual(digest(authorization), digest(`Bearer ${secret}`))) {
      return reply(401, 'Unauthorized\n', { 'WWW-Authenticate': 'Bearer realm="private-files"' });
    }

    const params = new URL(request.url).searchParams.getAll('file');
    const key = params[0];
    if (params.length !== 1 || !key || key.length > 900 ||
        !/^[A-Za-z0-9][A-Za-z0-9._-]*(?:\/[A-Za-z0-9][A-Za-z0-9._-]*)*$/.test(key)) {
      return reply(404, 'File not found\n');
    }

    try {
      const blob = await readBlob(key);
      if (!blob) return reply(404, 'File not found\n');

      if (head) await blob.stream.cancel();
      const filename = key.split('/').at(-1);
      return reply(200, blob.stream, {
        'Content-Type': blob.blob.contentType || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${filename}"`,
      });
    } catch {
      return reply(502, 'Private storage is unavailable\n');
    }
  };
}
