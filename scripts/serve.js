/**
 * Zero-dependency lightweight HTTP static server for Google Docs Clone.
 * Serves static assets, sets proper MIME types, CORS headers, and provides
 * side-by-side multi-tab collaboration instructions.
 *
 * Usage:
 *   node scripts/serve.js
 *   npm run serve
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const DEFAULT_PORT = parseInt(process.env.PORT, 10) || 8080;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8'
};

const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  underline: '\x1b[4m',
  red: '\x1b[38;2;234;67;53m',
  green: '\x1b[38;2;52;168;83m',
  blue: '\x1b[38;2;66;133;244m',
  yellow: '\x1b[38;2;251;188;5m',
  cyan: '\x1b[38;2;36;194;209m',
  white: '\x1b[38;2;255;255;255m',
  gray: '\x1b[38;2;128;134;139m'
};

function createServer() {
  return http.createServer((req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Cache-Control', 'no-cache, must-revalidate');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { 'Content-Type': 'text/plain' });
      res.end('Method Not Allowed');
      return;
    }

    let decodedUrl;
    try {
      decodedUrl = decodeURIComponent(req.url.split('?')[0].split('#')[0]);
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end('Bad Request');
      return;
    }

    let filePath = path.join(ROOT_DIR, decodedUrl === '/' ? 'index.html' : decodedUrl);

    // Normalize and prevent directory traversal
    const safePath = path.normalize(filePath);
    if (!safePath.startsWith(ROOT_DIR)) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      res.end('Forbidden: Access Denied');
      return;
    }

    fs.stat(safePath, (err, stats) => {
      if (err) {
        if (err.code === 'ENOENT') {
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end(`404 Not Found: "${decodedUrl}"`);
        } else {
          res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end(`500 Internal Server Error: ${err.message}`);
        }
        return;
      }

      let targetFile = safePath;
      if (stats.isDirectory()) {
        targetFile = path.join(safePath, 'index.html');
      }

      const ext = path.extname(targetFile).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';

      fs.readFile(targetFile, (readErr, content) => {
        if (readErr) {
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end(`404 Not Found: File not readable`);
          return;
        }

        res.writeHead(200, {
          'Content-Type': contentType,
          'Content-Length': Buffer.byteLength(content)
        });

        if (req.method === 'HEAD') {
          res.end();
        } else {
          res.end(content);
        }
      });
    });
  });
}

function printInstructions(port) {
  const host = `http://localhost:${port}`;
  const roomId = 'room_collab_alpha';

  console.log(`\n${c.blue}${c.bold}╔══════════════════════════════════════════════════════════════════════════════════════╗${c.reset}`);
  console.log(`${c.blue}${c.bold}║                       GOOGLE DOCS CLONE — LOCAL DEV SERVER                           ║${c.reset}`);
  console.log(`${c.blue}${c.bold}╚══════════════════════════════════════════════════════════════════════════════════════╝${c.reset}\n`);

  console.log(`  ${c.green}${c.bold}🚀 Application Server is running at:${c.reset}  ${c.cyan}${c.bold}${c.underline}${host}/${c.reset}\n`);

  console.log(`  ${c.bold}👥 HOW TO TEST REAL-TIME 2-PERSON (OR 3-PERSON) COLLABORATION SIDE-BY-SIDE:${c.reset}`);
  console.log(`  ${c.gray}Open two (or three) browser windows side-by-side using the URLs below:${c.reset}\n`);

  console.log(`  ${c.red}${c.bold}1. Tab 1 (Alice • Owner / Lead):${c.reset}`);
  console.log(`     ${c.cyan}${host}/#doc=${roomId}&role=owner&user=Alice${c.reset}\n`);

  console.log(`  ${c.green}${c.bold}2. Tab 2 (Bob • Editor):${c.reset}`);
  console.log(`     ${c.cyan}${host}/#doc=${roomId}&role=editor&user=Bob${c.reset}\n`);

  console.log(`  ${c.yellow}${c.bold}3. Tab 3 (Charlie • Viewer / Reviewer):${c.reset}`);
  console.log(`     ${c.cyan}${host}/#doc=${roomId}&role=viewer&user=Charlie${c.reset}\n`);

  console.log(`  ${c.bold}✨ FEATURES TO TEST LIVE:${c.reset}`);
  console.log(`     • ${c.bold}Concurrent Typing:${c.reset} Type simultaneously in Alice & Bob tabs; verify zero dropped text.`);
  console.log(`     • ${c.bold}Remote Cursors:${c.reset} Move cursor / select text in Tab 1; see colored flags appear in Tab 2.`);
  console.log(`     • ${c.bold}Threaded Comments:${c.reset} Select text in Tab 1, click Add Comment; see badge appear live in Tab 2 and reply.`);
  console.log(`     • ${c.bold}Permission Elevation:${c.reset} In Tab 3 (Charlie / Viewer), click Request Edit Access; approve from Alice's toast.`);
  console.log(`     • ${c.bold}Rich Tables & Ruler:${c.reset} Insert 3x3 table, drag ruler margins, toggle Dark Mode.\n`);

  console.log(`  ${c.dim}Press Ctrl+C at any time to stop the server.${c.reset}\n`);
}

function startServer(port = DEFAULT_PORT, attempt = 0) {
  if (attempt >= 10) {
    console.error(`${c.red}Could not find an open port after 10 attempts. Exiting.${c.reset}`);
    process.exit(1);
  }

  const server = createServer();

  server.once('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`  ${c.yellow}⚠️  Port ${port} in use, attempting port ${port + 1}...${c.reset}`);
      startServer(port + 1, attempt + 1);
    } else {
      console.error(`${c.red}Server error:${c.reset}`, err);
      process.exit(1);
    }
  });

  server.listen(port, () => {
    printInstructions(port);
  });
}

// Start server
startServer();
