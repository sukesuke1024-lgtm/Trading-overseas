// index.html をフレーム単位で書き出し、BGM と合成して MP4 を作る。
// 使い方: node render.cjs [--fps 30] [--company "会社名"] [--from 0 --to 90] [--out out/xxx.mp4]
const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

function loadPlaywright() {
  try { return require('playwright'); } catch (_) {}
  const globalRoot = execSync('npm root -g').toString().trim();
  return require(path.join(globalRoot, 'playwright'));
}

function ffmpegPath() {
  if (process.env.FFMPEG) return process.env.FFMPEG;
  try { execSync('ffmpeg -version', { stdio: 'ignore' }); return 'ffmpeg'; } catch (_) {}
  return execSync('python3 -c "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())"').toString().trim();
}

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : def; };
const FPS = Number(opt('fps', 30));
const FROM = Number(opt('from', 0));
const company = opt('company', '');
const OUT = path.resolve(__dirname, opt('out', 'out/overseas-buyer-sales-recruit-90s.mp4'));
const BGM = path.resolve(__dirname, 'out/bgm.wav');

(async () => {
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const url = 'file://' + path.join(__dirname, 'index.html') + '?render=1' + (company ? `&company=${encodeURIComponent(company)}` : '');
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  const duration = await page.evaluate(() => window.DURATION);
  const TO = Number(opt('to', duration));
  const frames = Math.round((TO - FROM) * FPS);

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const ff = ffmpegPath();
  const ffArgs = ['-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-'];
  if (fs.existsSync(BGM)) ffArgs.push('-ss', String(FROM), '-t', String(TO - FROM), '-i', BGM);
  ffArgs.push('-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart');
  if (fs.existsSync(BGM)) ffArgs.push('-c:a', 'aac', '-b:a', '192k', '-shortest');
  ffArgs.push(OUT);
  const proc = spawn(ff, ffArgs, { stdio: ['pipe', 'ignore', 'inherit'] });

  for (let i = 0; i < frames; i++) {
    const t = FROM + i / FPS;
    await page.evaluate(tt => window.render(tt), t);
    const buf = await page.screenshot({ type: 'jpeg', quality: 95 });
    if (!proc.stdin.write(buf)) await new Promise(r => proc.stdin.once('drain', r));
    if (i % (FPS * 5) === 0) process.stdout.write(`  ${t.toFixed(1)}s / ${TO}s\n`);
  }
  proc.stdin.end();
  await new Promise(r => proc.on('close', r));
  await browser.close();
  console.log('done:', OUT);
})();
