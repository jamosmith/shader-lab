/**
 * SYNTHWAVE NEBULA — Offline Renderer
 * 
 * SETUP (one time):
 *   npm init -y
 *   npm install puppeteer
 *   Make sure ffmpeg is installed (https://ffmpeg.org/download.html)
 * 
 * USAGE:
 *   node render.js <seconds> [options]
 * 
 * The first argument is the render duration in seconds.
 * 
 * OPTIONS:
 *   --width=N       Width in pixels (default: 1920)
 *   --height=N      Height in pixels (default: 1080)
 *   --fps=N         Frames per second (default: 30)
 *   --format=FORMAT Screenshot format: png or jpeg (default: jpeg)
 *   --quality=N     JPEG quality 1-100 (default: 95)
 *   --crf=N         H.264 quality 0-51, lower=better (default: 18)
 *   --output=FILE   Output filename (default: auto-generated)
 * 
 * EXAMPLES:
 *   node render.js 30                           # 30s test, fast defaults
 *   node render.js 4200                         # 70 min, 1080p 30fps
 *   node render.js 300 --width=1280 --height=720  # 5 min, 720p
 *   node render.js 4200 --fps=24 --format=jpeg  # 70 min, 24fps, fast
 *   node render.js 60 --format=png --crf=15     # 1 min, max quality
 */

const puppeteer = require('puppeteer');
const { spawn } = require('child_process');

// === PARSE CLI ARGS ===
function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    width: 1920,
    height: 1080,
    fps: 30,
    format: 'jpeg',
    quality: 95,
    crf: 18,
    speed: 1.0,
    shader: 'synthwave_nebula',
    output: null,
    seconds: null,
  };

  for (const arg of args) {
    if (arg.startsWith('--')) {
      const [key, val] = arg.slice(2).split('=');
      if (key === 'width') opts.width = parseInt(val);
      else if (key === 'height') opts.height = parseInt(val);
      else if (key === 'fps') opts.fps = parseInt(val);
      else if (key === 'format') opts.format = val === 'png' ? 'png' : 'jpeg';
      else if (key === 'quality') opts.quality = Math.min(100, Math.max(1, parseInt(val)));
      else if (key === 'crf') opts.crf = Math.min(51, Math.max(0, parseInt(val)));
      else if (key === 'speed') opts.speed = parseFloat(val);
      else if (key === 'shader') opts.shader = val;
      else if (key === 'output') opts.output = val;
      else { console.log(`  Unknown option: ${arg}`); process.exit(1); }
    } else if (opts.seconds === null) {
      opts.seconds = parseFloat(arg);
    }
  }
  return opts;
}

const opts = parseArgs();

if (!opts.seconds || opts.seconds <= 0) {
  console.log('Usage: node render.js <seconds> [options]');
  console.log('');
  console.log('Options:');
  console.log('  --width=N       Width (default: 1920)');
  console.log('  --height=N      Height (default: 1080)');
  console.log('  --fps=N         FPS (default: 30)');
  console.log('  --format=FMT    png or jpeg (default: jpeg, faster)');
  console.log('  --quality=N     JPEG quality 1-100 (default: 95)');
  console.log('  --crf=N         H.264 quality 0-51 (default: 18)');
  console.log('  --speed=N       Shader time multiplier (default: 1.0)');
  console.log('  --shader=NAME   Shader id (default: synthwave_nebula)');
  console.log('  --output=FILE   Output filename (default: auto-timestamped)');
  console.log('');
  console.log('Examples:');
  console.log('  node render.js 30                                     # 30s quick test');
  console.log('  node render.js 4200 --shader=synthwave_nebula         # 70 min');
  console.log('  node render.js 300 --width=1280 --height=720 --speed=2  # 720p, 2x speed');
  console.log('  node render.js 4200 --shader=deep_space_nebula        # different shader');
  process.exit(1);
}

// Generate timestamp: YYMMDD-HHmm
function makeTimestamp() {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const mi = String(now.getMinutes()).padStart(2, '0');
  return `${yy}${mm}${dd}-${hh}${mi}`;
}

// Quality label from resolution
function qualityLabel(w, h) {
  if (w >= 3840) return '4k';
  if (w >= 1920) return '1080p';
  if (w >= 1280) return '720p';
  return `${w}x${h}`;
}

const WIDTH = opts.width;
const HEIGHT = opts.height;
const FPS = opts.fps;
const SCREENSHOT_FORMAT = opts.format;
const JPEG_QUALITY = opts.quality;
const CRF = opts.crf;
const SPEED = opts.speed;
const SHADER_ID = opts.shader;
const DURATION_SECONDS = opts.seconds;
const TOTAL_FRAMES = Math.ceil(FPS * DURATION_SECONDS);
const OUTPUT_FILE = opts.output || `${makeTimestamp()}-${SHADER_ID}-${qualityLabel(WIDTH, HEIGHT)}.mp4`;

function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h${String(m).padStart(2,'0')}m${String(s).padStart(2,'0')}s`;
  return `${m}m${String(s).padStart(2,'0')}s`;
}

let startTime;
let framesRendered = 0;

function printProgress() {
  const elapsed = (Date.now() - startTime) / 1000;
  const fps = framesRendered / elapsed;
  const remaining = (TOTAL_FRAMES - framesRendered) / fps;
  const pct = ((framesRendered / TOTAL_FRAMES) * 100).toFixed(1);
  const videoTime = framesRendered / FPS;

  process.stdout.write(
    `\r  Frame ${framesRendered}/${TOTAL_FRAMES} (${pct}%) | ` +
    `Video: ${formatTime(videoTime)} / ${formatTime(DURATION_SECONDS)} | ` +
    `Speed: ${fps.toFixed(1)} fps | ` +
    `Elapsed: ${formatTime(elapsed)} | ` +
    `ETA: ${formatTime(remaining)}   `
  );
}

// Shader registry — maps IDs to file paths relative to render.js
const SHADER_REGISTRY = {
  'synthwave_nebula': 'shaders/synthwave_nebula.html',
  'deep_space_nebula': 'shaders/deep_space_nebula.html',
};

const path = require('path');
const fs = require('fs');

function buildHTML() {
  const shaderFile = SHADER_REGISTRY[SHADER_ID];
  if (!shaderFile) {
    console.error(`  Unknown shader: ${SHADER_ID}`);
    console.error(`  Available: ${Object.keys(SHADER_REGISTRY).join(', ')}`);
    process.exit(1);
  }

  // Read the shader HTML file
  const shaderPath = path.resolve(__dirname, shaderFile);
  if (!fs.existsSync(shaderPath)) {
    console.error(`  Shader file not found: ${shaderPath}`);
    console.error(`  Make sure the shaders/ folder is next to render.js`);
    process.exit(1);
  }

  let shaderHTML = fs.readFileSync(shaderPath, 'utf8');

  // Extract just the fragment shader source from the file
  // We look for the fs=` ... `; pattern
  const fsMatch = shaderHTML.match(/const fs=`([\s\S]*?)`;/);
  if (!fsMatch) {
    console.error('  Could not extract fragment shader from file');
    process.exit(1);
  }
  const fragmentShader = fsMatch[1];

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8">
<style>*{margin:0;padding:0}body{background:#000;overflow:hidden}canvas{display:block}</style>
</head>
<body>
<canvas id="c" width="${WIDTH}" height="${HEIGHT}"></canvas>
<script>
const canvas = document.getElementById('c');
const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true, antialias: false });
if (!gl) { document.title = 'FAIL'; throw new Error('No WebGL2'); }
gl.viewport(0, 0, ${WIDTH}, ${HEIGHT});

const vs = \`#version 300 es
in vec2 a_pos;
void main(){ gl_Position = vec4(a_pos, 0.0, 1.0); }\`;

const fs = \`${fragmentShader}\`;

function compile(type,src){
    const s=gl.createShader(type);
    gl.shaderSource(s,src); gl.compileShader(s);
    if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){
        console.error(gl.getShaderInfoLog(s)); return null;
    }
    return s;
}
const vS=compile(gl.VERTEX_SHADER,vs);
const fS=compile(gl.FRAGMENT_SHADER,fs);
const prog=gl.createProgram();
gl.attachShader(prog,vS); gl.attachShader(prog,fS);
gl.linkProgram(prog); gl.useProgram(prog);
const buf=gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER,buf);
gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
const loc=gl.getAttribLocation(prog,'a_pos');
gl.enableVertexAttribArray(loc);
gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);
const uRes=gl.getUniformLocation(prog,'u_res');
const uTime=gl.getUniformLocation(prog,'u_time');

window.renderFrame = function(time){
    gl.uniform2f(uRes,${WIDTH},${HEIGHT});
    gl.uniform1f(uTime,time);
    gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
    gl.finish();
};
window.renderFrame(0);
window.__ready = true;
<\/script>
</body>
</html>`;
}

async function render() {
  console.log('='.repeat(60));
  console.log('  SHADER LAB — Offline Renderer');
  console.log('='.repeat(60));
  console.log(`  Shader: ${SHADER_ID}`);
  console.log(`  Resolution: ${WIDTH}x${HEIGHT}`);
  console.log(`  FPS: ${FPS}`);
  console.log(`  Speed: ${SPEED}×`);
  console.log(`  Duration: ${formatTime(DURATION_SECONDS)}`);
  console.log(`  Total frames: ${TOTAL_FRAMES.toLocaleString()}`);
  console.log(`  Format: ${SCREENSHOT_FORMAT}${SCREENSHOT_FORMAT === 'jpeg' ? ` (quality: ${JPEG_QUALITY})` : ''}`);
  console.log(`  CRF: ${CRF}`);
  console.log(`  Output: ${OUTPUT_FILE}`);
  console.log('='.repeat(60));
  console.log('');

  // --- Start FFmpeg ---
  const ffmpeg = spawn('ffmpeg', [
    '-y',
    '-f', 'image2pipe',
    '-vcodec', SCREENSHOT_FORMAT === 'png' ? 'png' : 'mjpeg',
    '-r', String(FPS),
    '-i', '-',
    '-c:v', 'libx264',
    '-preset', 'medium',
    '-crf', String(CRF),
    '-profile:v', 'high',
    '-level', '4.2',
    '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
    '-r', String(FPS),
    OUTPUT_FILE
  ]);

  ffmpeg.stderr.on('data', () => {});

  const ffmpegDone = new Promise((resolve, reject) => {
    ffmpeg.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`FFmpeg exited with code ${code}`));
    });
    ffmpeg.on('error', reject);
  });

  // --- Launch browser ---
  console.log('  Launching headless Chrome...');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      `--window-size=${WIDTH},${HEIGHT}`,
      '--enable-webgl',
      '--enable-webgl2',
      '--enable-gpu',
      '--no-sandbox',
      '--disable-setuid-sandbox',
    ],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: WIDTH, height: HEIGHT, deviceScaleFactor: 1 });

  // Capture page errors for debugging
  page.on('console', msg => {
    if (msg.type() === 'error') console.error('  [PAGE]', msg.text());
  });
  page.on('pageerror', err => console.error('  [PAGE CRASH]', err.message));

  console.log('  Loading shader...');
  await page.setContent(buildHTML(), { waitUntil: 'domcontentloaded' });

  // Wait for shader to compile
  await new Promise(r => setTimeout(r, 3000));

  const ready = await page.evaluate(() => window.__ready === true);
  if (!ready) {
    const info = await page.evaluate(() => {
      const c = document.getElementById('c');
      const gl = c && (c.getContext('webgl2', {preserveDrawingBuffer:true}) || c.getContext('webgl', {preserveDrawingBuffer:true}));
      return { canvas: !!c, gl: !!gl, title: document.title };
    });
    console.error('  Debug:', JSON.stringify(info));
    throw new Error('Shader failed to initialize. Check [PAGE] errors above.');
  }

  console.log('  Shader compiled, test frame rendered.');
  console.log('  Rendering frames...\n');

  startTime = Date.now();

  for (let frame = 0; frame < TOTAL_FRAMES; frame++) {
    const time = (frame / FPS) * SPEED;

    await page.evaluate((t) => window.renderFrame(t), time);

    const screenshotOpts = {
      type: SCREENSHOT_FORMAT,
      clip: { x: 0, y: 0, width: WIDTH, height: HEIGHT },
      omitBackground: false,
    };
    if (SCREENSHOT_FORMAT === 'jpeg') screenshotOpts.quality = JPEG_QUALITY;
    const buffer = await page.screenshot(screenshotOpts);

    const canWrite = ffmpeg.stdin.write(buffer);
    if (!canWrite) {
      await new Promise(resolve => ffmpeg.stdin.once('drain', resolve));
    }

    framesRendered++;

    if (frame % FPS === 0) {
      printProgress();
    }
  }

  console.log('\n\n  Finalizing video...');
  ffmpeg.stdin.end();
  await ffmpegDone;
  await browser.close();

  const totalTime = (Date.now() - startTime) / 1000;
  console.log('');
  console.log('='.repeat(60));
  console.log('  DONE!');
  console.log(`  Rendered ${TOTAL_FRAMES.toLocaleString()} frames in ${formatTime(totalTime)}`);
  console.log(`  Average speed: ${(TOTAL_FRAMES / totalTime).toFixed(1)} fps`);
  console.log(`  Output: ${OUTPUT_FILE}`);
  console.log('='.repeat(60));
  console.log('');
  console.log('  To add music:');
  console.log(`  ffmpeg -i ${OUTPUT_FILE} -i your_music.mp3 \\`);
  console.log('    -c:v copy -c:a aac -b:a 320k -shortest final.mp4');
  console.log('');
}

render().catch((err) => {
  console.error('\n  ERROR:', err.message);
  console.error('');
  console.error('  Common fixes:');
  console.error('  - Install FFmpeg: https://ffmpeg.org/download.html');
  console.error('  - Install deps: npm install puppeteer');
  process.exit(1);
});
