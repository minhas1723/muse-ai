<p align="center">
  <img src="icons/icon-128.png" width="80" height="80" alt="Muse" />
</p>

<h1 align="center">Muse</h1>

<p align="center">
  Free AI chat in your browser sidebar, powered by your Google quota.
</p>

<p align="center">
  <a href="https://github.com/minhas1723/muse-ai/releases/latest">
    <img src="https://img.shields.io/github/v/release/minhas1723/muse-ai?style=flat-square&label=download&color=7c3aed" alt="Latest Release" />
  </a>
  <a href="https://github.com/minhas1723/muse-ai/stargazers">
    <img src="https://img.shields.io/github/stars/minhas1723/muse-ai?style=flat-square&color=f59e0b" alt="Stars" />
  </a>
  <a href="https://github.com/minhas1723/muse-ai/blob/main/LICENSE">
    <img src="https://img.shields.io/github/license/minhas1723/muse-ai?style=flat-square" alt="License" />
  </a>
</p>

---

Muse is an open-source Chrome extension that puts a full AI chat assistant in your browser's side panel. It connects to Google's Cloud Code Assist API using the same free daily quota you get with Gemini CLI — so you can use models like **Gemini 3.0 Flash**, **Gemini 2.5 Pro**, **Claude Opus 4.6**, and **Claude Sonnet 4** without paying anything.

No API keys. No subscriptions. Just sign in and start chatting.

## Why Muse?

Google gives developers a generous free daily quota through tools like Gemini CLI and Antigravity. That quota usually goes unused. Muse lets you put it to work — summarize articles, explain code, brainstorm ideas, debug problems — all from a sidebar that's always one click away.

It can also **read the page you're on**. Toggle the page context button, and Muse will extract, chunk, and analyze the content intelligently. It diffs against previous reads so it doesn't waste tokens re-reading unchanged content.

## Features

- **Multiple models** — Gemini 3.0 Flash, Gemini 2.5 Pro/Flash, Claude Opus 4.6, Claude Sonnet 4
- **Page-aware** — reads, summarizes, and answers questions about any webpage
- **Smart chunking** — splits long pages into chunks and only reads what's needed
- **Dark mode** — light, dark, or system-matched themes
- **Adjustable text size** — small, normal, large, or extra large
- **Chat history** — conversations saved locally, browse or resume anytime
- **Custom system prompts** — tailor the AI's behavior to your needs
- **Privacy-first** — no third-party servers, data goes directly to Google's API
- **Open source** — read every line, fork it, improve it

## Install

### From Releases

1. Download the latest `muse-v*.zip` from [Releases](https://github.com/minhas1723/muse-ai/releases/latest)
2. Unzip it
3. Go to `chrome://extensions`
4. Turn on **Developer mode** (top right)
5. Click **Load unpacked** and select the unzipped folder
6. Click the Muse icon in your toolbar to open the side panel

### Build from source

```bash
git clone https://github.com/minhas1723/muse-ai.git
cd muse-ai
npm install
npm run build
```

Then load the `dist/` folder in `chrome://extensions`.

## Authentication

Muse supports two ways to sign in:

**Gemini CLI** — Uses the same OAuth flow as Google's official [Gemini CLI](https://github.com/google-gemini/gemini-cli). This gives you access to Gemini models through your free daily quota.

**Antigravity** — Uses credentials from Google's Antigravity coding tool. This gives you access to both Gemini and Claude models.

Both methods authenticate via Google OAuth. No API billing is involved — you're using the free tier that Google already provides.

## How page reading works

When you enable the page context toggle:

1. A content script extracts the visible text from the current page
2. The text gets split into chunks (~4000 characters each)
3. Muse takes a snapshot and compares it to previous reads
4. The AI has a `read_page_chunks` tool — it fetches only the chunks it needs
5. On subsequent reads, Muse provides a diff so the AI knows exactly what changed

This keeps things fast and quota-efficient, even on very long pages.

## Project structure

```
src/
  sidepanel.tsx          Main React UI
  background.ts         Service worker — streaming, tools, sessions
  content.ts             Content script — page text extraction
  gemini.ts              API client with SSE streaming
  auth.ts                OAuth login and token refresh
  providers.ts           Auth provider configurations
  chunker.ts             Page content chunking logic
  sessions.ts            Chat history management
  app.css                Global styles and theme variables
  hooks/useTheme.ts      Theme and font size preferences
  components/            UI components (chat, input, settings, etc.)
```

## Architecture

```
Chrome Side Panel (React)
    |
    | chrome.runtime.connect()
    v
Background Service Worker
    |-- Agentic tool loop (read_page_chunks)
    |-- Page snapshots + diffing
    |-- Session persistence
    |
    | fetch() with SSE streaming
    v
Google Cloud Code Assist API
    |-- Gemini models
    |-- Claude models (via Antigravity)
```

## Contributing

Bugs, feature requests, and pull requests are all welcome. Open an [issue](https://github.com/minhas1723/muse-ai/issues) or submit a PR.

## License

MIT

---

<p align="center">
  Built by <a href="https://github.com/minhas1723">minhas1723</a>
</p>
