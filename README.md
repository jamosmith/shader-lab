# Shader Lab

A simple shader gallery that lets AI and humans create, view, and render GLSL shaders.

Browse the gallery in your browser, ask an AI to write a new shader, and watch it appear live. If you want a video, use the built-in renderer to export an MP4.

---

## Quick Start (Viewing the Gallery)

All you need is a modern browser and Node.js.

### 1. Clone the repo

If you don't have Git yet, grab it from [git-scm.com](https://git-scm.com/).

```
git clone <repo-url>
cd shader
```

### 2. Install Node.js

You need Node.js to serve the gallery (and later to render videos). If you already have it, skip ahead.

1. Go to [nodejs.org](https://nodejs.org/) and download the **LTS** version.
2. Run the installer and follow the prompts (the defaults are fine).
3. Open a new terminal and verify it worked:

```
node --version
```

If it prints a version number (e.g. `v20.x.x`), you're good. The `npx` command is included with Node.js automatically.

### 3. Start a local server

You need a local web server because browsers block loading files directly from disk.

```
npx serve .
```

Once the server starts, open the URL it prints (usually `http://localhost:3000`) in your browser. That's it — you'll see the gallery.

> **Tip:** Any static file server works. Python users can run `python3 -m http.server 8000` instead.

---

## Creating a Shader with AI

The recommended way to create a shader is with an AI coding agent. This works with Cursor, Claude Code, Windsurf, or any tool that can see and edit files in a directory.

### Steps

1. Open this project folder in your AI tool of choice.
2. Give it the prompt below (or make up your own — just include the rules section).
3. The AI will add your shader's GLSL source and registry entry to `index.html`.
4. Refresh the gallery in your browser. Your new shader appears at the top under **"your shaders"**.

### Sample Prompt

Copy this and replace the `[YOUR IDEA]` part with whatever you want to see:

```
Write a new WebGL2 fragment shader for the Shader Lab gallery in this project.

MY IDEA: [YOUR IDEA — e.g. "an underwater coral reef with sunlight filtering through waves"
or "a cyberpunk city skyline at night with neon rain"]

Follow the shader creation rules in .cursor/rules/shader-creation.mdc
```

> **Why not reference an existing shader?** Pointing the AI at a specific shader tends to produce a reskin of that shader rather than something new. The rules file gives the AI everything it needs to write a compatible shader from scratch.

> **Not using Cursor?** The shader creation rules live in `.cursor/rules/shader-creation.mdc`. You can paste them directly into your prompt if your AI tool doesn't support Cursor rules.

---

## Rendering a Video

The gallery includes an offline renderer that captures frames and pipes them through ffmpeg to produce an MP4. This is a developer tool — it's not fast, but it works.

### Prerequisites

You need three things installed:

| Tool | What it does | Install |
|------|-------------|---------|
| **Node.js** | Runs the renderer script | [nodejs.org](https://nodejs.org/) (LTS) |
| **ffmpeg** | Encodes the video | [ffmpeg.org/download](https://ffmpeg.org/download.html) — or `brew install ffmpeg` on Mac |
| **Puppeteer** | Headless browser for screenshots | Installed via npm (see below) |

### Setup (one time)

```
cd shader
npm install
```

This installs Puppeteer (which downloads a local copy of Chromium).

### Generate a render command

The easiest way to build the right command:

1. Open the gallery in your browser and click into a shader.
2. Set the **speed**, **duration**, **fps**, and **format** you want in the controls at the bottom.
3. Click one of the resolution buttons (**720p**, **1080p**, or **4K**). This copies a ready-to-paste command to your clipboard.
4. Open a terminal in the project directory and paste it. Hit enter.

The command looks something like:

```
node render.js 4200 --shader=synthwave_nebula --width=1920 --height=1080 --fps=30 --format=jpeg --speed=1.0000
```

### Manual usage

```
node render.js <seconds> [options]
```

The first positional argument is the **duration in seconds**.

| Option | Default | Description |
|--------|---------|-------------|
| `--shader=ID` | `synthwave_nebula` | Which shader to render |
| `--width=N` | `1920` | Width in pixels |
| `--height=N` | `1080` | Height in pixels |
| `--fps=N` | `30` | Frames per second |
| `--format=FMT` | `jpeg` | Screenshot format (`jpeg` or `png`) |
| `--quality=N` | `95` | JPEG quality (1–100) |
| `--crf=N` | `18` | H.264 quality (0–51, lower = better) |
| `--speed=N` | `1.0` | Playback speed multiplier |
| `--output=FILE` | auto | Output filename |

### Examples

```
node render.js 30                             # 30-second test render
node render.js 300 --shader=deep_space_nebula # 5 minutes of Deep Space Nebula
node render.js 4200 --width=3840 --height=2160 # 70 minutes at 4K
```

> **Heads up:** Rendering is slow. A 70-minute 1080p render at 30fps is 126,000 frames — each one is a headless browser screenshot. Budget real time accordingly, or start with a short test.

---

## Project Structure

```
shader/
├── index.html                 # Gallery and shader viewer (all-in-one)
├── render.js                  # Offline video renderer
├── package.json               # Node dependencies (puppeteer)
├── synthwave_nebula.html      # Standalone shader page
├── deep_space_nebula.html     # Standalone shader page
├── gas_giant_flyby.html       # Standalone shader page
└── README.md                  # You are here
```

- **Shaders live inline** in `index.html` inside the `S` object. Each shader is a GLSL ES 3.00 fragment shader stored as a JavaScript template string.
- The **`userShaders`** array (top of the registry in the `<script>` tag) is where new shaders go. They appear first in the gallery.
- The **`builtinShaders`** array holds the shaders that ship with the repo.
- The standalone `.html` files are full-screen single-shader pages used by the renderer.

---

## Troubleshooting

**"WebGL2 required" error** — Your browser doesn't support WebGL2. Try a recent version of Chrome, Firefox, or Edge.

**`npx serve .` doesn't work** — Make sure Node.js is installed. Run `node --version` to check. If it prints a version number, try `npx serve .` again. If not, install Node from [nodejs.org](https://nodejs.org/).

**Renderer fails with "ffmpeg not found"** — Install ffmpeg and make sure it's on your PATH. Run `ffmpeg -version` to verify.

**Renderer fails with "Cannot find module puppeteer"** — Run `npm install` in the project directory first.
