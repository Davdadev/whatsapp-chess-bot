# WhatsApp Chess Bot ♟️

A WhatsApp bot that lets you play chess against an AI opponent using interactive polls. The bot displays the chess board as images and uses polls for move selection.

## Features

- 🎮 Play chess via WhatsApp polls
- 🤖 AI opponent powered by js-chess-engine
- 🖼️ Visual chess board using chessboardimage.com
- 🧹 Automatic message cleanup (keeps only last 2 board images)
- ♟️ Choose piece type, then select specific move

## Installation

```bash
npm install whatsapp-chess-bot
```

Or clone and run:

```bash
git clone <your-repo-url>
cd whatsapp-chess-bot
npm install
npm start
```

## Setup

1. Run the bot:
   ```bash
   npm start
   ```

2. Scan the QR code with WhatsApp (Link Device)

3. Bot is ready! Send commands in any WhatsApp chat.

## Commands

- `@chess start` - Start a new chess game
- `@chess clean` - Delete all bot images from chat

## How to Play

1. Send `@chess start` in any WhatsApp chat
2. The bot shows the current board position
3. Vote in the "Choose a piece type" poll (Pawn, Knight, Bishop, etc.)
4. Vote in the move poll to select your piece's destination
5. The AI responds automatically
6. Repeat until checkmate or stalemate

## Configuration

Edit `index.js` to customize:

- **AI Difficulty**: Change `engine.aiMove(gameData.game.fen(), 2)` - the `2` is the search depth (higher = stronger)
- **Max Images**: Change `enforceMaxImages(chatId, 2)` - default keeps 2 board images
- **Session Name**: Change `clientId: "chess-poll-session"` for multiple instances

## Requirements

- Node.js 14 or higher
- WhatsApp account
- Internet connection

## Dependencies

- `whatsapp-web.js` - WhatsApp client
- `qrcode-terminal` - QR code display
- `chess.js` - Chess game logic
- `js-chess-engine` - AI opponent

## Notes

- WhatsApp may prevent deletion of old messages depending on timing/permissions
- For best experience, enable disappearing messages in the chat
- Board images are fetched from https://chessboardimage.com/

## License
GPL-3.0

