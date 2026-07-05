const http = require('http');
const { WebSocketServer } = require('ws');

const port = process.env.PORT || 8080;

const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('オセロ用の部屋システムサーバーが稼働中でお姉様！');
});

const wss = new WebSocketServer({ server });

// 💥 部屋ごとのデータを記憶する構造です
// rooms = { "roomA": { players: { id1: {color, ws}, id2: ... }, board: [...], turn: 'black' } }
const rooms = {};

// オセロの初期盤面（0:空、1:黒、2:白）
const createInitialBoard = () => {
    const board = Array(64).fill(0);
    board[3 * 8 + 3] = 2; // 白
    board[3 * 8 + 4] = 1; // 黒
    board[4 * 8 + 3] = 1; // 黒
    board[4 * 8 + 4] = 2; // 白
    return board;
};

wss.on('connection', (ws) => {
    let myId = null;
    let myRoom = null;

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message.toString());

            // 🚪 部屋に入る処理
            if (data.type === 'join_room') {
                myId = data.id;
                myRoom = data.roomName;

                // 部屋がなければ新しく作る
                if (!rooms[myRoom]) {
                    rooms[myRoom] = {
                        players: {},
                        board: createInitialBoard(),
                        turn: 1 // 最初は黒(1)の番
                    };
                }

                const room = rooms[myRoom];
                const currentPlayers = Object.keys(room.players);

                // 石の色を決める（1人目は黒、2人目は白、3人目以降は観戦）
                let assignedColor = 0; // 観戦
                if (currentPlayers.length === 0) {
                    assignedColor = 1; // 黒
                } else if (currentPlayers.length === 1) {
                    // 1人目の色が黒なら白、白なら黒にする
                    const firstPlayerColor = room.players[currentPlayers[0]].color;
                    assignedColor = firstPlayerColor === 1 ? 2 : 1;
                }

                // プレイヤー登録（通信ソケットも一緒に保管）
                room.players[myId] = { color: assignedColor, ws: ws };

                // 本人に現在の状態を伝える
                ws.send(JSON.stringify({
                    type: 'init',
                    yourColor: assignedColor,
                    board: room.board,
                    turn: room.turn,
                    playerCount: Object.keys(room.players).length
                }));

                // 部屋の他の人たちに、誰かが入ってきたことを通知
                broadcastToRoom(myRoom, {
                    type: 'player_joined',
                    playerCount: Object.keys(room.players).length
                }, myId);
            }

            // ⚪⚫ 石が置かれた時の処理
            if (data.type === 'move') {
                if (!myRoom || !rooms[myRoom]) return;
                const room = rooms[myRoom];

                // 盤面と次のターンを更新して部屋の全員にブロードキャスト
                room.board = data.board;
                room.turn = data.nextTurn;

                broadcastToRoom(myRoom, {
                    type: 'update_game',
                    board: room.board,
                    turn: room.turn
                });
            }

        } catch (e) {
            console.error(e);
        }
    });

    // 🚪 誰かがブラウザを閉じた（切断した）時の処理
    ws.on('close', () => {
        if (myRoom && rooms[myRoom] && rooms[myRoom].players[myId]) {
            const room = rooms[myRoom];
            delete room.players[myId]; // 部屋から削除

            const remainingCount = Object.keys(room.players).length;
            if (remainingCount === 0) {
                // 誰もいなくなったら部屋ごと消去してメモリを節約します
                delete rooms[myRoom];
            } else {
                // まだ残っている人がいれば、相手が消えたことを通知
                broadcastToRoom(myRoom, {
                    type: 'player_left',
                    playerCount: remainingCount
                });
            }
        }
    });
});

// 部屋の中にいる人たちだけにデータを送る便利関数
function broadcastToRoom(roomName, data, excludeId = null) {
    if (!rooms[roomName]) return;
    const msg = JSON.stringify(data);
    for (const id in rooms[roomName].players) {
        if (id !== excludeId) {
            const client = rooms[roomName].players[id].ws;
            if (client.readyState === 1) {
                client.send(msg);
            }
        }
    }
}

server.listen(port, () => {
    console.log(`サーバーがポート ${port} で起動しましたわ`);
});
