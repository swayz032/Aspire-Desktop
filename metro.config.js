const { getDefaultConfig } = require('expo/metro-config');
const http = require('http');

const config = getDefaultConfig(__dirname);

config.server = {
  ...config.server,
  port: 5000,
  host: '0.0.0.0',
  enhanceMiddleware: (middleware) => {
    return (req, res, next) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.removeHeader('X-Frame-Options');
      
      if (req.url && (req.url.startsWith('/api') || req.url.startsWith('/objects'))) {
        const options = {
          hostname: 'localhost',
          port: 3001,
          path: req.url,
          method: req.method,
          headers: { ...req.headers, host: 'localhost:3001' },
        };
        
        const proxyReq = http.request(options, (proxyRes) => {
          res.writeHead(proxyRes.statusCode, proxyRes.headers);
          proxyRes.pipe(res);
        });
        
        proxyReq.on('error', (err) => {
          console.error('Proxy error:', err.message);
          res.writeHead(502);
          res.end('Bad Gateway');
        });
        
        req.pipe(proxyReq);
        return;
      }
      
      return middleware(req, res, next);
    };
  },
};

config.watcher = {
  ...config.watcher,
  watchman: {
    enabled: false,
  },
};

module.exports = config;
