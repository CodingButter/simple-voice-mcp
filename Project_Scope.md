# Project Scope: **Bun + MCP (stdio) + ElevenLabs + React (Tailwind v4 + shadcn/ui)**

> TL;DR — One Bun process that speaks, listens, and acts:
> • **MCP side** over classic **stdio** (quiet on `stdout`, chatty on `stderr`)
> • **Frontend side** via **HTTP + WebSocket** with `Bun.serve`
> • **TTS** via **ElevenLabs official JS SDK** (with optional WebSocket streaming)
> • **Single entry** `src/index.tsx` that wires it all together (your preference)

---

## 1) Vision & Goals

**Goal:** A tiny, self-contained agent runtime you can launch as an MCP server. It exposes three tools for the LLM:

- **speak(text, voice)** → generate speech with ElevenLabs and **stream** audio to the browser via WebSocket.
- **listen()** → block until text arrives from the UI (posted to an HTTP endpoint).
- **action(text)** → push status updates to the UI so humans see what the LLM is doing.

**Why this way:**

- MCP strongly prefers **stdio** transport; we’ll keep that pure and isolated. ([Model Context Protocol][1])
- Bun happily serves **HTTP + WebSocket** for the UI and data plane. ([Bun][2])
- ElevenLabs provides an official **TypeScript/JS SDK** (Node-compatible and Bun-supported) including **streaming** helpers; we’ll use it instead of hand-rolling the wire protocol. ([GitHub][3])

---

## 2) High-Level Architecture

**Single process** (Bun runtime):

- **MCP stdio server**: registers `speak`, `listen`, `action` tools with `@modelcontextprotocol/sdk` using `StdioServerTransport`. ([npm][4])
- **HTTP server**: `Bun.serve` serves:

  - `/` : minimal React UI (Tailwind v4 + shadcn/ui)
  - `/ws` : WebSocket for audio and status events
  - `/api/listen` : POST endpoint that feeds text into the `listen` tool’s queue

- **TTS layer**: ElevenLabs **official JS SDK** for standard streaming (`textToSpeech.stream`), with an option to switch to the **WebSocket “stream-input”** API when chunking/word alignment is needed. ([GitHub][3])

**Port/instance strategy:** The MCP client config passes env like `MCP_HTTP_PORT=53xxx`, so each spawned server gets its own port with no conflicts. (No hard-coded ports.)

---

## 3) User Stories

1. _As an LLM_, I call `speak` with text + optional voice settings and the `clientId`; the human hears my voice instantly in the browser.
2. _As an LLM_, I call `listen(clientId)` and block until the human posts text (or timeout).
3. _As an LLM_, I call `action("Thinking about receipts...")` and the UI shows a live status line.
4. _As an operator_, I run `bun run src/index.tsx` and test tools with MCP Inspector. ([npm][5])

---

## 4) Detailed Requirements

### 4.1 Tools (MCP)

- **speak**

  - **Input**: `{ text: string; clientId: string; voiceId?: string; modelId?: string; voiceSettings?: {...} }`
  - **Behavior**: streams audio to the browser over WS. Prefer SDK `textToSpeech.stream`. If we later need partial/chunked input or alignment, switch to ElevenLabs **WebSocket “stream-input”**. ([GitHub][3])
  - **Output**: `{ "ok": true }` (and/or a short text confirmation)

- **listen**

  - **Input**: `{ clientId: string; timeout_ms?: number }`
  - **Behavior**: awaits text pushed to an internal queue by **POST `/api/listen`**; returns the text or times out.
  - **Output**: `{ text: string }`

- **action**

  - **Input**: `{ text: string; clientId?: string }`
  - **Behavior**: sends a WS message so the UI logs status; optional broadcast if `clientId` omitted.
  - **Output**: `{ "ok": true }`

> Constraint: **No console logs to stdout** (MCP JSON-RPC stream). Use `console.error` for diagnostics. (That’s the traditional way.) ([npm][4])

### 4.2 HTTP & WebSocket API

- `GET /` → serves React app (Tailwind v4, shadcn/ui)
- `GET /client.js` → bundled client (if we inline, skip this)
- `WS /ws?clientId=UUID` → server tracks connected clients (Map of `clientId → ws`)

  - Server → Client messages:

    - `{type:"hello", clientId}`
    - `{type:"audio", mime?: "audio/mpeg", b64: string}` (or stream wrapper from SDK)
    - `{type:"action"|"info"|"error", text?: string, error?: string}`

  - Client → Server: (optional for future controls)

- `POST /api/listen` → `{ clientId, text }` pushes into that client’s queue.

### 4.3 Frontend (React + Tailwind v4 + shadcn/ui)

- Minimal page with:

  - **Audio player** that appends streamed chunks (MediaSource).
  - **Input** + **Send** button → POST `/api/listen`.
  - **Status console** showing `action/info/error` lines.

- Tailwind **v4** and shadcn/ui configured as per their current guidance for React 19/TW4. ([Tailwind CSS][6])

---

## 5) Tech Choices (and why)

- **Bun runtime**: single process, ultra-fast dev server, native `Bun.serve` with WS upgrade. ([Bun][2])
- **MCP TypeScript SDK**: first-party, exposes stdio transport cleanly. ([GitHub][7])
- **ElevenLabs official JS SDK** for TS/Node (Bun supported) with **streaming** primitives. Use this instead of raw fetch/WSS unless we need exotic features. ([GitHub][3])
- **Tailwind v4 + shadcn/ui**: modern utility CSS & headless components; v4 docs and shadcn Tailwind v4 guide are current. ([Tailwind CSS][6])

---

## 6) Project Structure

> You suggested a single `./src/index.tsx`. We can honor that while keeping things readable.

```
/src
  /mcp
    tools.ts           # register speak/listen/action here
  /server
    http.ts            # Bun.serve + WS + routes
    tts.ts             # ElevenLabs SDK wrapper(s)
  index.tsx            # ENTRY: imports http.ts + mcp/tools.ts; starts everything
  client/
    main.tsx           # React SPA
    app.tsx
    ui/...
/public                # (optional) static assets
/tailwind.config.{js|ts}  # TW v4 (or new @theme inline)
```

If you _really_ want **just** `src/index.tsx`, we’ll inline modules—but the above keeps Claude (and Future-You) from cursing Current-You.

---

## 7) Configuration & Environments

**Environment variables** (in MCP server config so each instance is isolated):

- `MCP_HTTP_PORT` (e.g., `53245`)
- `ELEVENLABS_API_KEY`
- `ELEVEN_VOICE_ID` (default voice)
- `ELEVEN_MODEL_ID` (e.g., `eleven_flash_v2_5` for low latency) ([GitHub][3])
- `ALLOWED_ORIGIN` (CORS for UI)
- `LOG_LEVEL` (“error” by default; remember, use stderr)

**MCP client config** example (Claude Desktop or similar) uses `command: "bun"` with `args: ["run","src/index.tsx"]` and the env block for ports/keys.

---

## 8) Data Flow (Happy Path)

1. UI connects `WS /ws?clientId=…` and shows “connected”.
2. LLM calls `action("Starting…", clientId)` → UI logs.
3. LLM calls `speak("Hello there", clientId)` → server streams ElevenLabs audio over WS; UI plays it as it arrives. (Using SDK stream primitive; fallback to WSS “stream-input” if chunking needed.) ([GitHub][3])
4. Human types into input → UI `POST /api/listen` → server enqueues → LLM’s `listen()` returns text.
5. Loop.

---

## 9) Security & Ops

- **No secrets to the browser**. Only server holds `ELEVENLABS_API_KEY`.
- **CORS** pinned to the served origin; **rate-limit** `/api/listen`.
- **WS auth**: lightweight `clientId` plus same-origin requirement is fine for local dev; for multi-user, add a signed token check.
- **Logs** to stderr only; stdout reserved for MCP messages. (Tradition matters.) ([npm][4])

---

## 10) Performance & UX

- Choose **`eleven_flash_v2_5`** for snappier responses; upgrade to higher-quality models if latency budgets allow. ([GitHub][3])
- Stream audio chunks as soon as SDK yields them (no buffering beyond codec needs).
- Optional enhancement: client-side `AudioWorklet` for smoother append under load (future work).

---

## 11) Build & Dev Workflow

- **Scaffold**: `bun init --react=shadcn` or `--react=tailwind` (both options exist in Bun’s init flow). ([Bun][8])
- **Install**:

  ```bash
  bun add @modelcontextprotocol/sdk @elevenlabs/elevenlabs-js react react-dom
  bun add -d typescript @types/react @types/react-dom
  ```

- **Run (MCP + UI in one process)**:

  ```bash
  MCP_HTTP_PORT=53245 ELEVENLABS_API_KEY=... bun run src/index.tsx
  ```

- **Debug tools with MCP Inspector**:

  ```bash
  npx @modelcontextprotocol/inspector bun src/index.tsx
  ```

  ([npm][5])

---

## 12) Deliverables

1. **Repository** with the structure above
2. **Working MCP tools** (`speak`, `listen`, `action`) + **minimal React UI**
3. **.env.example** and **MCP client config snippet**
4. **README** with run, test, and port-per-instance instructions
5. **Acceptance demo**:

   - Open UI, connect WS, press “Send” → `listen()` returns
   - Call `speak()` → audio plays in real time
   - Call `action()` → status lines appear

---

## 13) Acceptance Criteria

- Launching via MCP client spawns HTTP server on the configured port.
- **No stdout leakage** except MCP JSON-RPC frames.
- `speak/listen/action` all succeed from MCP Inspector. ([npm][5])
- Audio is **audible within ~<500ms** after first TTS chunk for short phrases (on Flash model). ([GitHub][3])
- Multiple instances can run concurrently on distinct ports without collision.

---

## 14) Risks & Mitigations

- **WS handshake quirks** (Bun upgrade sequence): follow Bun’s documented `fetch → server.upgrade()` pattern; avoid async pitfalls that cancel handshakes. ([Bun][2])
- **Tailwind v4 changes**: use current v4 docs and shadcn v4 guide. ([Tailwind CSS][6])
- **Model/API changes** in ElevenLabs: stick to the official SDK for stability and retries/timeouts. ([GitHub][3])

---

## 15) Open Questions (for Claude to decide while designing)

1. Stick to SDK streaming (`textToSpeech.stream`) only, or expose a flag to switch to WSS **stream-input** for chunked text? (WSS adds alignment and partial updates.) ([ElevenLabs][9])
2. Should `listen()` support **multi-utterance** sessions (return an array) or remain single-shot?
3. Do we want per-client **voice presets** persisted in `settings.json`, or purely via tool inputs?
4. Any need for **record-your-mic** in the UI to POST transcriptions (future STT)?
5. How strict should **CORS/auth** be for your expected deployment?

---

## 16) Next Steps

1. Scaffold with Bun (`bun init --react=shadcn` to get React + Tailwind + shadcn pre-wired). ([Bun][8])
2. Add dependencies (`@modelcontextprotocol/sdk`, `@elevenlabs/elevenlabs-js`). ([npm][4])
3. Implement `src/index.tsx` that:

   - starts `Bun.serve` (HTTP + WS),
   - registers MCP tools,
   - uses ElevenLabs SDK streaming to push audio frames.

4. Write **README** and **MCP config snippet** (env per instance).
5. Test end-to-end with MCP Inspector and the browser UI.

---

[1]: https://modelcontextprotocol.io/docs/concepts/transports?utm_source=chatgpt.com "Transports - Model Context Protocol"
[2]: https://bun.com/guides/websocket/simple?utm_source=chatgpt.com "Build a simple WebSocket server | Bun Examples"
[3]: https://github.com/elevenlabs/elevenlabs-js "GitHub - elevenlabs/elevenlabs-js: The official JavaScript (Node) library for the ElevenLabs API."
[4]: https://www.npmjs.com/package/%40modelcontextprotocol/sdk?utm_source=chatgpt.com "@modelcontextprotocol/sdk - npm"
[5]: https://www.npmjs.com/package/%40modelcontextprotocol/inspector?utm_source=chatgpt.com "@modelcontextprotocol/inspector - npm"
[6]: https://tailwindcss.com/blog/tailwindcss-v4?utm_source=chatgpt.com "Tailwind CSS v4.0"
[7]: https://github.com/modelcontextprotocol/typescript-sdk?utm_source=chatgpt.com "GitHub - modelcontextprotocol/typescript-sdk: The official TypeScript ..."
[8]: https://bun.com/docs/cli/init?utm_source=chatgpt.com "bun init – Templating | Bun Docs"
[9]: https://elevenlabs.io/docs/api-reference/text-to-speech/v-1-text-to-speech-voice-id-stream-input?utm_source=chatgpt.com "WebSocket | ElevenLabs Documentation"
