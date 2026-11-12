import { defineConfig } from 'astro/config';
import { getPublicAgentStatus, runEduNodAgent } from './src/server/agent-runtime.mjs';

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) {
        req.destroy();
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

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

function attachAgentMiddleware(server) {
  const handler = async (req, res, next) => {
    const url = (req.url || '').split('?')[0].replace(/\/+$/, '');
    if (url === '/api/agent/status' && req.method === 'GET') {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify(getPublicAgentStatus(extractCustomHeaders(req))));
      return;
    }
    if (url === '/api/agent/run' && req.method === 'POST') {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      try {
        const body = await readJsonBody(req);
        const result = await runEduNodAgent(body, extractCustomHeaders(req));
        res.statusCode = 200;
        res.end(JSON.stringify(result));
      } catch (err) {
        res.statusCode = 400;
        res.end(JSON.stringify({ ok: false, error: err?.message || 'Agent error' }));
      }
      return;
    }
    next();
  };

  // Prepend at the front of Connect middleware stack so it runs before Astro's static/trailingSlash router
  if (Array.isArray(server.middlewares.stack)) {
    server.middlewares.stack.unshift({ route: '', handle: handler });
  } else {
    server.middlewares.use(handler);
  }
}

export default defineConfig({
  output: 'static',
  trailingSlash: 'ignore',
  build: { format: 'directory', inlineStylesheets: 'never' },
  devToolbar: { enabled: false },
  vite: {
    plugins: [
      {
        name: 'edunod-live-agent-vite-middleware',
        configureServer(server) {
          attachAgentMiddleware(server);
        },
      },
    ],
  },
});
