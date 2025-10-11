# Claude Code Setup Guide

## 🎯 Quick Setup (3 Steps)

### Step 1: Add Your API Key

Edit `.mcp.json` and add your ElevenLabs API key:

```json
{
  "env": {
    "ELEVENLABS_API_KEY": "sk_your_api_key_here"
  }
}
```

Get your API key at: https://elevenlabs.io/app/settings/api-keys

### Step 2: Restart Claude Code

The server will automatically start when Claude Code launches (configured with `autoStart: true`).

### Step 3: Open the Browser UI

Navigate to: **http://localhost:53245**

You'll see your Client ID in the header (e.g., `abc-123-def-456`). Use this ID when calling the MCP tools.

---

## 🎤 Using the Voice MCP Tools

### Available Tools

Claude Code now has access to three voice interaction tools:

#### 1. `speak` - Text to Speech
```typescript
speak("Hello! I can talk to you now!", "your-client-id")
```

#### 2. `listen` - Wait for User Input
```typescript
const response = listen("your-client-id")
// Blocks until user speaks or types
// Returns: { "text": "User's message" }
```

#### 3. `action` - Show Status Updates
```typescript
action("Searching documents...", "your-client-id")
action("Found 5 results", "your-client-id")
```

### Example Conversation

```typescript
// Get client ID from browser UI (e.g., "abc-123")
const clientId = "abc-123";

// Greet user with voice
speak("Hi! How can I help you today?", clientId);

// Show status
action("Waiting for your question...", clientId);

// Wait for user to speak or type
const userMessage = listen(clientId);

// Process and respond
action("Processing your request...", clientId);
speak(`You asked: ${userMessage.text}. Here's my answer...`, clientId);
```

---

## 🎚️ Browser UI Features

### Three Speech Modes

Access via Settings icon (⚙️):

1. **Manual** - Click mic, speak, click send
2. **PTT** - Hold mic button while speaking
3. **Auto** - Auto-sends after 1.5s silence

### Message Display

- User messages: Blue bubbles on the right
- Assistant audio: Gray bubbles on the left
- Actions: Collapsible section below each message

---

## 🔧 Configuration Options

Edit `.mcp.json` to customize:

```json
{
  "env": {
    "ELEVENLABS_API_KEY": "your_key",
    "MCP_HTTP_PORT": "53245",           // Change if port is in use
    "ELEVEN_VOICE_ID": "21m00Tcm4TlvDq8ikWAM",  // Different voice
    "ELEVEN_MODEL_ID": "eleven_flash_v2_5"       // Different model
  }
}
```

**Available Voices:**
- `21m00Tcm4TlvDq8ikWAM` - Rachel (default, female)
- `29vD33N1CtxCmqQRPOHJ` - Drew (male)
- `EXAVITQu4vr4xnSDxMaL` - Bella (female)
- Browse more at: https://elevenlabs.io/voice-library

**Available Models:**
- `eleven_flash_v2_5` - Fast, low latency (default)
- `eleven_multilingual_v2` - Higher quality, slower
- `eleven_turbo_v2_5` - Fastest, lower quality

---

## 🐛 Troubleshooting

### Server Not Starting

```bash
# Check if server is running
curl http://localhost:53245/

# Check Claude Code logs for errors
# Look for [MCP] or [HTTP] prefixed messages
```

### No Audio Playing

1. Check browser console for errors
2. Verify API key is correct in `.mcp.json`
3. Test with MCP Inspector:
   ```bash
   bun install
   npx @modelcontextprotocol/inspector bun src/index.tsx
   ```

### Speech Recognition Not Working

1. Use Chrome or Edge (best compatibility)
2. Grant microphone permissions
3. Check browser console for Web Speech API errors
4. Try different mode (Manual → PTT → Auto)

### Port Already in Use

Change `MCP_HTTP_PORT` in `.mcp.json`:
```json
{
  "env": {
    "MCP_HTTP_PORT": "53246"
  }
}
```

Then open: `http://localhost:53246`

---

## 📝 Notes

- **Client ID**: Each browser tab gets a unique ID. Use this when calling tools.
- **Multiple Clients**: The server supports multiple simultaneous users.
- **Logging**: All logs go to stderr (not stdout) - MCP protocol requirement.
- **Auto-Start**: Server starts automatically with Claude Code (`autoStart: true`).

---

## 🚀 Next Steps

1. ✅ Add API key to `.mcp.json`
2. ✅ Restart Claude Code
3. ✅ Open browser to `http://localhost:53245`
4. ✅ Note your Client ID from the UI
5. ✅ Try the example conversation above!

For more details, see:
- **QUICKSTART.md** - Detailed setup guide
- **CLAUDE.md** - Development documentation
- **README.md** - Full project documentation
