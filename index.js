const { startBot } = require('./bot');
const { startHttpServer } = require('./httpServer');

(async () => {
  await startBot();
  startHttpServer();
})();
