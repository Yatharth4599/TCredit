import { Router } from 'express';
import { openApiSpec } from '../../config/openapi.js';

const router = Router();

// GET /api/docs -- Swagger UI (loads from CDN)
router.get('/', (_req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Krexa API Docs</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
  <style>
    body { margin: 0; background: #1a1a2e; }
    .swagger-ui .topbar { display: none; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    SwaggerUIBundle({
      url: '/api/v1/docs/openapi.json',
      dom_id: '#swagger-ui',
      deepLinking: true,
      layout: 'BaseLayout',
    });
  </script>
</body>
</html>`);
});

// GET /api/v1/docs/openapi.json -- raw spec
router.get('/openapi.json', (_req, res) => {
  res.json(openApiSpec);
});

export default router;
