const https = require('https');
const httpLib = require('http');

function downloadFile(fileUrl) {
  return new Promise((resolve, reject) => {
    const lib = fileUrl.startsWith('https') ? https : httpLib;
    lib.get(fileUrl, (response) => {
      if (response.statusCode !== 200) return reject('File not reachable');
      const data = [];

      response.on('data', (chunk) => data.push(chunk));
      response.on('end', () => resolve(Buffer.concat(data)));
    }).on('error', reject);
  });
}

function downloadFileStream(fileUrl) {
  return new Promise((resolve, reject) => {
    const lib = fileUrl.startsWith('https') ? https : httpLib;
    lib.get(fileUrl, (response) => {
      if (response.statusCode !== 200) return reject('File not reachable');
      resolve(response);
    }).on('error', reject);
  });
}

module.exports = { downloadFile, downloadFileStream };
