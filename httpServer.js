const http = require('http');
const fs = require('fs');
const path = require('path');
const { lookup } = require('mime-types');
const https = require('https');
const httpLib = require('http');
const { getSock, fetchWebhookURL, st } = require('./bot');
const { downloadFile, downloadFileStream } = require('./utils');

function startHttpServer() {
  http.createServer(async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      return res.end();
    }

    if (req.url === '/state') {
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true, state: st }));
    }
    
    if (req.url === '/refresh') {
      try {
        await fetchWebhookURL();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, refreshed: true, newState: st}));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.toString() }));
      }
      return;
    }
    
    if (req.url === '/qr') {
      const filePath = path.join(__dirname, 'qr.png');
      if (fs.existsSync(filePath)) {
        res.writeHead(200, { 'Content-Type': 'image/png' });
        return fs.createReadStream(filePath).pipe(res);
      } else {
        res.writeHead(404);
        return res.end('QR not ready');
      }
    }

    if (req.url === '/api/send' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => (body += chunk));
      req.on('end', async () => {
        try {
          const { to, message } = JSON.parse(body);
          const sock = getSock();
          if (!sock) throw 'Bot not connected';
          await sock.sendMessage(to, { text: message });
          res.end(JSON.stringify({ ok: true, sent: true }));
        } catch (err) {
          res.writeHead(500);
          res.end(JSON.stringify({ error: err.toString() }));
        }
      });
      return;
    }

    // API: /api/sendPhoto (POST) — Send image with caption
    if (req.url === '/api/sendPhoto' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => (body += chunk));
      req.on('end', async () => {
         try {
           const { to, fileUrl, caption = '' } = JSON.parse(body);
           const sock = getSock();
           if (!sock) throw 'Bot not connected';

           const buffer = await downloadFile(fileUrl);
           await sock.sendMessage(to, {
             image: buffer,
             caption
           });

           res.end(JSON.stringify({ ok: true, sent: true }));
         } catch (err) {
           res.writeHead(500);
           res.end(JSON.stringify({ error: err.toString() }));
         }
      });
      return;
    }

    // API: /api/sendVideo (POST) — Send video with caption
    if (req.url === '/api/sendVideo' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => (body += chunk));
      req.on('end', async () => {
         try {
           const { to, fileUrl, caption = '' } = JSON.parse(body);
           const sock = getSock();
           if (!sock) throw 'Bot not connected';

           const buffer = await downloadFile(fileUrl);
           await sock.sendMessage(to, {
              video: buffer,
              caption,
              mimetype: 'video/mp4' // or autodetect using mime-types
           });

           res.end(JSON.stringify({ ok: true, sent: true }));
         } catch (err) {
           res.writeHead(500);
           res.end(JSON.stringify({ error: err.toString() }));
         }
      });
      return;
    }

    // API: /api/sendAudio (POST) — Send audio/voice
    if (req.url === '/api/sendAudio' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => (body += chunk));
      req.on('end', async () => {
         try {
           const { to, fileUrl, ptt = false } = JSON.parse(body); // ptt: true = send as voice note
           const sock = getSock();
           if (!sock) throw 'Bot not connected';

           const buffer = await downloadFile(fileUrl);
           await sock.sendMessage(to, {
             audio: buffer,
             mimetype: 'audio/mpeg',
             ptt
           });

           res.end(JSON.stringify({ ok: true, sent: true }));
         } catch (err) {
           res.writeHead(500);
           res.end(JSON.stringify({ error: err.toString() }));
         }
      });
      return;
    }
    
    // New API: /api/uploadAsStream (Send file as stream)
    if (req.url === '/api/uploadAsStream' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => (body += chunk));
      req.on('end', async () => {
        try {
          const { to, fileUrl, fileName = 'file', mimeType } = JSON.parse(body);
          const sock = getSock();
          if (!sock) throw 'Bot not connected';

          const stream = await downloadFileStream(fileUrl);
          const ext = path.extname(fileUrl.split('?')[0]) || '.mp4';
          const fileType = mimeType || lookup(ext) || 'application/octet-stream';

          await sock.sendMessage(to, {
            document: stream,
            fileName: fileName + ext,
            mimetype: fileType
          });

          res.end(JSON.stringify({ ok: true, sent: true }));
        } catch (err) {
          res.writeHead(500);
          res.end(JSON.stringify({ error: err.toString() }));
        }
      });
      return;
    }

    // New API: /api/uploadAsBuffer (Send file as buffer)
    if (req.url === '/api/uploadAsBuffer' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => (body += chunk));
      req.on('end', async () => {
        try {
          const { to, fileUrl, fileName = 'file', mimeType } = JSON.parse(body);
          const sock = getSock();
          if (!sock) throw 'Bot not connected';

          const buffer = await downloadFile(fileUrl);
          const ext = path.extname(fileUrl.split('?')[0]) || '.mp4';
          const fileType = mimeType || lookup(ext) || 'application/octet-stream';

          await sock.sendMessage(to, {
            document: buffer,
            fileName: fileName + ext,
            mimetype: fileType
          });

          res.end(JSON.stringify({ ok: true, sent: true }));
        } catch (err) {
          res.writeHead(500);
          res.end(JSON.stringify({ error: err.toString() }));
        }
      });
      return;
    }

    // New API: /api/uploadAsDownloadedTempFile (Download temp file, then send)
    if (req.url === '/api/uploadAsDownloadedTempFile' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => (body += chunk));
      req.on('end', async () => {
        try {
          const { to, fileUrl, fileName = 'file', mimeType } = JSON.parse(body);
          const sock = getSock();
          if (!sock) throw 'Bot not connected';

          // Download file to temp path
          const ext = path.extname(fileUrl.split('?')[0]) || '.mp4';
          const tempPath = path.join(__dirname, 'temp' + ext);

          await downloadFileToTemp(fileUrl, tempPath);

          const fileType = mimeType || lookup(ext) || 'application/octet-stream';

          await sock.sendMessage(to, {
            document: fs.createReadStream(tempPath),
            fileName: fileName + ext,
            mimetype: fileType
          });

          // Cleanup temp file
          fs.unlink(tempPath, () => {});

          res.end(JSON.stringify({ ok: true, sent: true }));
        } catch (err) {
          res.writeHead(500);
          res.end(JSON.stringify({ error: err.toString() }));
        }
      });
      return;
    }

    // Default route
    res.writeHead(200);
    res.end('✅ WhatsApp Bot is running.\nSee /qr for QR code');
  }).listen(8000, () => {
    console.log('🔗 REST API and QR Server running on http://localhost:8000');
  });
}

// Helper to download file to temp
function downloadFileToTemp(url, filepath) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : httpLib;
    const file = fs.createWriteStream(filepath);

    lib.get(url, (response) => {
      if (response.statusCode !== 200) return reject('File not reachable');

      response.pipe(file);
      file.on('finish', () => file.close(resolve));
      file.on('error', (err) => {
        fs.unlink(filepath, () => reject(err));
      });
    }).on('error', reject);
  });
}

module.exports = { startHttpServer };
