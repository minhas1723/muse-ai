# Gemini Side Chat — Chrome Extension

AI chat assistant powered by Google Gemini, living in your browser's side panel.

## Features

- 🔐 **Google OAuth Login** — Uses the same authentication as Gemini CLI (PKCE + code exchange)
- 💬 **Streaming Chat** — Real-time SSE streaming responses from Gemini
- 📌 **Side Panel** — Lives in Chrome's side panel, always accessible
- 💾 **Persistent Storage** — Chat history and auth tokens saved via `chrome.storage.local`
- 🌙 **Dark Theme** — Premium dark UI optimized for side panel dimensions
- 🧠 **Multiple Models** — Switch between gemini-2.5-flash, gemini-2.5-pro, gemini-3-pro-preview, etc.
- ✨ **Markdown Rendering** — Code blocks, bold, italic, lists, and headings

## Quick Start

```bash
# Install dependencies
npm install

# Build the extension
npm run build

# Load in Chrome:
# 1. Go to chrome://extensions/
# 2. Enable "Developer mode"
# 3. Click "Load unpacked"
# 4. Select the `dist/` folder
```

## Project Structure

```
├── manifest.json           # Chrome extension manifest (MV3)
├── sidepanel.html          # Side panel HTML shell
├── src/
│   ├── auth.ts             # OAuth login, token refresh, chrome.storage
│   ├── gemini.ts           # Gemini API calls (streaming SSE)
│   ├── background.ts       # Service worker (message passing, streaming)
│   ├── sidepanel.tsx        # React chat UI
│   └── sidepanel.css        # Dark theme styles
├── icons/                  # Extension icons (16, 48, 128)
├── scripts/
│   └── copy-static.mjs     # Post-build: copy static files to dist/
├── vite.config.ts          # Build config (two entry points)
└── dist/                   # Built extension (load this in Chrome)
```

## Architecture

```
┌─────────────────────────────────────┐
│         Chrome Side Panel           │
│  sidepanel.tsx (React UI)           │
│    ↕ chrome.runtime.sendMessage()   │
│    ↕ chrome.runtime.connect()       │
├─────────────────────────────────────┤
│      Background Service Worker      │
│  background.ts                      │
│    ├── auth.ts (OAuth + storage)    │
│    └── gemini.ts (API calls)        │
├─────────────────────────────────────┤
│      chrome.storage.local           │
│    ├── auth: { tokens, email, ... } │
│    └── chatHistory: Message[]       │
└─────────────────────────────────────┘
```

## Auth Flow

Uses Google OAuth 2.0 with PKCE via `chrome.identity.launchWebAuthFlow()`:

1. Generate PKCE verifier + challenge (Web Crypto API)
2. Open Google consent popup
3. Exchange auth code for access + refresh tokens
4. Discover project ID via Cloud Code Assist API
5. Store credentials in `chrome.storage.local`
6. Auto-refresh tokens when expired

## Reference

The `everything-u-need-to-know-about-auth/` folder contains the original research and extracted OAuth constants from OpenClaw/Gemini CLI.
