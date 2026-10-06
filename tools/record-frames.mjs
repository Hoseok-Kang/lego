// 영상 만들기 1단계: 쌓기 모션을 한 장면씩 찍어서 PNG 그림으로 저장합니다. (Claude가 영상을 만들 때 쓰는 도구)
// 미리 이 폴더에서 웹 서버를 켜 둔 뒤 실행합니다. 예) python3 -m http.server 8765
// 사용법: node tools/record-frames.mjs <페이지주소> <출력폴더> [폭=720] [높이=900] [배율=1.5] [fps=30] [완성 후 유지 초=3.5]
// 예)     node tools/record-frames.mjs http://127.0.0.1:8765/index.html out
// 결과:   <출력폴더>/frames/f00000.png ...  와  <출력폴더>/events.json (딸깍 소리 넣을 시점)
import { chromium } from 'playwright';
import fs from 'node:fs';

const [url, out, w = 720, h = 900, dpr = 1.5, fps = 30, hold = 3.5] = process.argv.slice(2);
fs.mkdirSync(`${out}/frames`, { recursive: true });
const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: +dpr });
page.on('pageerror', (error) => console.log(`[pageerror] ${error.message}`));
await page.goto(`${url}?capture`);
await page.waitForFunction(() => window.blockCapture);

const dt = 1 / +fps;
const events = [];
let frame = 0;
let lastLanded = 0;
let doneAt = null;
while (frame < 3000) {
  const status = await page.evaluate((d) => window.blockCapture.step(d), frame === 0 ? 0 : dt);
  if (status.landed > lastLanded) events.push([frame, 'click']);
  lastLanded = status.landed;
  if (status.done && doneAt === null) {
    doneAt = frame;
    events.push([frame, 'fanfare']);
  }
  await page.screenshot({ path: `${out}/frames/f${String(frame).padStart(5, '0')}.png` });
  if (frame % 30 === 0) console.log(`frame ${frame}, 쌓인 블록 ${status.landed}`);
  frame++;
  if (doneAt !== null && frame - doneAt > +hold * +fps) break;
}
fs.writeFileSync(`${out}/events.json`, JSON.stringify({ fps: +fps, frames: frame, events }));
console.log(`끝: ${frame}장`);
await browser.close();
