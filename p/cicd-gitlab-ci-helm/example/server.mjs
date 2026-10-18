import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';

export function makeServer() {
  return createServer((req, res) => {
    const known = ['/', '/healthz', '/readyz'].includes(req.url);
    res.writeHead(known ? 200 : 404, { 'content-type': 'application/json' });
    res.end(JSON.stringify(known
      ? { status: 'ok', version: process.env.APP_VERSION || 'local' }
      : { error: 'not found' }));
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const server = makeServer();
  server.listen(Number(process.env.PORT || 3000), '0.0.0.0');
  process.on('SIGTERM', () => server.close());
}
