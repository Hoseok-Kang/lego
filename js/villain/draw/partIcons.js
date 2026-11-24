// ─────────────────────────────────────────────────────────────
// 악당 타이쿤: 공격 부품 도트 그림 (2D 아이콘)
// 그림판의 '부품 붙이기', 도감 카드, 부품 상점에서 쓰는 작은 도트 아이콘입니다. (집게발 · 불 뿜는 입 · 돌진 뿔 · 꼬리 철퇴 · 레이저 눈) 9×9 칸, 검은 테두리는 자동으로 둘러집니다.
// 색 기호는 villainConfig.js 의 draw.palette 와 같습니다. 그림을 고치려면 아래 글자를 바꾸면 됩니다.
//
// 쓰는 법
//   drawPartIcon(ctx, type, x, y, size)   캔버스의 (x, y) 에 size 픽셀 크기로 그림
//   partIconURL(type, px = 66)            <img src> 에 넣을 수 있는 그림 주소
//   PART_ICON_TYPES                       그림이 준비된 부품 이름 목록
// ─────────────────────────────────────────────────────────────

import { VILLAIN } from '../villainConfig.js';

const ART = {
  claw: [
    '.RR...RR.',
    'RRR...RRR',
    'RR.....RR',
    'RR.....RR',
    'RRR...RRR',
    '.RRRORRR.',
    '..RROOR..',
    '...AAA...',
    '...AAA...',
  ],
  fireMouth: [
    '....O....',
    '...OO..O.',
    '.O.OOO.O.',
    '.OOOYOOO.',
    'OOOYYYOOO',
    'OOYYWYYOO',
    'OOYWWWYOO',
    '.OOYWYOO.',
    '..OOOOO..',
  ],
  horn: [
    '.......W.',
    '......WW.',
    '.....YY..',
    '....YYY..',
    '...OOOO..',
    '..YYYYY..',
    '..YYYYY..',
    '.OOOOOO..',
    '.NNNNNN..',
  ],
  // 꼬리 철퇴: 왼쪽 아래에서 올라온 보라·분홍 줄무늬 꼬리 끝에 노란 가시가 박힌 쇠공
  tailMace: [
    '.....Y...',
    '..Y.AAA.Y',
    '...AWAAA.',
    '..YAAAAAY',
    '...AAAAA.',
    '...PAAA.Y',
    '..Pp.Y...',
    '.Pp......',
    'Pp.......',
  ],
  // 레이저 눈: 찡그린 보라 눈썹 아래 흰자, 빨간 눈동자, 노랗게 빛나는 동공
  laserEye: [
    '.........',
    'PP.....PP',
    '..PP.PP..',
    '.WWWWWWW.',
    'WWWRRRWWW',
    'WWRRYRRWW',
    'WWWRRRWWW',
    '.WWWWWWW.',
    '.........',
  ],
};

const SIZE = 9;
const OUTLINE = '#1B2A34';
const FALLBACK = ['..PPPPP..', '.PP...PP.', '.....PPP.', '....PPP..', '...PPP...', '...PP....', '.........', '...PP....', '...PP....'];

export const PART_ICON_TYPES = Object.keys(ART);

function hexOf(ch) {
  return VILLAIN.draw.palette.find((c) => c.ch === ch)?.hex ?? '#ff00ff';
}

export function drawPartIcon(ctx, type, x, y, size) {
  const art = ART[type] ?? FALLBACK;
  const unit = size / (SIZE + 2); // 테두리 한 칸씩 여유
  const at = (col, row) => (art[row]?.[col] && art[row][col] !== '.' ? art[row][col] : null);
  const box = (col, row, fill) => {
    ctx.fillStyle = fill;
    const left = Math.round(x + (col + 1) * unit);
    const top = Math.round(y + (row + 1) * unit);
    ctx.fillRect(left, top, Math.round(x + (col + 2) * unit) - left, Math.round(y + (row + 2) * unit) - top);
  };
  for (let row = -1; row <= SIZE; row += 1) {
    for (let col = -1; col <= SIZE; col += 1) {
      if (at(col, row)) continue;
      if (at(col + 1, row) || at(col - 1, row) || at(col, row + 1) || at(col, row - 1)) box(col, row, OUTLINE);
    }
  }
  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      const ch = at(col, row);
      if (ch) box(col, row, hexOf(ch));
    }
  }
}

const cache = new Map();

export function partIconURL(type, px = 66) {
  const key = `${type}:${px}`;
  if (cache.has(key)) return cache.get(key);
  const canvas = document.createElement('canvas');
  canvas.width = px;
  canvas.height = px;
  drawPartIcon(canvas.getContext('2d'), type, 0, 0, px);
  const url = canvas.toDataURL('image/png');
  cache.set(key, url);
  return url;
}
