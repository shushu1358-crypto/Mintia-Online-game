// ⚡ Mintia-Online-game オンライン対戦仲介用 WebSocket サーバー (server2.js)
const { WebSocketServer } = require('ws');
const http = require('http');

// Renderなどの環境変数 PORT に対応、なければ 3000番 を使用しますわ
const PORT = process.env.PORT || 3000;

// Renderの仕様に合わせてHTTPサーバーを一度立てますの
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('ポケポケ風ゲームの対戦サーバーはガチで稼働中を維持しておりますわ！');
});

const wss = new WebSocketServer({ server });
console.log(`⚔️ オンライン対戦サーバーがポート ${PORT} で起動しましたわ！`);

const rooms = {}; // 部屋ごとのプレイヤー情報を管理しますの

wss.on('connection', (ws) => {
    let currentRoom = null;
    let myId = null;

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);

            // 🚪 部屋への入室処理
            if (data.type === 'join_room') {
                currentRoom = data.roomName;
                myId = data.id;

                if (!rooms[currentRoom]) {
                    rooms[currentRoom] = [];
                }

                const room = rooms[currentRoom];

                if (room.length >= 2) {
                    ws.send(JSON.stringify({ type: 'error', message: 'お嬢様、このお部屋は満員ですわ！' }));
                    return;
                }

                // 1人目は先攻(1)、2人目は後攻(2)
                const playerNum = room.length === 0 ? 1 : 2;
                room.push({ id: myId, ws: ws, name: data.name, playerNum: playerNum });

                // 入室した本人に初期設定を送信
                ws.send(JSON.stringify({ type: 'init', yourColor: playerNum }));

                console.log(`[部屋 ${currentRoom}] ${data.name}様が参戦されました（プレイヤー ${playerNum}）`);

                // 2人揃ったら対戦スタートの合図！
                if (room.length === 2) {
                    room.forEach(p => {
                        p.ws.send(JSON.stringify({ type: 'player_joined', playerCount: 2 }));
                    });
                    console.log(`[部屋 ${currentRoom}] 2人のプレイヤーが揃いましたわ！試合開始です！`);
                }
            }

            // ⚔️ プレイデータの同期転送
            if (data.type === 'move') {
                if (currentRoom && rooms[currentRoom]) {
                    // 自分以外のプレイヤーにデータをそのまま転送しますわ！
                    rooms[currentRoom].forEach(p => {
                        if (p.id !== myId) {
                            p.ws.send(JSON.stringify(data));
                        }
                    });
                }
            }

        } catch (e) {
            console.error("通信エラーが発生いたしましたわ：", e);
        }
    });

    // 🔌 切断時の処理
    ws.on('close', () => {
        if (currentRoom && rooms[currentRoom]) {
            rooms[currentRoom] = rooms[currentRoom].filter(p => p.id !== myId);
            console.log(`[部屋 ${currentRoom}] プレイヤーが退室されましたわ。`);
            if (rooms[currentRoom].length === 0) {
                delete rooms[currentRoom];
            }
        }
    });
});

server.listen(PORT, () => {
    console.log(`HTTP server listening on port ${PORT}`);
});
