const { getDefaultConfig } = require('expo/metro-config');
const http = require('http');

const config = getDefaultConfig(__dirname);

// Metro dev server runs on 5000 (browser URL).
// Custom API server runs on SERVER_PORT (default 5001) — separate process.
// Production: custom server alone on 5000 (no Metro).
const SERVER_PORT = parseInt(process.env.SERVER_PORT || '5001', 10);

config.server = {
  ...config.server,
  port: 5000,
  host: '0.0.0.0',
  enhanceMiddleware: (middleware) => {
    return (req, res, next) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Suite-Id, X-Trace-Id, X-Correlation-Id, X-Office-Id, Accept');
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.removeHeader('X-Frame-Options');

      // Handle CORS preflight
      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      // Proxy /api and /objects to the custom server on SERVER_PORT
      if (req.url && (req.url.startsWith('/api') || req.url.startsWith('/objects'))) {
        const options = {
          hostname: 'localhost',
          port: SERVER_PORT,
          path: req.url,
          method: req.method,
          headers: { ...req.headers, host: `localhost:${SERVER_PORT}` },
        };

        const proxyReq = http.request(options, (proxyRes) => {
          res.writeHead(proxyRes.statusCode, proxyRes.headers);
          proxyRes.pipe(res);
        });

        proxyReq.on('error', (err) => {
          console.error(`Proxy error (-> localhost:${SERVER_PORT}):`, err.message);
          res.writeHead(502);
          res.end('Bad Gateway — is the server running? Run: npm start');
        });

        req.pipe(proxyReq);
        return;
      }

      return middleware(req, res, next);
    };
  },
};

// Proxy WebSocket upgrade requests (/ws/*) to the custom server.
// Metro's enhanceMiddleware only handles HTTP; WS upgrades need the 'upgrade' event.
// We monkey-patch http.Server.prototype.listen to attach the handler after Metro creates its server.
const originalListen = http.Server.prototype.listen;
http.Server.prototype.listen = function (...args) {
  this.on('upgrade', (req, socket, head) => {
    if (req.url && req.url.startsWith('/ws')) {
      const proxyReq = http.request({
        hostname: 'localhost',
        port: SERVER_PORT,
        path: req.url,
        method: req.method,
        headers: { ...req.headers, host: `localhost:${SERVER_PORT}` },
      });

      proxyReq.on('upgrade', (proxyRes, proxySocket, proxyHead) => {
        // Send the 101 Switching Protocols response back to the client
        socket.write(
          `HTTP/1.1 101 Switching Protocols\r\n` +
          Object.entries(proxyRes.headers)
            .map(([k, v]) => `${k}: ${v}`)
            .join('\r\n') +
          '\r\n\r\n'
        );
        if (proxyHead.length) socket.write(proxyHead);
        proxySocket.pipe(socket);
        socket.pipe(proxySocket);
      });

      proxyReq.on('error', (err) => {
        console.error(`WS proxy error (-> localhost:${SERVER_PORT}):`, err.message);
        socket.destroy();
      });

      proxyReq.end();
    }
    // Non-/ws upgrades: let Metro handle (HMR WebSocket)
  });
  return originalListen.apply(this, args);
};

config.watcher = {
  ...config.watcher,
  watchman: {
    enabled: false,
  },
};

module.exports = config;
