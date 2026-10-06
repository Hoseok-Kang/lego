// 그림 블록 미리보기를 PNG로 저장합니다. (웹 서버를 먼저 켜 둔 뒤 실행)
// 사용법: node tools/art-preview.mjs <서버주소> <출력.png> <항목,항목,...>
// 예)     node tools/art-preview.mjs http://127.0.0.1:8765 preview.png js/game/art/towerArt.js:TOWER_ART.archer:7
import { chromium } from 'playwright';

const [server, out, items] = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
page.on('pageerror', (error) => console.log(`[pageerror] ${error.message}`));
page.on('console', (message) => {
  if (message.type() === 'error') console.log(`[console] ${message.text()}`);
});
await page.goto(`${server}/tools/art-preview.html?items=${encodeURIComponent(items)}`);
await page.waitForSelector('body[data-ready="true"]', { timeout: 20000 });
await page.screenshot({ path: out, fullPage: true });
await browser.close();
console.log(`저장: ${out}`);
