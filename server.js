const { WebSocketServer } = require('ws');

// Renderは環境変数 PORT を指定してくるので、それを使用する
const port = process.env.PORT || 8080;
const wss = new WebSocketServer({ port });

// 接続中の全クライアントを管理
const clients = new Set();

wss.on('connection', (ws) => {
    clients.add(ws);
    console.log(`新しいプレイヤーが接続しました。現在の人数: ${clients.size}人`);

    // クライアントからメッセージ（位置情報など）を受け取ったとき
    ws.on('message', (message) => {
        // 送信主以外の全員にデータをそのまま転送（ブロードキャスト）
        for (const client of clients) {
            if (client !== ws && client.readyState === ws.OPEN) {
                client.send(message.toString());
            }
        }
    });

    ws.on('close', () => {
        clients.delete(ws);
        console.log(`プレイヤーが切断しました。現在の人数: ${clients.size}人`);
    });
});

console.log(`サーバーがポート ${port} で起動しました`);
