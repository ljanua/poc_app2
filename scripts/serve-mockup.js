const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const host = process.env.MOCKUP_HOST || '127.0.0.1';
const port = Number(process.env.MOCKUP_PORT || 5500);
const root = path.join(process.cwd(), 'docs', 'ux', 'mockup');

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon'
};

function send(res, status, body, contentType) {
  res.writeHead(status, { 'Content-Type': contentType || 'text/plain; charset=utf-8' });
  res.end(body);
}

function resolveTarget(urlPath) {
  if (urlPath === '/' || urlPath === '') {
    return path.join(root, 'index.html');
  }

  const cleanPath = decodeURIComponent(urlPath.split('?')[0]);
  const normalized = cleanPath.replace(/^\/+/, '');

  if (!path.extname(normalized)) {
    const htmlCandidate = path.join(root, `${normalized}.html`);
    if (fs.existsSync(htmlCandidate) && fs.statSync(htmlCandidate).isFile()) {
      return htmlCandidate;
    }
  }

  const filePath = path.join(root, normalized);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    return path.join(filePath, 'index.html');
  }

  return filePath;
}

function isInsideRoot(filePath) {
  const rel = path.relative(root, filePath);
  return rel && !rel.startsWith('..') && !path.isAbsolute(rel);
}

if (!fs.existsSync(root)) {
  console.error(`Mockup root missing: ${root}`);
  process.exit(1);
}

const server = http.createServer((req, res) => {
  const target = resolveTarget(req.url || '/');

  if (!isInsideRoot(target) && target !== path.join(root, 'index.html')) {
    send(res, 403, 'Forbidden');
    return;
  }

  fs.readFile(target, (err, data) => {
    if (err) {
      send(res, 404, 'Not Found');
      return;
    }

    const ext = path.extname(target).toLowerCase();
    send(res, 200, data, mimeTypes[ext] || 'application/octet-stream');
  });
});

server.listen(port, host, () => {
  console.log(`Mockup server running at http://${host}:${port}`);
  console.log('Supported routes: /, /S0-login, /S1-player-list, /S2-player-dashboard, /S3-team-management, /S4-video-capture, /S6-assessment-list, /S7-admin-user-management');
});
