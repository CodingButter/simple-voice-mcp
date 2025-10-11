# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Project Overview

This is a **WebGL Shader Material System Documentation & Learning Platform** with TTS (text-to-speech) support.

**Current State**: Vanilla HTML/CSS/JS documentation site with ElevenLabs TTS integration
**Future Vision**: React webapp + Chrome extension for universal documentation TTS

### Goals

1. **Educational Guide**: Comprehensive documentation for implementing a WebGL shader material system
2. **Accessible Learning**: TTS audio support for learning by listening
3. **Universal Tool**: Chrome extension that adds TTS to ANY documentation site (MDN, React docs, etc.)

---

## Current Architecture (Vanilla Implementation)

### Technology Stack

- **Frontend**: Vanilla HTML/CSS/JavaScript
- **TTS**: ElevenLabs API with SSML markup
- **Syntax Highlighting**: Prism.js
- **Storage**: LocalStorage for settings

### File Structure

```
shader_material_guide/
├── index.html              # Complete documentation (224KB single file)
├── css/                    # Stylesheets
├── js/
│   ├── audio.js            # TTS audio system (ElevenLabs integration)
│   ├── navigation.js       # Page navigation, sidebar
│   ├── code-blocks.js      # Syntax highlighting, copy buttons
│   ├── settings.js         # User preferences
│   ├── main.js             # Entry point
│   └── ...
├── ShaderMaterialStrat.md  # Implementation strategy
├── REACT_EXTENSION_PLAN.md # Future architecture
└── NEXT_STEPS.md           # Migration roadmap
```

### Documentation Structure

The guide contains **16 pages** covering:

**Core Components**:
- UniformManager - Manages uniform values and WebGL binding
- AttributeManager - Manages vertex attributes
- ShaderCompiler - Composes GLSL shader code
- ShaderProgram - Wraps WebGLProgram with utilities

**Consumer API**:
- MeshShaderMaterial - Main user-facing material class

**Integration**:
- ProgramCache - Shader program caching
- WebGLRenderer - Rendering integration

**Usage Guides**:
- Basic Usage, Animated Shaders, Textures, Shader Chunks, Migration

### Content Guidelines

**Structure** (per page):
```
1. Concept Explanation
2. Individual Code Sections (each function/method separately)
3. Usage Examples
4. Complete File (collapsed at bottom)
```

**Code Blocks**:
- Each function gets its own copyable code block
- Line-by-line comments explaining WHAT and WHY
- TODO comments showing implementation location
- Progressive detail (simple → complex)

**Example Structure**:
```html
<div class="page" id="uniform-manager">
  <h1>Implementing UniformManager</h1>

  <h2 id="understanding">Understanding Uniforms</h2>
  <p>Educational content...</p>

  <h2 id="class-structure">Class Structure</h2>
  <div class="code-block" data-state="full">
    <div class="code-header">
      <span>UniformManager - Constructor</span>
      <div class="code-header-actions">
        <button class="copy-btn">Copy</button>
      </div>
    </div>
    <pre><code class="language-typescript">
// TODO: Create at /packages/threeme/src/materials/shader/UniformManager.ts
export class UniformManager {
  private uniforms: Map<string, UniformDefinition> = new Map();

  constructor(builtInUniforms: UniformDefinition[] = []) {
    // Initialize with built-in uniforms
    builtInUniforms.forEach(u => this.uniforms.set(u.name, u));
  }
}
    </code></pre>
  </div>

  <div class="note">
    <div class="note-title">💡 Design Pattern</div>
    <p>We use a Map for O(1) lookups...</p>
  </div>
</div>
```

---

## TTS Audio System

### Architecture (`js/audio.js`)

**Key Components**:
- `AudioManager` - Main orchestrator
- Chunking - Splits content into speakable segments
- Caching - Stores generated audio
- Auto-navigation - Moves through sections/pages

**Content Chunking Strategy**:
```javascript
function getSectionsInPage() {
  // 1. Find all headings (h1-h6)
  // 2. Find paragraphs
  // 3. Find code blocks
  // 4. Combine into sections array
  return sections;
}
```

**SSML Requirements** (User Preference):
- Start all TTS with: `<break time="1s"/>`
- Use robust SSML markup: `<emphasis>`, `<prosody rate="95%">`, `<break time="500ms"/>`
- Speak phonetically when needed

**Bug Fixes Applied**:
- Fixed `allSections` array not clearing on page navigation (caused replay bug)
- Audio now stops cleanly when navigating between pages

### ElevenLabs Integration

**Configuration** (in Settings panel):
- API Key (stored in localStorage)
- Voice ID selection
- Stability (0.0 - 1.0)
- Similarity Boost (0.0 - 1.0)
- TTS Toggle (on/off state persists)

**API Call Pattern**:
```javascript
async function generateAudio(text) {
  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text,  // With SSML markup
        model_id: 'eleven_multilingual_v2',
        voice_settings: { stability, similarity_boost }
      })
    }
  );
  return await response.arrayBuffer();
}
```

---

## Future Architecture (React + Chrome Extension)

See `REACT_EXTENSION_PLAN.md` for complete details.

### Monorepo Structure (Planned)

```
tts-documentation-reader/
├── packages/
│   ├── core-audio/
│   │   ├── AudioManager.ts
│   │   ├── ChunkProcessor.ts
│   │   └── SettingsManager.ts
│   │
│   ├── content-detection/
│   │   ├── ContentDetector.ts
│   │   ├── SiteAdapter.ts
│   │   └── adapters/
│   │       ├── MDNAdapter.ts
│   │       ├── ReactDocsAdapter.ts
│   │       └── CustomAdapter.ts (for shader guide)
│   │
│   ├── react-components/
│   │   ├── AudioControls.tsx
│   │   ├── ReadSectionButton.tsx
│   │   └── SettingsPanel.tsx
│   │
│   ├── shader-guide-react/  # React webapp
│   │   ├── src/
│   │   │   ├── pages/       # MDX content
│   │   │   ├── components/  # Layout, Sidebar, TOC
│   │   │   └── stores/      # Zustand state
│   │   └── vite.config.ts
│   │
│   └── chrome-extension/     # Browser extension
│       ├── manifest.json
│       ├── src/
│       │   ├── content/      # Injected into pages
│       │   ├── background/   # Service worker
│       │   └── popup/        # Extension popup
│       └── webpack.config.js
```

### Adapter Pattern

The system will detect documentation sites and use appropriate adapters:

```typescript
interface SiteAdapter {
  name: string;

  // Selectors
  getHeadingSelector(): string;
  getContentContainerSelector(): string;
  getNavigationSelector(): string;

  // Content processing
  shouldIncludeElement(element: HTMLElement): boolean;
  extractSectionContent(heading: HTMLElement): HTMLElement[];

  // Navigation
  getNextPageElement(): HTMLElement | null;
  getPreviousPageElement(): HTMLElement | null;
}
```

**Example - MDNAdapter**:
```typescript
class MDNAdapter implements SiteAdapter {
  name = 'MDN Web Docs';

  getHeadingSelector() {
    return 'article h2, article h3';
  }

  getContentContainerSelector() {
    return 'article.main-page-content';
  }

  shouldIncludeElement(element: HTMLElement): boolean {
    // Skip interactive examples, browser compat tables
    if (element.closest('.interactive-example')) return false;
    if (element.closest('.bc-table')) return false;
    return true;
  }

  // ... other methods
}
```

### Technology Stack (Future)

| Component | Technology | Why |
|-----------|-----------|-----|
| Monorepo | pnpm workspaces | Fast, efficient dependency sharing |
| Build Tool | Vite | Fast dev server, modern |
| Framework | React 18 | Component-based, popular |
| Routing | React Router 7 | Standard for React SPAs |
| Styling | Tailwind CSS v4 | Utility-first, consistent |
| Content | MDX | Markdown + React components |
| State | Zustand | Lightweight, simple |
| Extension | Manifest V3 | Latest Chrome standard |
| Language | TypeScript | Type safety |

---

## Development Workflow

### Current (Vanilla)

**Adding a New Guide Page**:

1. Add nav item:
```html
<div class="nav-item" data-page="new-page">New Page</div>
```

2. Add page content:
```html
<div class="page" id="new-page">
  <h1>Page Title</h1>
  <!-- Content here -->
</div>
```

3. Follow content structure guidelines

**Enhancing Content**:

1. Read existing content to understand detail level
2. Break complex topics into subsections
3. Add individual copyable code blocks
4. Include explanatory notes
5. Test TTS audio

**Testing TTS**:

```bash
# Open in browser
open index.html  # macOS
start index.html # Windows

# Configure in Settings:
# - Add ElevenLabs API key
# - Select voice
# - Enable TTS toggle

# Click play to test
```

### Future (React)

**Phase 1: Core Packages**
```bash
cd tts-documentation-reader
pnpm init
# Set up workspace
# Build core-audio, content-detection, react-components
```

**Phase 2: React Webapp**
```bash
cd packages/shader-guide-react
# Convert HTML content to MDX
# Build Layout, Sidebar, TOC components
# Integrate audio system
```

**Phase 3: Chrome Extension**
```bash
cd packages/chrome-extension
# Set up manifest.json
# Build content script
# Create popup UI
# Test on MDN, React docs, etc.
```

---

## Migration Strategy

### Content Conversion (HTML → MDX)

**Before** (HTML):
```html
<div class="page" id="uniform-manager">
  <h1>UniformManager</h1>
  <p>Content here...</p>

  <div class="code-block">
    <pre><code class="language-typescript">
      export class UniformManager { }
    </code></pre>
  </div>
</div>
```

**After** (MDX):
```mdx
---
title: UniformManager
order: 3
---

# Implementing UniformManager

Content here...

<CodeBlock language="typescript" title="Class Structure">
{`export class UniformManager { }`}
</CodeBlock>
```

### Audio System Migration

**Port vanilla JS to TypeScript**:
- `audio.js` → `packages/core-audio/src/AudioManager.ts`
- Extract chunking → `ChunkProcessor.ts`
- Extract settings → `SettingsManager.ts`
- Keep ElevenLabs integration patterns

**Reuse Patterns**:
- Same chunking strategy
- Same caching approach
- Same auto-navigation logic
- Same SSML requirements

---

## Common Development Tasks

### Adding Documentation Content

**Current (Vanilla)**:
1. Find page div in `index.html`
2. Add content following structure guidelines
3. Test TTS audio

**Future (React)**:
1. Create MDX file in `packages/shader-guide-react/src/pages/`
2. Add frontmatter metadata
3. Use MDX components for code blocks, notes
4. Test hot reload

### Testing TTS Locally

**Current**:
- Open `index.html` in browser
- Configure ElevenLabs API key
- Click play button

**Future (Extension)**:
- Load unpacked extension in Chrome
- Visit MDN or React docs
- Click injected "🎧" buttons
- Test audio playback

### Debugging Audio Issues

**Common Issues**:
- **Replay bug**: Clear `allSections` array on stop
- **SSML errors**: Validate SSML before sending to API
- **Cache issues**: Clear audio cache in settings
- **Navigation**: Check `waitForSectionsAndPlay` logic

---

## Key Files

### Current (Vanilla)

**Content**:
- `index.html` - All documentation (224KB)

**Scripts**:
- `js/audio.js` - TTS system (17KB)
- `js/navigation.js` - Page navigation
- `js/code-blocks.js` - Syntax highlighting
- `js/settings.js` - User preferences

**Documentation**:
- `ShaderMaterialStrat.md` - Implementation guide
- `REACT_EXTENSION_PLAN.md` - Future architecture
- `NEXT_STEPS.md` - Migration roadmap

### Future (React)

**Core Packages**:
- `packages/core-audio/src/**/*.ts`
- `packages/content-detection/src/**/*.ts`
- `packages/react-components/src/**/*.tsx`

**Webapp**:
- `packages/shader-guide-react/src/pages/*.mdx`
- `packages/shader-guide-react/src/components/*.tsx`

**Extension**:
- `packages/chrome-extension/manifest.json`
- `packages/chrome-extension/src/content/content.ts`
- `packages/chrome-extension/src/background/service-worker.ts`

---

## Important Notes

### TTS Requirements (User Preference)

From `.claude/settings.local.json` and user instructions:
- ✅ Start all TTS with `<break time="1s"/>`
- ✅ Use robust SSML markup
- ✅ Speak phonetically when needed
- ✅ Carry over TTS toggle state (on/off)

### Content Quality Standards

- ✅ Educational focus (not just reference)
- ✅ Individual copyable code sections
- ✅ Step-by-step explanations
- ✅ Conceptual foundations before code
- ✅ Real-world usage examples
- ✅ TODO comments in code

### Extension Vision

The Chrome extension will:
1. Detect documentation site (MDN, React docs, etc.)
2. Use appropriate adapter for that site
3. Inject "🎧" buttons next to headings
4. Provide audio controls for playback
5. Auto-navigate through documentation
6. Work on **any** site with consistent structure

---

## Project Status

**Current**: Vanilla guide is COMPLETE with 16 pages of detailed documentation
**Next**: Begin React migration (see NEXT_STEPS.md for roadmap)

**No Git Repository Yet**: Consider initializing when starting React work

---

## Related Documentation

- **CLAUDE.md** (root) - Quick reference for this project
- **ShaderMaterialStrat.md** - Complete WebGL shader system implementation guide
- **REACT_EXTENSION_PLAN.md** - Detailed architecture for React + Extension
- **NEXT_STEPS.md** - Step-by-step migration roadmap
