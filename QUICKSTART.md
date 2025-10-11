# Quick Start Guide

## 🚀 Get Started in 3 Steps

### 1. Install & Configure

```bash
# Install dependencies
bun install

# Set up environment
cp .env.example .env

# Edit .env and add your ElevenLabs API key
# Get one at: https://elevenlabs.io
```

### 2. Run Development Server

```bash
# Export your API key (or add to .env)
export ELEVENLABS_API_KEY="your_api_key_here"

# Start the server
bun dev
```

The server will start on `http://localhost:3000`

### 3. Open Your Browser

Navigate to `http://localhost:3000` and you'll see the Voice MCP Chat interface!

## 🎤 Using the Chat Interface

### Three Speech Recognition Modes

1. **Manual Mode** (Default)
   - Click the microphone button to start recording
   - Speak your message
   - Click the microphone again to stop
   - Click Send button to send

2. **PTT (Push-to-Talk) Mode**
   - Hold down the microphone button while speaking
   - Release to automatically send
   - Great for quick voice messages

3. **Auto Mode**
   - Just start speaking!
   - The system automatically sends after 1.5 seconds of silence
   - Most convenient for natural conversation

### Switching Modes

Click the Settings icon (⚙️) in the top right to access mode selection.

## 🔌 Using as an MCP Server

### Configure Claude Desktop

Add this to your Claude Desktop configuration:

**Location:**
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "voice-mcp": {
      "command": "bun",
      "args": ["run", "/absolute/path/to/simple-voice-mcp/src/index.tsx"],
      "env": {
        "ELEVENLABS_API_KEY": "your_api_key_here",
        "MCP_HTTP_PORT": "53245"
      }
    }
  }
}
```

### Available Tools

Once configured, Claude will have access to three new tools:

#### `speak(text, clientId)`
Converts text to speech and plays it in the browser
```
speak("Hello! How can I help you today?", "abc-123-def")
```

#### `listen(clientId)`
Waits for the user to speak or type a message
```
listen("abc-123-def")
// Returns: { "text": "What's the weather today?" }
```

#### `action(text, clientId)`
Shows status updates in the UI (collapsible actions section)
```
action("Checking weather API...", "abc-123-def")
action("Found weather data for your location", "abc-123-def")
```

## 🧪 Testing with MCP Inspector

Want to test the MCP tools before connecting Claude?

```bash
# Install MCP Inspector
npm install -g @modelcontextprotocol/inspector

# Run the inspector
export ELEVENLABS_API_KEY="your_key"
npx @modelcontextprotocol/inspector bun src/index.tsx
```

The inspector will open a web interface where you can:
- See all available tools
- Test tool calls with different parameters
- View responses and errors
- Monitor the MCP protocol in real-time

## 🎯 Example Conversation Flow

1. **Open the UI** at `http://localhost:3000`
2. **Note your Client ID** (shown in the header)
3. **Using Claude with the MCP server:**
   ```
   User: Can you talk to me about the weather?

   Claude:
   - Calls: speak("Let me check the weather for you", clientId)
   - UI plays audio: "Let me check the weather for you"
   - Calls: action("Checking weather API...", clientId)
   - Action appears below Claude's message
   - Calls: listen(clientId)
   - Waits for your voice/text input...
   - You speak: "Tell me about San Francisco"
   - Calls: speak("San Francisco has sunny weather today!", clientId)
   ```

## 🔧 Troubleshooting

### No Audio Playing
- Check that your browser supports Web Audio API (Chrome/Edge recommended)
- Verify your ElevenLabs API key is valid
- Check browser console for errors
- Ensure speakers/headphones are connected

### Speech Recognition Not Working
- Use Chrome or Edge (best compatibility)
- Grant microphone permissions when prompted
- Check browser console for Web Speech API errors
- Try a different recognition mode

### WebSocket Connection Failed
- Ensure the server is running (`bun dev`)
- Check that no other service is using port 3000
- Verify firewall settings
- Try a different port via `MCP_HTTP_PORT` env var

### MCP Tools Not Showing in Claude
- Verify your `claude_desktop_config.json` path is correct
- Use **absolute paths** in the configuration
- Restart Claude Desktop after config changes
- Check Claude's developer console for errors

## 📚 Next Steps

- Read [README.md](./README.md) for detailed documentation
- Check [Project_Scope.md](./Project_Scope.md) for technical specifications
- Review [CLAUDE.md](./CLAUDE.md) for development guidelines
- Explore the source code in `src/`

## 💡 Tips

- **Lower Latency**: The default model `eleven_flash_v2_5` is optimized for speed
- **Better Quality**: Set `ELEVEN_MODEL_ID=eleven_multilingual_v2` for higher quality
- **Different Voice**: Change `ELEVEN_VOICE_ID` to use other ElevenLabs voices
- **Multiple Instances**: Each instance needs a unique `MCP_HTTP_PORT`

---

**Need help?** Check the issues on GitHub or refer to the documentation files.
