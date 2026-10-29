const express = require('express');
const path = require('node:path');
const http = require('node:http');
for (const [name, port] of [['customer', 5183], ['admin', 5184], ['technician', 5185]]) {
  const app = express();
  const root = path.join(__dirname, 'apps', `${name}-pwa`, 'dist');
  app.use('/api', (req, res) => {
    const upstream = http.request({
      hostname: '127.0.0.1', port: 3001,
      path: req.originalUrl, method: req.method,
      headers: { ...req.headers, host: 'localhost:3001' },
    }, (response) => {
      res.writeHead(response.statusCode, response.headers);
      response.pipe(res);
    });
    upstream.on('error', () => {
      if (!res.headersSent) res.status(503).json({ error: 'Backend is unavailable. Please try again shortly.' });
      else res.destroy();
    });
    req.pipe(upstream);
  });
  app.use(express.static(root));
  app.use((_req, res) => res.sendFile(path.join(root, 'index.html')));
  app.listen(port, '127.0.0.1', () => console.log(`${name}: http://localhost:${port}`));
}
