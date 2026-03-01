const { Client, LocalAuth, MessageMedia, Poll } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { Chess } = require('chess.js');
const engine = require('js-chess-engine');

const client = new Client({
    authStrategy: new LocalAuth({ clientId: "chess-poll-session" }),
    webVersionCache: {
        type: 'remote',
        remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html',
    },
    puppeteer: { args: ['--no-sandbox', '--disable-setuid-sandbox'] }
});

const activeChess = {};
const PIECE_NAMES = { 'p': 'Pawn ♟️', 'n': 'Knight ♞', 'b': 'Bishop ♝', 'r': 'Rook ♜', 'q': 'Queen ♛', 'k': 'King ♚' };

client.on('qr', (qr) => qrcode.generate(qr, { small: true }));
client.on('ready', () => console.log('♟️ Chess Poll Bot is online!'));

client.on('message_create', async (msg) => {
    if (msg.fromMe) return;
    const chatId = msg.from;
    const body = msg.body.toLowerCase().trim();

    if (body === '@chess clean') {
        await deletePastImages(chatId);
        await client.sendMessage(chatId, '🧹 Deleted recent bot images.');
        return;
    }

    if (body === '@chess start') {
        activeChess[chatId] = {
            game: new Chess(),
            lastPollId: null,
            phase: 'piece_select',
            trackedMessageIds: [],
            lastPiecePollId: null,
            imageMessageIds: []
        };
        await deletePastImages(chatId);
        await client.sendMessage(chatId, "♟️ *Chess Started!* Use the polls to play.");
        await sendChessBoard(chatId);
        await sendPiecePoll(chatId);
    }
});

client.on('vote_update', async (vote) => {
    const chatId = vote.parentMessage.to;
    const gameData = activeChess[chatId];
    if (!gameData || vote.parentMessage.id._serialized !== gameData.lastPollId) return;

    const selection = vote.selectedOptions[0]?.name;
    if (!selection) return;

    if (gameData.phase === 'piece_select') {
        const pieceType = Object.keys(PIECE_NAMES).find(k => PIECE_NAMES[k] === selection);
        await sendMovePoll(chatId, pieceType);
    } else if (gameData.phase === 'move_select') {
        await executeMove(chatId, selection);
    }
});

async function sendPiecePoll(chatId) {
    const gameData = activeChess[chatId];
    if (gameData.lastPiecePollId) {
        await deleteMessageById(gameData.lastPiecePollId);
        gameData.lastPiecePollId = null;
    }
    const moves = gameData.game.moves({ verbose: true });
    const pieces = [...new Set(moves.map(m => m.piece))].map(p => PIECE_NAMES[p]);
    const poll = new Poll('Choose a piece type:', pieces);
    const sent = await client.sendMessage(chatId, poll);
    gameData.lastPiecePollId = sent.id._serialized;
    gameData.lastPollId = sent.id._serialized;
    gameData.phase = 'piece_select';
}

async function sendMovePoll(chatId, pieceType) {
    const gameData = activeChess[chatId];
    await deleteTrackedMessages(chatId);
    if (gameData.lastPiecePollId) {
        await deleteMessageById(gameData.lastPiecePollId);
        gameData.lastPiecePollId = null;
    }
    const moves = gameData.game.moves({ verbose: true }).filter(m => m.piece === pieceType).map(m => m.san);
    const poll = new Poll(`Move ${PIECE_NAMES[pieceType]} to:`, moves.slice(0, 12));
    const sent = await sendTrackedMessage(chatId, poll);
    gameData.lastPollId = sent.id._serialized;
    gameData.phase = 'move_select';
}

async function executeMove(chatId, moveSan) {
    const gameData = activeChess[chatId];
    await deleteTrackedMessages(chatId);
    if (gameData.lastPollId) {
        await deleteMessageById(gameData.lastPollId);
    }
    gameData.game.move(moveSan);
    let computerPlayedSan = null;
    if (!gameData.game.isGameOver()) {
        const ai = engine.aiMove(gameData.game.fen(), 2);
        const from = Object.keys(ai)[0].toLowerCase();
        const to = ai[Object.keys(ai)[0]].toLowerCase();
        const aiMove = gameData.game.move({ from, to, promotion: 'q' });
        computerPlayedSan = aiMove?.san || `${from}-${to}`;
    }
    if (computerPlayedSan) {
        await sendTrackedMessage(chatId, `🤖 Computer played: *${computerPlayedSan}*`);
    }
    await sendChessBoard(chatId);
    if (gameData.game.isGameOver()) {
        await client.sendMessage(chatId, "🏁 *Game Over!*");
        delete activeChess[chatId];
    } else {
        await sendPiecePoll(chatId);
        }
    }

    async function sendChessBoard(chatId) {
        const gameData = activeChess[chatId];
        const fen = gameData.game.fen();
        const fenUrl = encodeURI(fen); // Keep '/' separators, encode spaces
        console.log(fen);
        const media = await MessageMedia.fromUrl(`https://chessboardimage.com/${fenUrl}.png`);
        const sent = await client.sendMessage(chatId, media);
        gameData.imageMessageIds ??= [];
        gameData.imageMessageIds.push(sent.id._serialized);
        await enforceMaxImages(chatId, 2);
    }

    async function sendTrackedMessage(chatId, content, track = true) {
        const sent = await client.sendMessage(chatId, content);
        const gameData = activeChess[chatId];
        if (gameData && track) {
            gameData.trackedMessageIds ??= [];
            gameData.trackedMessageIds.push(sent.id._serialized);
        }
        return sent;
    }

    async function deleteTrackedMessages(chatId) {
        const gameData = activeChess[chatId];
        if (!gameData?.trackedMessageIds?.length) return;

        const idsToDelete = [...gameData.trackedMessageIds];
        gameData.trackedMessageIds = [];

        for (const id of idsToDelete) {
            try {
                const message = await client.getMessageById(id);
                if (message) await message.delete(true);
            } catch (err) {
                console.log(`Could not delete message ${id}:`, err.message);
            }
        }
    }

    async function deletePastImages(chatId) {
        try {
            const chat = await client.getChatById(chatId);
            const recent = await chat.fetchMessages({ limit: 200 });
            for (const msg of recent) {
                if (!msg.fromMe || !msg.hasMedia) continue;
                try {
                    await msg.delete(true);
                } catch (err) {
                    console.log(`Could not delete old image ${msg.id?._serialized}:`, err.message);
                }
            }
        } catch (err) {
            console.log('Could not fetch chat for image cleanup:', err.message);
        }
    }

    async function enforceMaxImages(chatId, maxImages = 2) {
        const gameData = activeChess[chatId];
        if (!gameData) return;

        gameData.imageMessageIds ??= [];
        while (gameData.imageMessageIds.length > maxImages) {
            const oldestId = gameData.imageMessageIds.shift();
            if (oldestId) await deleteMessageById(oldestId);
        }
    }

    async function deleteMessageById(messageId) {
        try {
            const message = await client.getMessageById(messageId);
            if (message) await message.delete(true);
        } catch (err) {
            console.log(`Could not delete message ${messageId}:`, err.message);
        }
    }

    client.initialize();