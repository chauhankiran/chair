# Video Recorder & Player

A simple Electron-based video recorder and player application, similar to QuickTime Player on macOS.

## Features

- **Video Recording**: Record video from your webcam with audio
- **Video Playback**: Play recorded videos or open existing video files
- **File Support**: Open MP4, WebM, MOV, AVI, and MKV files
- **Save Recordings**: Save your recordings as WebM files
- **Modern UI**: Clean, dark-themed interface with intuitive controls

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Space` | Play/Pause or Start Recording |
| `R` | Start New Recording |
| `Escape` | Stop Recording / Exit Fullscreen |
| `M` | Toggle Mute |
| `F` | Toggle Fullscreen |
| `←` | Seek backward 5 seconds |
| `→` | Seek forward 5 seconds |
| `↑` | Increase volume |
| `↓` | Decrease volume |
| `Cmd/Ctrl + O` | Open video file |
| `Cmd/Ctrl + S` | Save recording |

## Installation

```bash
# Install dependencies
npm install

# Run the application
npm start
```

## Development

```bash
# Run in development mode
npm start

# Build for production
npm run build
```

## Requirements

- Node.js 18+
- npm or yarn
- Webcam and microphone (for recording)

## Tech Stack

- Electron 28
- MediaRecorder API for video recording
- HTML5 Video for playback
