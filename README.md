# Voice MCP Server

A voice-enabled MCP (Model Context Protocol) server built with Bun, React, and ElevenLabs. This server exposes three tools for LLMs to enable voice interaction: `speak`, `listen`, and `action`.

## Features

- **🎤 Speech-to-Text**: Web Speech API with three modes:
  - **Manual**: Click to record, click send button
  - **PTT (Push-to-Talk)**: Hold button while speaking, release to send
  - **Auto**: Automatically sends after 1.5s of silence

- **🔊 Text-to-Speech**: ElevenLabs streaming audio
- **💬 Chat Interface**: Facebook Messenger-style UI
- **📊 Action Tracking**: Collapsible action logs attached to LLM responses
- **🔌 WebSocket**: Real-time audio streaming and status updates
- **⚡ MCP Tools**: Three tools exposed via stdio transport

## Prerequisites

- [Bun](https://bun.sh) v1.0.0 or later
- [ElevenLabs API Key](https://elevenlabs.io)
- Modern browser with Web Speech API support (Chrome, Edge recommended)

## Quick Start with npx

The easiest way to use this MCP server is via npx:

```bash
# Install globally
npm install -g voice-mcp

# Or run directly with npx
npx voice-mcp
```

Then configure in your MCP client (Claude Desktop, Claude Code, etc.):

```json
{
  "mcpServers": {
    "voice-mcp": {
      "command": "npx",
      "args": ["voice-mcp"],
      "env": {
        "ELEVENLABS_API_KEY": "your_api_key_here",
        "MCP_HTTP_PORT": "53245"
      }
    }
  }
}
```

Open your browser to `http://localhost:53245` to access the voice interface!

## Installation from Source

```bash
# Clone the repository
git clone https://github.com/codingbutter/simple-voice-mcp.git
cd simple-voice-mcp

# Install dependencies
bun install

# Copy environment example
cp .env.example .env

# Edit .env and add your ElevenLabs API key
# ELEVENLABS_API_KEY=your_api_key_here
```

## Development

Start the development server (HTTP/WebSocket + MCP stdio):

```bash
# Set your API key
export ELEVENLABS_API_KEY="your_api_key_here"

# Run in development mode with HMR
bun dev
```

The server will:
- Start an HTTP server on port 3000 (configurable via `MCP_HTTP_PORT`)
- Serve the React UI at `http://localhost:3000`
- Listen for MCP requests via stdio

## Production

```bash
# Build the frontend
bun run build

# Run in production mode
NODE_ENV=production ELEVENLABS_API_KEY="your_key" bun start
```

## MCP Configuration

### Claude Code (Automatic)

This project includes a `.mcp.json` file that automatically configures the server with Claude Code:

1. **Add your ElevenLabs API key** to `.mcp.json`:
   ```json
   {
     "env": {
       "ELEVENLABS_API_KEY": "your_api_key_here"
     }
   }
   ```

2. **Restart Claude Code** - The server will auto-start

3. **Open browser** to `http://localhost:53245`

The server is configured with `autoStart: true`, so it starts automatically when Claude Code launches.

### Claude Desktop or Other MCP Clients

To use this as an MCP server with Claude Desktop or another MCP client, add this to your MCP configuration:

```json
{
  "mcpServers": {
    "voice-mcp": {
      "command": "bun",
      "args": ["run", "/absolute/path/to/simple-voice-mcp/src/index.tsx"],
      "env": {
        "ELEVENLABS_API_KEY": "your_api_key_here",
        "MCP_HTTP_PORT": "53245",
        "ELEVEN_VOICE_ID": "21m00Tcm4TlvDq8ikWAM",
        "ELEVEN_MODEL_ID": "eleven_flash_v2_5"
      }
    }
  }
}
```

## MCP Tools

The server exposes three tools:

### `speak(text, listen?, timeout_ms?, voiceId?, modelId?)`
Generate and stream text-to-speech audio to connected clients.

**Parameters:**
- `text` (string, required): The text to convert to speech
- `listen` (boolean, optional): If true, wait for user response after speaking
- `timeout_ms` (number, optional): Timeout when listen=true (default: 60000ms)
- `voiceId` (string, optional): ElevenLabs voice ID (default: Rachel)
- `modelId` (string, optional): ElevenLabs model ID (default: eleven_flash_v2_5)

**Returns:**
- `{ ok: true, message, messages? }` - If listen=true, includes user's messages

### `listen(timeout_ms?)`
Wait for text input from clients (blocks until user sends text or timeout).

**Parameters:**
- `timeout_ms` (number, optional): Timeout in milliseconds (default: 60000)

**Returns:**
- `{ messages: string[] }` - Array of messages (empty if timeout)

### `action(text)`
Send a status or action update to the client UI. Appears as collapsible section.

**Parameters:**
- `text` (string, required): The action/status text to display (e.g., "Reading file X", "Running tests")

**Returns:**
- `{ ok: true }`

**Note:** Only send concrete actions being performed, not commentary or explanations.

## Testing with MCP Inspector

```bash
# Install MCP Inspector globally
npm install -g @modelcontextprotocol/inspector

# Test the server
export ELEVENLABS_API_KEY="your_key"
npx @modelcontextprotocol/inspector bun src/index.tsx
```

## Architecture

```
┌─────────────────────────────────────────┐
│  MCP Client (Claude Desktop, etc.)     │
└───────────────┬─────────────────────────┘
                │ stdio (JSON-RPC)
                │
┌───────────────▼─────────────────────────┐
│  MCP Server (Bun Process)              │
│  ├─ stdio transport                    │
│  ├─ Three tools: speak/listen/action   │
│  └─ HTTP/WebSocket server               │
└───────────────┬─────────────────────────┘
                │ HTTP + WebSocket
                │
┌───────────────▼─────────────────────────┐
│  Browser UI (React)                     │
│  ├─ Chat interface                     │
│  ├─ Web Speech API (STT)               │
│  ├─ Audio playback (TTS)               │
│  └─ WebSocket client                    │
└─────────────────────────────────────────┘
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ELEVENLABS_API_KEY` | ✅ | - | Your ElevenLabs API key |
| `MCP_HTTP_PORT` | ❌ | 3000 | Port for HTTP/WS server |
| `ELEVEN_VOICE_ID` | ❌ | Rachel voice | Default voice ID |
| `ELEVEN_MODEL_ID` | ❌ | eleven_flash_v2_5 | Default model |
| `NODE_ENV` | ❌ | development | Environment mode |

## Project Structure

```
src/
├── index.tsx              # Main entry point (MCP + HTTP server)
├── App.tsx                # React root component
├── frontend.tsx           # React DOM setup
├── mcp/
│   └── tools.ts          # MCP tool implementations
├── server/
│   ├── http.ts           # HTTP + WebSocket server
│   ├── websocket.ts      # WebSocket manager
│   └── tts.ts            # ElevenLabs TTS manager
├── hooks/
│   ├── useWebSocket.ts   # WebSocket client hook
│   └── useSpeechRecognition.ts  # Web Speech API hook
└── components/
    ├── chat/
    │   ├── ChatInterface.tsx   # Main chat UI
    │   └── ChatMessage.tsx     # Message bubble component
    └── ui/               # shadcn/ui components
```

## Important Notes

- **stdio Constraint**: The server uses stdout for MCP JSON-RPC. All logging goes to stderr.
- **Browser Compatibility**: Web Speech API works best in Chrome/Edge
- **Multi-Instance**: Each MCP server instance needs a unique port (set via `MCP_HTTP_PORT`)

## Documentation

See [Project_Scope.md](./Project_Scope.md) for detailed technical specifications.
See [QUICKSTART.md](./QUICKSTART.md) for a quick setup guide.

## License

MIT - See [LICENSE](./LICENSE) for details.

## Built With

- [Bun](https://bun.sh) - Runtime & bundler
- [React 19](https://react.dev) - UI framework
- [Tailwind CSS v4](https://tailwindcss.com) - Styling
- [shadcn/ui](https://ui.shadcn.com) - UI components
- [ElevenLabs](https://elevenlabs.io) - Text-to-speech
- [Model Context Protocol](https://modelcontextprotocol.io) - MCP SDK
