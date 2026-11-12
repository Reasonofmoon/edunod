// Standalone Production Server for EduNod (Serves static dist/ + Live Agent API /api/agent/*)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { getPublicAgentStatus, runEduNodAgent } from './src/server/agent-runtime.mjs';

const PORT = Number(process.env.PORT || 4321);
const distDir = path.resolve('dist');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

function extractCustomHeaders(req) {
  const h = req.headers || {};
  return {
    geminiKey: h['x-edunod-gemini-key'] || '',
    anthropicKey: h['x-edunod-anthropic-key'] || '',
    openaiKey: h['x-edunod-openai-key'] || '',
    openrouterKey: h['x-edunod-openrouter-key'] || '',
    localUrl: h['x-edunod-local-url'] || '',
    localModel: h['x-edunod-local-model'] || '',
  };
}

const server = http.createServer((req, res) => {
  const rawPath = (req.url || '/').split('?')[0];
  const apiPath = rawPath.replace(/\/+$/, '');

  if (apiPath === '/api/agent/status' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(getPublicAgentStatus(extractCustomHeaders(req))));
    return;
  }

  if (apiPath === '/api/agent/run' && req.method === 'POST') {
    let raw = '';
    req.on('data', (c) => {
      raw += c;
    });
    req.on('end', async () => {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      try {
        const body = raw ? JSON.parse(raw) : {};
        const result = await runEduNodAgent(body, extractCustomHeaders(req));
        res.writeHead(200);
        res.end(JSON.stringify(result));
      } catch (err) {
        res.writeHead(400);
        res.end(JSON.stringify({ ok: false, error: err?.message || 'Agent error' }));
      }
    });
    return;
  }

  let filePath = path.join(distDir, rawPath);
  if (rawPath.endsWith('/')) filePath = path.join(filePath, 'index.html');
  else if (!path.extname(filePath) && fs.existsSync(path.join(filePath, 'index.html'))) {
    filePath = path.join(filePath, 'index.html');
  }

  if (!filePath.startsWith(distDir) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 Not Found');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(res);
});

server.listen(PORT, () => {
  console.log(`EduNod Live Server running at http://localhost:${PORT}/`);
});
