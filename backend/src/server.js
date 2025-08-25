// server.js
const http = require('http');

const server = http.createServer((req, res) => {
  if (req.url === '/stream') {
    // 必須ヘッダ
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*', // ファイル直開き or 他ポートの簡易CORS用
    });

    // すぐに一度フラッシュ（接続確認＆プロキシ回避）
    res.write(': connected\n\n');        // コメント（無視されるがキープアライブに使える）

    let id = 0;

    // 1秒ごとにカスタム"ping"イベント
    const ping = setInterval(() => {
      const now = new Date().toISOString();
      res.write(`id: ${++id}\n`);
      res.write(`event: ping\n`);
      res.write(`data: {"time":"${now}"}\n\n`);
    }, 1000);

    // 10秒ごとに汎用message
    const msg = setInterval(() => {
      const now = new Date().toISOString();
      res.write(`data: tick ${now}\n\n`);
    }, 10000);

    // クライアント切断時
    req.on('close', () => {
      clearInterval(ping);
      clearInterval(msg);
      res.end();
    });

  } else {
    // 簡易トップページ
    res.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'});
    res.end(`
      <!doctype html>
      <meta charset="utf-8">
      <h1>SSE Demo</h1>
      <ul id="log"></ul>
      <script>
        const es = new EventSource('/stream');
        es.onmessage = (e) => {
          const li = document.createElement('li');
          li.textContent = 'message: ' + e.data;
          document.querySelector('#log').appendChild(li);
        };
        es.addEventListener('ping', (e) => {
          const li = document.createElement('li');
          li.textContent = 'ping: ' + e.data;
          document.querySelector('#log').appendChild(li);
        });
        es.onerror = (err) => console.error('SSE error', err);
        // 必要になったら es.close();
      </script>
    `);
  }
});

server.listen(3000, () => {
  console.log('SSE demo http://localhost:3000');
});