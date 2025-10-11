# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Voice MCP Server** - a single Bun process that serves as both an MCP (Model Context Protocol) server over stdio and an HTTP/WebSocket server for a React UI. The goal is to provide voice interaction capabilities (speak, listen, action) to LLMs through MCP tools while streaming audio to/from a browser interface.

**Key technologies:**
- **Bun runtime** for server and bundling
- **MCP SDK** (`@modelcontextprotocol/sdk`) for stdio-based tool exposure
- **ElevenLabs JS SDK** for text-to-speech with streaming
- **React 19** + **Tailwind CSS v4** + **shadcn/ui** for the frontend
- **Bun.serve** for HTTP routes + WebSocket upgrades

## Development Commands

**Install dependencies:**
```bash
bun install
```

**Development mode (with HMR):**
```bash
bun dev
# or with environment variables:
MCP_HTTP_PORT=53245 ELEVENLABS_API_KEY=sk_... bun dev
```

**Production mode:**
```bash
bun start
# or:
NODE_ENV=production bun src/index.tsx
```

**Build for production:**
```bash
bun run build
# or with options:
bun run build.ts --outdir=dist --minify --sourcemap=linked
```

**Test with MCP Inspector:**
```bash
npx @modelcontextprotocol/inspector bun src/index.tsx
```

## Architecture

### Core Design Principles

1. **Single Process, Dual Interface:**
   - MCP tools exposed via stdio (stdout MUST remain clean for JSON-RPC)
   - HTTP + WebSocket server for browser UI on a dynamic port
   - Both coexist in `src/index.tsx`

2. **stdio Transport Constraints:**
   - **NEVER log to stdout** - MCP uses stdout for JSON-RPC messages
   - Use `console.error()` for diagnostics (stderr is safe)
   - All MCP communication happens over stdin/stdout

3. **Multi-Instance Support:**
   - Each MCP server instance gets a unique port via `MCP_HTTP_PORT` env var
   - No hard-coded ports to avoid conflicts

### MCP Tools (to be implemented)

The server will expose three MCP tools:

- **speak(text, clientId, voiceId?, modelId?, voiceSettings?)**
  - Streams TTS audio to browser via WebSocket using ElevenLabs SDK
  - Returns `{ ok: true }`

- **listen(clientId, timeout_ms?)**
  - Blocks until text arrives via `POST /api/listen`
  - Returns `{ text: string }`

- **action(text, clientId?)**
  - Sends status updates to UI via WebSocket
  - Returns `{ ok: true }`

### HTTP/WebSocket API (to be implemented)

- `GET /` → React app (HTML imports pattern)
- `WS /ws?clientId=UUID` → Audio streaming + status messages
  - Server → Client: `{type:"hello"|"audio"|"action"|"info"|"error", ...}`
- `POST /api/listen` → `{ clientId, text }` → feeds into listen() queue

### Frontend Structure

- `src/index.html` → Entry HTML with `<script type="module" src="./frontend.tsx">`
- `src/frontend.tsx` → React root setup with HMR support
- `src/App.tsx` → Main app component
- `src/components/ui/*` → shadcn/ui components (Button, Card, Input, Select, etc.)
- `src/lib/utils.ts` → Utility functions (cn helper for Tailwind)

## File Structure

```
/src
  index.tsx          # Entry point: Bun.serve + MCP server (currently just HTTP)
  frontend.tsx       # React root with HMR support
  App.tsx            # Main app component
  APITester.tsx      # Example component for testing endpoints
  index.html         # HTML entry point
  index.css          # Global styles
  /components/ui/    # shadcn/ui components
  /lib/
    utils.ts         # Utilities (cn for class merging)
/styles              # Additional stylesheets
build.ts             # Production build script with CLI args
```

## Bun-Specific Patterns

**Prefer Bun APIs over Node.js equivalents:**
- Use `Bun.serve()` for HTTP/WebSocket (not Express)
- Use `Bun.file()` over `fs.readFile/writeFile`
- Use `bun test` for testing (not Jest/Vitest)
- Use `bun:sqlite` (not better-sqlite3)
- Bun automatically loads `.env` files

**HTML Imports Pattern:**
Bun allows importing HTML files directly into TypeScript and serving them with automatic bundling:
```ts
import index from "./index.html";
Bun.serve({
  routes: {
    "/": index,  // Serves HTML with bundled JS/CSS
  }
});
```

HTML files can `<script src="./frontend.tsx">` and Bun transpiles automatically.

## Build System

The `build.ts` script is a flexible production builder:
- Scans for `*.html` files in `src/`
- Uses `bun-plugin-tailwind` for Tailwind processing
- Supports CLI args: `--minify`, `--sourcemap`, `--outdir`, `--external`, etc.
- Run `bun run build.ts --help` for full options

Default output: `dist/`

## Styling

**Tailwind CSS v4** + **shadcn/ui:**
- Path aliases: `@/*` maps to `./src/*`
- Utility function: `cn()` from `src/lib/utils.ts` (clsx + tailwind-merge)
- Components use Radix UI primitives (@radix-ui/react-*)
- Class variance via `class-variance-authority`

## Environment Variables

Required for MCP operation (passed via MCP client config):
- `MCP_HTTP_PORT` - Port for HTTP/WS server (e.g., 53245)
- `ELEVENLABS_API_KEY` - ElevenLabs API key
- `ELEVEN_VOICE_ID` - Default voice (optional)
- `ELEVEN_MODEL_ID` - Model ID like `eleven_flash_v2_5` (optional)
- `ALLOWED_ORIGIN` - CORS configuration (optional)
- `LOG_LEVEL` - Logging level (default: error)
- `NODE_ENV` - Set to "production" to disable HMR

## Critical Constraints

1. **Never write to stdout** - MCP JSON-RPC uses it exclusively
2. **All logging goes to stderr** - Use `console.error()` for diagnostics
3. **Use Bun APIs** - Don't install Node.js equivalents (Express, fs-extra, etc.)
4. **Dynamic ports** - Never hard-code server ports; use `MCP_HTTP_PORT` env var
5. **HTML imports** - Follow Bun's pattern: serve HTML files that import .tsx directly

## Implementation Status

**Currently implemented:**
- Basic Bun.serve setup with route handling
- React 19 app with HMR support
- shadcn/ui component library
- API testing interface (APITester component)

**To be implemented (per Project_Scope.md):**
- MCP server with stdio transport
- Three MCP tools: speak(), listen(), action()
- WebSocket server for audio streaming
- ElevenLabs SDK integration for TTS
- Client queue management for listen() tool
- Browser audio player with MediaSource API

## Testing MCP Tools

Once implemented, test with MCP Inspector:
```bash
# Terminal 1: Run Inspector
npx @modelcontextprotocol/inspector bun src/index.tsx

# Terminal 2: Open browser to inspector URL
# Call tools: speak(), listen(), action()
```

## TypeScript Configuration

- Target: ESNext
- Module: Preserve (Bun bundler mode)
- JSX: react-jsx (React 19)
- Strict mode enabled
- Path aliases: `@/*` → `./src/*`

## Dependencies

**Core:**
- `react@19`, `react-dom@19`
- `bun-plugin-tailwind` - Tailwind processing during builds

**UI:**
- `@radix-ui/*` - Headless UI primitives
- `tailwindcss@^4.1`, `tailwindcss-animate`
- `class-variance-authority`, `clsx`, `tailwind-merge`
- `lucide-react` - Icon library

**To be added:**
- `@modelcontextprotocol/sdk` - MCP server implementation
- `@elevenlabs/elevenlabs-js` - Official ElevenLabs SDK with streaming

## Using the Voice MCP Server

### Configuration

This project includes a `.mcp.json` file that automatically configures the Voice MCP server with Claude Code.

**Setup:**

1. **Add your ElevenLabs API key** to `.mcp.json`:
   ```json
   {
     "env": {
       "ELEVENLABS_API_KEY": "your_api_key_here"
     }
   }
   ```

2. **Restart Claude Code** to load the MCP server

3. **Open the UI** in your browser at `http://localhost:53245`

### Available MCP Tools

When the server is running, Claude Code has access to three voice interaction tools:

#### `speak(text, clientId, voiceId?, modelId?)`
Converts text to speech and streams audio to the browser.

**Example:**
```typescript
speak("Hello! I'm Claude, and I can speak to you now!", "client-id-123")
```

**Parameters:**
- `text` (required): Text to convert to speech
- `clientId` (required): Client ID from the browser UI
- `voiceId` (optional): ElevenLabs voice ID (default: Rachel)
- `modelId` (optional): ElevenLabs model (default: eleven_flash_v2_5)

#### `listen(clientId, timeout_ms?)`
Waits for user input from the browser (voice or text).

**Example:**
```typescript
const response = await listen("client-id-123", 60000)
// Returns: { "text": "User's spoken or typed message" }
```

**Parameters:**
- `clientId` (required): Client ID to listen to
- `timeout_ms` (optional): Timeout in milliseconds (default: 60000)

**Note:** This tool blocks until the user sends a message or timeout occurs.

#### `action(text, clientId?)`
Sends status/action updates to the browser UI. These appear as collapsible sections attached to the LLM's response.

**Example:**
```typescript
action("Searching knowledge base...", "client-id-123")
action("Found 5 relevant documents", "client-id-123")
action("Analyzing document content...", "client-id-123")
```

**Parameters:**
- `text` (required): Action/status message to display
- `clientId` (optional): Specific client (omit to broadcast to all)

### Typical Usage Pattern

```typescript
// 1. Get the client ID from the browser UI
const clientId = "abc-123-def"; // Shown in UI header

// 2. Greet the user with voice
await speak("Hello! How can I help you today?", clientId);

// 3. Show what you're doing
await action("Waiting for user input...", clientId);

// 4. Listen for user response (blocks until user speaks/types)
const userInput = await listen(clientId);

// 5. Process and respond
await action("Processing your request...", clientId);
await speak(`You said: ${userInput.text}`, clientId);
```

### Conversation Flow Example

**User opens browser at `http://localhost:53245`:**
- Client ID is generated and displayed: `Client ID: abc-123`

**Claude Code calls:**
```typescript
// Start conversation
speak("Hi! I'm your voice assistant. What would you like to know?", "abc-123")

// Wait for response
action("Listening for your question...", "abc-123")
const response = listen("abc-123")

// Process
action("Thinking about your question...", "abc-123")
action("Searching for relevant information...", "abc-123")

// Respond
speak("Here's what I found...", "abc-123")
```

**User sees in browser:**
- Hears: "Hi! I'm your voice assistant..."
- Message bubble appears with collapsible actions
- Can speak or type response
- Hears: "Here's what I found..."

### Browser UI Features

**Three Speech Recognition Modes:**

1. **Manual Mode** (Default)
   - Click microphone to start/stop recording
   - Click Send to submit
   - Best for: Careful message composition

2. **PTT (Push-to-Talk)**
   - Hold microphone button while speaking
   - Release to automatically send
   - Best for: Quick voice messages

3. **Auto Mode**
   - Automatically sends after 1.5s of silence
   - Hands-free operation
   - Best for: Natural conversation flow

**Change mode:** Click Settings icon (⚙️) in top right

### Debugging

**Check if server is running:**
```bash
# Should see logs in stderr
curl http://localhost:53245/
```

**Check WebSocket connection:**
- Browser console should show: `[WS] Connected`
- UI header shows green dot and "Connected"

**Check MCP tools are registered:**
```bash
# Use MCP Inspector
npx @modelcontextprotocol/inspector bun src/index.tsx
```

### Environment Variables

The `.mcp.json` file configures:

- `ELEVENLABS_API_KEY` - Your API key (REQUIRED - add this!)
- `MCP_HTTP_PORT` - Server port (default: 53245)
- `ELEVEN_VOICE_ID` - Default voice (Rachel)
- `ELEVEN_MODEL_ID` - Default model (eleven_flash_v2_5 for speed)
- `NODE_ENV` - Set to production to disable HMR

### Port Configuration

If port 53245 is in use, change `MCP_HTTP_PORT` in `.mcp.json`:

```json
{
  "env": {
    "MCP_HTTP_PORT": "53246"
  }
}
```

Then connect to: `http://localhost:53246`

### Multi-Client Support

The server supports multiple simultaneous browser clients. Each gets a unique `clientId` shown in the UI header. Use the appropriate `clientId` when calling tools.

**Example with multiple users:**
```typescript
// Client 1: abc-123
speak("Hello User 1!", "abc-123")

// Client 2: def-456
speak("Hello User 2!", "def-456")

// Broadcast to all clients
action("Server maintenance in 5 minutes")
```

## Reference Documentation

See `Project_Scope.md` for complete technical specification including:
- Data flow diagrams
- Tool interface specifications
- WebSocket message formats
- Security considerations
- Acceptance criteria

See `QUICKSTART.md` for step-by-step setup and usage guide.
