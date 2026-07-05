const http = require('http');
const { WebSocketServer } = require('ws');

const port = process.env.PORT || 8080;

const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('お嬢様、お待たせいたしました。改良版サーバーが稼働中ですわ！');
});

const wss = new WebSocketServer({ server });

// 💥 【重要】現在ログインしている全プレイヤーのデータを記憶する部屋です
const players = {}; 

wss.on('connection', (ws) => {
    // この接続（ws）に対応するプレイヤーIDを紐付けるための変数
    let myPlayerId = null;

    console.log(`新しい接続がありました。`);

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message.toString());

            // 💡 動きを同期するメッセージの場合
            if (data.type === 'move') {
                myPlayerId = data.id; // IDを記憶しておく
                
                // サーバーの記憶を更新
                players[data.id] = { x: data.x, y: data.y, color: data.color };

                // 全員（自分以外）に「こいつ動いたよ」と転送
                broadcast({
                    type: 'update',
                    id: data.id,
                    x: data.x,
                    y: data.y,
                    color: data.color
                }, ws);
            }

            // 💡 後から入ってきた人が「今だれがいるの？」と聞いてきた場合
            if (data.type === 'request_all') {
                // その人にだけ、いまサーバーが覚えている全員のデータを一気に送る
                ws.send(JSON.stringify({
                    type: 'sync_all',
                    players: players
                }));
            }

        } catch (e) {
            console.error("データ処理エラー", e);
        }
    });

    // 💥 【重要】ブラウザを閉じた、または再読み込みした時
    ws.on('close', () => {
        if (myPlayerId && players[myPlayerId]) {
            // 1. サーバーの記憶から消去
            delete players[myPlayerId];
            console.log(`プレイヤー [${myPlayerId}] が退出しました。残りの人数: ${Object.keys(players).length}人`);

            // 2. 生き残っている全員に「こいつ消えたから画面から消して！」と伝える
            broadcast({
                type: 'leave',
                id: myPlayerId
            });
        }
    });
});

// 全員にデータを送るための便利関数（自分を除外することも可能）
function broadcast(data, excludeWs = null) {
    const msg = JSON.stringify(data);
    wss.clients.forEach((client) => {
        if (client !== excludeWs && client.readyState === 1) { // 1 は OPEN の意味
            client.send(msg);
        }
    });
}

server.listen(port, () => {
    console.log(`サーバーがポート ${port} で起動しました`);
});
