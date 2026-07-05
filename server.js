const http = require('http');
const { WebSocketServer } = require('ws');

const port = process.env.PORT || 8080;

const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('オセロ用サーバーV6（バグ完全修正版）が稼働中！');
});

const wss = new WebSocketServer({ server });
const rooms = {};

const createInitialBoard = () => {
    const board = Array(64).fill(0);
    board[3 * 8 + 3] = 2; // 白
    board[3 * 8 + 4] = 1; // 黒
    board[4 * 8 + 3] = 1; // 黒
    board[4 * 8 + 4] = 2; // 白
    return board;
};

// 部屋の全プレイヤー名リストを作成する共通関数
const getPlayerList = (room) => {
    const list = {};
    if (room && room.players) {
        for (const id in room.players) {
            list[room.players[id].color] = room.players[id].name;
        }
    }
    return list;
};

wss.on('connection', (ws) => {
    let myId = null;
    let myRoom = null;

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message.toString());

            // 🔍 部屋チェック
            if (data.type === 'check_room') {
                const exists = !!rooms[data.roomName];
                ws.send(JSON.stringify({
                    type: 'check_room_result',
                    exists: exists,
                    roomName: data.roomName
                }));
                return;
            }

            // 🚪 部屋に入る処理
            if (data.type === 'join_room') {
                myId = data.id;
                myRoom = data.roomName;

                if (!rooms[myRoom]) {
                    rooms[myRoom] = {
                        players: {},
                        board: createInitialBoard(),
                        turn: 1
                    };
                }

                const room = rooms[myRoom];
                const currentPlayers = Object.keys(room.players);

                let assignedColor = 0; // 観戦
                if (currentPlayers.length === 0) {
                    assignedColor = 1; // 黒
                } else if (currentPlayers.length === 1) {
                    const firstPlayerColor = room.players[currentPlayers[0]].color;
                    assignedColor = firstPlayerColor === 1 ? 2 : 1;
                }

                // プレイヤー情報を登録
                room.players[myId] = { color: assignedColor, name: data.name, ws: ws };

                const currentList = getPlayerList(room);

                // 本人に初期データを送信
                ws.send(JSON.stringify({
                    type: 'init',
                    yourColor: assignedColor,
                    board: room.board,
                    turn: room.turn,
                    playerCount: Object.keys(room.players).length,
                    playerList: currentList
                }));

                // 部屋の全員（自分含む）に最新の状態をブロードキャストして同期させます
                broadcastToRoom(myRoom, {
                    type: 'player_joined',
                    playerCount: Object.keys(room.players).length,
                    playerList: currentList
                });
            }

            // ⚪⚫ 石が置かれた時
            if (data.type === 'move') {
                if (!myRoom || !rooms[myRoom]) return;
                const room = rooms[myRoom];
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

    ws.on('close', () => {
        if (myRoom && rooms[myRoom] && rooms[myRoom].players[myId]) {
            const room = rooms[myRoom];
            delete room.players[myId];

            const remainingCount = Object.keys(room.players).length;
            if (remainingCount === 0) {
                delete rooms[myRoom];
            } else {
                const currentList = getPlayerList(room);
                broadcastToRoom(myRoom, {
                    type: 'player_left',
                    playerCount: remainingCount,
                    playerList: currentList
                });
            }
        }
    });
});

function broadcastToRoom(roomName, data) {
    if (!rooms[roomName]) return;
    const msg = JSON.stringify(data);
    for (const id in rooms[roomName].players) {
        const client = rooms[roomName].players[id].ws;
        if (client.readyState === 1) {
            client.send(msg);
        }
    }
}

server.listen(port, () => {
    console.log(`サーバーV6起動完了ですわ！`);
});
