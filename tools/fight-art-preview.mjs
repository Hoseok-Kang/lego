// 펑펑 토끼 블록 모양 미리보기를 PNG로 저장합니다. (웹 서버를 먼저 켜 둔 뒤 실행)
// 사용법: node tools/fight-art-preview.mjs <서버주소> <저장할 폴더> [모드,모드,...]
//   모드: rabbits(토끼 여러 각도) pop(귀 터지는 단계) weapons(무기) props(소품) scene(게임 화면 크기 장면)
//   모드를 안 적으면 전부 저장합니다. 파일 이름 = fight-art-<모드>.png
//   모드 뒤에 &cell=400 (칸 크기), &kinds=player,knife (토끼 고르기) 를 붙여도 됩니다.
// 예)   node tools/fight-art-preview.mjs http://127.0.0.1:8765 /tmp/preview rabbits,scene
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const [server = 'http://127.0.0.1:8765', outDir = '.', modesText = 'rabbits,pop,weapons,props,scene'] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });

// 그래픽 카드가 없는 컴퓨터에서도 3D 화면이 그려지도록 소프트웨어 그리기를 켬
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1700, height: 1000 } });
page.on('pageerror', (error) => console.log(`[pageerror] ${error.message}`));
page.on('console', (message) => {
  if (message.type() === 'error') console.log(`[console] ${message.text()}`);
});

// 쉼표로 모드를 나눔 (단, &kinds=player,knife 안의 쉼표는 모드 구분이 아님)
const modes = modesText.split(/,(?=(?:rabbits|pop|weapons|props|scene)(?:&|,|$))/).filter(Boolean);
for (const mode of modes) {
  await page.goto(`${server}/tools/fight-art-preview.html?mode=${mode}`);
  await page.waitForSelector('body[data-ready="true"]', { timeout: 120000 });
  const out = `${outDir}/fight-art-${mode.replace(/[^a-z0-9]+/gi, '-')}.png`;
  await page.locator('#wrap').screenshot({ path: out, timeout: 120000 });
  console.log(`저장: ${out}`);
}
await browser.close();
