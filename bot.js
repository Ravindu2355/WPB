const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode');
const fs = require('fs');
const axios = require('axios');

const webhookURLFile = 'https://raw.githubusercontent.com/Ravindu2355/WPB/main/wbh.txt';
var st ={
  webhookURL:null
}
let sock;

async function fetchWebhookURL() {
  try {
    const res = await axios.get(webhookURLFile);
    st.webhookURL = res.data.trim(); // remove any newlines/spaces
    console.log('✅ Webhook URL fetched:', st.webhookURL);
  } catch (err) {
    console.error('❌ Failed to fetch webhook URL:', err.message);
  }
}

async function startBot() {
  await fetchWebhookURL(); // fetch webhook before starting bot

  const { state, saveCreds } = await useMultiFileAuthState('auth');
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
  });

  sock.ev.on('connection.update', async (update) => {
    const { qr, connection, lastDisconnect } = update;

    if (qr) {
      await qrcode.toFile('qr.png', qr);
      console.log('📷 QR available at: http://localhost:8000/qr');
    }

    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode || '';
      console.log('❌ Disconnected. Code:', code);

      if (fs.existsSync('qr.png')) fs.unlinkSync('qr.png');

      if (code !== DisconnectReason.loggedOut) {
        console.log('🔁 Reconnecting...');
        startBot();
      } else {
        console.log('👋 Logged out. Delete auth folder to relogin.');
      }
    }

    if (connection === 'open') {
      if (fs.existsSync('qr.png')) fs.unlinkSync('qr.png');
      console.log('✅ Connected to WhatsApp!');
    }
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const from = msg.key.remoteJid;
    const text =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text ||
      msg.message.imageMessage?.caption ||
      msg.message.videoMessage?.caption || '';

    console.log('📩', from, '-', text);

    // ✅ Webhook POST
    try {
      if (st.webhookURL) {
        await axios.post(st.webhookURL, {
          from,
          text,
          message: msg,
          timestamp: msg.messageTimestamp,
          messageId: msg.key.id,
          sender: msg.pushName || 'Unknown',
        });
        console.log('🌐 Message sent to webhook');
      }else{
        console.log('❌️ No web hook value:- '+ st.webhookURL);
      }
    } catch (err) {
      console.error('🚨 Failed to send to webhook:', err.message);
    }

    // 🧠 Command handling
    if (text.startsWith('/upload ')) {
      const url = text.split(' ')[1];
      if (!url) return await sock.sendMessage(from, { text: '⚠️ Usage: /upload <video_url>' });

      try {
        const { downloadFile } = require('./utils');
        const stream = await downloadFile(url);
        await sock.sendMessage(from, {
          document: stream,
          fileName: 'video.mp4',
          mimetype: 'video/mp4'
        });
      } catch (e) {
        await sock.sendMessage(from, { text: '❌ Failed to upload video.' });
      }
    } else {
     // await sock.sendMessage(from, { text: '👋 I received your message!.' });
    }
  });
}

function getSock() {
  return sock;
}

module.exports = { startBot, getSock, fetchWebhookURL, st };
