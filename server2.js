// ⚡ オセロ・ポケポケ両対応マルチ通信サーバー (server2.js)
const { WebSocketServer } = require('ws');
const http = require('http');

const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('オセロもポケポケも、両方ガチで稼働中を維持しておりますわ！');
});

const wss = new WebSocketServer({ server });
console.log(`⚔️ ハイブリッド対戦サーバーがポート ${PORT} で起動しましたわ！`);

// 部屋管理（オセロとポケポケを完全に別世界として分離しますの）
const othelloRooms = {};
const pokepokeRooms = {};

wss.on('connection', (ws) => {
    let currentRoom = null;
    let myId = null;
    let gameType = null; // 'othello' または 'pokepoke'

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);

            // 🚪 1. 部屋への入室処理
            if (data.type === 'join_room') {
                currentRoom = data.roomName;
                myId = data.id;
                
                // 💡 ポケポケ側からのアクセスか、オセロ側からのアクセスかを判別しますわ！
                // ポケポケのデータ構造（name等）があればポケポケ、なければオセロとみなします
                gameType = (data.name !== undefined) ? 'pokepoke' : 'othello';
                
                const targetRooms = (gameType === 'pokepoke') ? pokepokeRooms : othelloRooms;

                if (!targetRooms[currentRoom]) {
                    targetRooms[currentRoom] = [];
                }

                const room = targetRooms[currentRoom];

                if (room.length >= 2) {
                    ws.send(JSON.stringify({ type: 'error', message: 'お嬢様、このお部屋は満員ですわ！' }));
                    return;
                }

                const playerNum = room.length === 0 ? 1 : 2;
                room.push({ id: myId, ws: ws, playerNum: playerNum });

                // 各ゲームに合わせた初期データを送信
                if (gameType === 'pokepoke') {
                    ws.send(JSON.stringify({ type: 'init', yourColor: playerNum }));
                    console.log(`[ポケポケ部屋 ${currentRoom}] プレイヤー ${playerNum} 参戦`);
                } else {
                    // オセロの初期化（color: 'B' or 'W' などのオセロ独自の仕様に合わせますわ）
                    ws.send(JSON.stringify({ type: 'init', yourColor: playerNum === 1 ? 'B' : 'W' }));
                    console.log(`[オセロ部屋 ${currentRoom}] プレイヤー ${playerNum === 1 ? '黒' : '白'} 参戦`);
                }

                // 2人揃ったら対戦スタート
                if (room.length === 2) {
                    room.forEach(p => {
                        p.ws.send(JSON.stringify({ type: 'player_joined', playerCount: 2 }));
                    });
                }
            }

            // ⚔️ 2. プレイデータの同期転送（オセロとポケポケを混ざらないように右から左へ受け流しますわ！）
            if (data.type === 'move') {
                const targetRooms = (gameType === 'pokepoke') ? pokepokeRooms : othelloRooms;
                if (currentRoom && targetRooms[currentRoom]) {
                    targetRooms[currentRoom].forEach(p => {
                        if (p.id !== myId) {
                            p.ws.send(JSON.stringify(data));
                        }
                    });
                }
            }

        } catch (e) {
            console.error("通信エラーですわ：", e);
        }
    });

    // 🔌 3. 切断時の処理
    ws.on('close', () => {
        const targetRooms = (gameType === 'pokepoke') ? pokepokeRooms : othelloRooms;
        if (targetRooms && currentRoom && targetRooms[currentRoom]) {
            targetRooms[currentRoom] = targetRooms[currentRoom].filter(p => p.id !== myId);
            if (targetRooms[currentRoom].length === 0) {
                delete targetRooms[currentRoom];
            }
            console.log(`[${gameType === 'pokepoke' ? 'ポケポケ' : 'オセロ'}部屋 ${currentRoom}] 退室されましたわ`);
        }
    });
});

server.listen(PORT);
