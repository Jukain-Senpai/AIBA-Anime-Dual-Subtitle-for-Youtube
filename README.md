# AIBA - Japanese Dual-Subtitle for YouTube

AIBA is a Chrome Extension designed for Japanese language learners. It allows you to load custom `.srt` Japanese subtitle files on YouTube videos, giving you dual-subtitle capabilities with fine-tuned sync and styling controls.

## ✨ Features

- **Custom SRT Upload**: Drag and drop or select local `.srt` Japanese subtitle files.
- **Sync Offset Control**: Micro-adjust subtitle timing (`-1.0s`, `-0.1s`, `+0.1s`, `+1.0s`, or reset) to sync perfectly with YouTube video playback.
- **Customizable Appearance**:
  - **Positioning**: Top, Center, Bottom, or dynamic relative positioning (Above/Below YouTube native subtitles).
  - **Typography**: Adjust font size, select font families (Sans-Serif, Serif, Monospace).
  - **Colors & Transparency**: Customize text color, background color, background opacity, and text outline.
- **Persistent Settings**: Remembers loaded state and user preferences using `chrome.storage.local`.

## 🛠️ Tech Stack

- **Framework**: React 18 + TypeScript
- **Bundler**: Vite + Custom Node build script
- **Platform**: Chrome Extension (Manifest V3)

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- Google Chrome or any Chromium-based browser

### Installation & Build

1. Clone or download this repository.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Build the extension:
   ```bash
   npm run build
   ```
   *(This compiles TypeScript and builds assets into the `dist/` folder)*

### Loading into Chrome

1. Open Chrome and navigate to `chrome://extensions`.
2. Enable **Developer mode** using the toggle switch in the top right corner.
3. Click **Load unpacked**.
4. Select the `dist/` folder inside this project directory.
5. Open any YouTube video and click the AIBA extension icon to upload an `.srt` file and customize subtitle settings.

## 📜 Scripts

- `npm run build`: Build production assets into `dist/`
- `npm run dev`: Run Vite development server
