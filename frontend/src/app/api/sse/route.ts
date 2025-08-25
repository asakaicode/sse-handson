// app/api/sse/route.ts
export const runtime = 'nodejs'; // Edgeだと実装が少し変わる

export async function GET() {
  const stream = new ReadableStream({
    start(controller) {
      const enc = new TextEncoder();
      let id = 0;

      // すぐに接続済みコメント
      controller.enqueue(enc.encode(`: connected\n\n`));

      const ping = setInterval(() => {
        const now = new Date().toISOString();
        controller.enqueue(enc.encode(`id: ${++id}\n`));
        controller.enqueue(enc.encode(`event: ping\n`));
        controller.enqueue(enc.encode(`data: {"time":"${now}"}\n\n`));
      }, 1000);

      const keep = setInterval(() => {
        controller.enqueue(enc.encode(`: keepalive\n\n`));
      }, 15000);

      // 接続終了時
      const close = () => {
        clearInterval(ping);
        clearInterval(keep);
        controller.close();
      };

      setTimeout(close, 30000);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}