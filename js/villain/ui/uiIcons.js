// ─────────────────────────────────────────────────────────────
// 악당 타이쿤: 화면에 쓰는 작은 그림 (아이콘 · 도트 마스코트)
// 그림 파일 없이 글자로 적은 SVG 입니다. 단추 안의 아이콘은 글자색을 따라갑니다.
//
// 쓰는 법
//   icon('coin')            아이콘 하나의 HTML 글자 (innerHTML 에 넣음). 이름 목록은 아래 ICONS
//   pixelArt(줄들, 색표)     도트 그림 → SVG HTML 글자 (한 글자 = 한 칸, '.' 은 빈칸)
//   MASCOT / HERO_FACE / TOWN_ART   로고 옆 악당 얼굴, 영웅 얼굴, 꼬마 마을 그림 (도트)
//
// 도트 그림을 고치려면 아래 글자 그림을 바꾸면 됩니다. 색은 js/bricks/brickColors.js 의 블록 색입니다.
// ─────────────────────────────────────────────────────────────

const svg = (body, viewBox = '0 0 24 24') => `<svg class="ico" viewBox="${viewBox}" aria-hidden="true" focusable="false">${body}</svg>`;
const stroke = 'fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"';

export const ICONS = {
  // 돈: 노란 블록 돌기 동전 (색 고정)
  coin: `<svg class="ico ico-coin" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="13" r="10" fill="#b8860b"/><circle cx="12" cy="11" r="10" fill="#F2CD37"/><circle cx="12" cy="11" r="6.4" fill="#ffe36b"/><circle cx="12" cy="11" r="6.4" fill="none" stroke="#c79a12" stroke-width="1.4"/><path d="M8.6 8.4a4.6 4.6 0 0 1 4.6-1.9" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/></svg>`,
  back: svg(`<path d="M14.5 5 8 12l6.5 7" ${stroke}/>`),
  play: svg(`<path d="M7 4.5v15l13-7.5z" fill="currentColor"/>`),
  pencil: svg(`<path d="m4 20 1-4.5L16.5 4l3.5 3.5L8.5 19z" ${stroke}/><path d="m14 6.5 3.5 3.5" ${stroke}/>`),
  copy: svg(`<rect x="8" y="8" width="11.5" height="11.5" rx="2.5" ${stroke}/><path d="M15.5 4.5h-8a3 3 0 0 0-3 3v8" ${stroke}/>`),
  trash: svg(`<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 12.5h9l1-12.5M10 11v5M14 11v5" ${stroke}/>`),
  plus: svg(`<path d="M12 5v14M5 12h14" ${stroke} stroke-width="3"/>`),
  shop: svg(`<path d="M4 10 5.5 4.5h13L20 10M5 10v9.5h14V10M4 10a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.3 0M10 19.5v-5h4v5" ${stroke}/>`),
  home: svg(`<path d="M4 11.5 12 4.5l8 7M6.5 10v9.5h11V10M10 19.5v-5h4v5" ${stroke}/>`),
  retry: svg(`<path d="M19 12a7 7 0 1 1-2.2-5.1M19.5 4v4h-4" ${stroke}/>`),
  stop: svg(`<path d="M6 6l12 12M18 6 6 18" ${stroke} stroke-width="3"/>`),
  speed: svg(`<path d="M4 5.5v13l8-6.5zM12.5 5.5v13l8-6.5z" fill="currentColor"/>`),
  soundOn: svg(`<path d="M4 9.5v5h3.5l5 4v-13l-5 4z" fill="currentColor"/><path d="M16 9a4.2 4.2 0 0 1 0 6M18.6 6.4a8 8 0 0 1 0 11.2" ${stroke}/>`),
  soundOff: svg(`<path d="M4 9.5v5h3.5l5 4v-13l-5 4z" fill="currentColor"/><path d="m16 9.5 5 5M21 9.5l-5 5" ${stroke}/>`),
  block: svg(`<rect x="3.5" y="9" width="17" height="11" rx="2" fill="currentColor"/><rect x="6" y="5" width="4.6" height="5" rx="1.2" fill="currentColor"/><rect x="13.4" y="5" width="4.6" height="5" rx="1.2" fill="currentColor"/>`),
  heart: svg(`<path d="M12 20.5 4.4 13a4.9 4.9 0 0 1 7-6.9l.6.6.6-.6a4.9 4.9 0 0 1 7 6.9z" fill="currentColor"/>`),
  check: svg(`<path d="m5 12.5 4.5 4.5L19 7.5" ${stroke} stroke-width="3.2"/>`),
  lock: svg(`<rect x="5" y="10.5" width="14" height="10" rx="2.5" fill="currentColor"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" ${stroke}/>`),
  clock: svg(`<circle cx="12" cy="12" r="8" ${stroke}/><path d="M12 7.5V12l3 2" ${stroke}/>`),
  bolt: svg(`<path d="M13.5 2.5 5 13.5h5.5l-1 8L18.5 10H13z" fill="currentColor"/>`),
  house: svg(`<path d="M3 11.5 12 4l9 7.5h-2.5v8.5h-13v-8.5z" fill="currentColor"/>`),
  gear: svg(`<circle cx="12" cy="12" r="5.7" fill="none" stroke="currentColor" stroke-width="3.4"/><g fill="currentColor"><rect x="10.4" y="1.6" width="3.2" height="4.6" rx="1" transform="rotate(0 12 12)"/><rect x="10.4" y="1.6" width="3.2" height="4.6" rx="1" transform="rotate(45 12 12)"/><rect x="10.4" y="1.6" width="3.2" height="4.6" rx="1" transform="rotate(90 12 12)"/><rect x="10.4" y="1.6" width="3.2" height="4.6" rx="1" transform="rotate(135 12 12)"/><rect x="10.4" y="1.6" width="3.2" height="4.6" rx="1" transform="rotate(180 12 12)"/><rect x="10.4" y="1.6" width="3.2" height="4.6" rx="1" transform="rotate(225 12 12)"/><rect x="10.4" y="1.6" width="3.2" height="4.6" rx="1" transform="rotate(270 12 12)"/><rect x="10.4" y="1.6" width="3.2" height="4.6" rx="1" transform="rotate(315 12 12)"/></g>`),
};

export function icon(name) {
  return ICONS[name] ?? '';
}

// 도트 그림 → SVG. 가로로 이어진 같은 색 칸은 한 조각으로 합쳐 가볍게 만듭니다
export function pixelArt(rows, colors, { className = 'pix' } = {}) {
  const width = Math.max(...rows.map((r) => r.length));
  let rects = '';
  rows.forEach((line, y) => {
    let x = 0;
    while (x < line.length) {
      const ch = line[x];
      let run = 1;
      while (line[x + run] === ch) run += 1;
      if (colors[ch]) rects += `<rect x="${x}" y="${y}" width="${run}" height="1.02" fill="${colors[ch]}"/>`;
      x += run;
    }
  });
  return `<svg class="${className}" viewBox="0 0 ${width} ${rows.length}" shape-rendering="crispEdges" aria-hidden="true" focusable="false">${rects}</svg>`;
}

// 블록 색 (js/bricks/brickColors.js 에서 고른 것)
const C = {
  K: '#1B2A34', // 검정
  W: '#F4F4F4', // 흰색
  P: '#6A3FD8', // 악당 보라 (화면 강조색)
  p: '#3F3691', // 진보라
  g: '#BBE90B', // 라임
  G: '#4B9F4A', // 초록
  Y: '#F2CD37', // 노랑
  O: '#FE8A18', // 주황
  R: '#C91A09', // 빨강
  B: '#0055BF', // 파랑
  b: '#9FC3E9', // 하늘
  N: '#582A12', // 밤색
  A: '#A0A5A9', // 회색
  S: '#F6D7B3', // 살구색
  r: '#E4ADC8', // 분홍
};

// 로고 옆 꼬마 악당 (뿔 달린 보라 괴수가 씩 웃음)
export const MASCOT = pixelArt(
  [
    '.KK........KK.',
    'KYYK......KYYK',
    'KYYYK....KYYYK',
    '.KYYKKKKKKYYK.',
    '.KPPPPPPPPPPK.',
    'KPPPPPPPPPPPPK',
    'KPKKKPPPPKKKPK',
    'KPgWKPPPPgWKPK',
    'KPggKPPPPggKPK',
    'KPPPPPPPPPPPPK',
    'KPKWKWKWKWKWPK',
    'KPPKKKKKKKKPPK',
    '.KppppppppppK.',
    '..KKKKKKKKKK..',
  ],
  C,
  { className: 'pix mascot' },
);

// 영웅 얼굴 (파란 투구 + 노란 깃)
export const HERO_FACE = pixelArt(
  [
    '.....YY.....',
    '....KYYK....',
    '..KKKYYKKK..',
    '.KBBBBBBBBK.',
    'KBBBbBBBBBBK',
    'KBBBBBBBBBBK',
    'KBKKKKKKKKBK',
    'KBSKSSSSKSBK',
    'KBSSSSSSSSBK',
    'KBBSSrrSSBBK',
    '.KBBBBBBBBK.',
    '..KKKKKKKK..',
  ],
  C,
  { className: 'pix hero-face' },
);

// 꼬마 마을 (집 두 채 + 탑 + 나무)
export const TOWN_ART = pixelArt(
  [
    '..................BB......',
    '.................BBBB.....',
    '................BBBBBB....',
    '....RR...........WWWW.....',
    '...RRRR..........WbbW.....',
    '..RRRRRR....OO...WWWW..G..',
    '.RRRRRRRR..OOOO..WbbW.GGG.',
    '..WWWWWW..OOOOOO.WWWW.GGG.',
    '..WbWWbW...WWWW..WbbWGGGGG',
    '..WWWWWW...WbbW..WWWW.GGG.',
    '..WWNNWW...WWWW..WNNW..N..',
    '..WWNNWW...WNNW..WNNW..N..',
  ],
  C,
  { className: 'pix town-art' },
);
