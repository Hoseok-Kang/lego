// ─────────────────────────────────────────────────────────────
// 악당 타이쿤: 소굴 화면의 도트 그림 (시설 · 마을 · 영웅 얼굴 · 악명 휘장)
// 그림 파일 없이 글자로 적은 도트 그림입니다. 한 글자 = 한 칸, '.' 은 빈칸. 색은 js/bricks/brickColors.js 의 블록 색.
//
// 쓰는 법
//   art(id)                  시설 · 계책 · 목표의 그림 이름(id) → SVG HTML 글자
//                            모르는 이름이면: 이모지 같은 글자는 그대로, 아니면 블록 그림
//   hasArt(id)               그 이름의 도트 그림이 있는지
//   townArt(townId)          마을 그림 (village · harbor · castle)
//   heroFace(kind)           영웅 얼굴 (knight · iceMage · guardian)
//   rankEmblem(rank)         악명 단계 휘장 (0 ~ 4, 단계마다 뿔 색이 바뀜)
//   lairIcon(name)           선 아이콘 (lairIcons.js 에서 가져와 그대로 내보냄)
//
// 그림을 고치려면 아래 글자 그림을 바꾸면 됩니다. 줄 길이는 모두 같아야 해요.
// 계책 · 목표용 작은 그림(skull · crown · star …)과 선 아이콘은 lairIcons.js 에 있어요.
// ─────────────────────────────────────────────────────────────

import { pixelArt, icon, HERO_FACE, TOWN_ART } from './uiIcons.js';
import { EXTRA_ART, lairIcon } from './lairIcons.js';

export { lairIcon };

// 블록 색 (brickColors.js 에서 고름)
const C = {
  K: '#1B2A34', W: '#F4F4F4', A: '#A0A5A9', a: '#6C6E68',
  R: '#C91A09', r: '#720E0F', O: '#FE8A18', o: '#A95500', L: '#F8BB3D',
  Y: '#F2CD37', y: '#FFF03A', s: '#E4CD9E', M: '#958A73',
  N: '#582A12', n: '#AA7D55', S: '#F6D7B3',
  g: '#BBE90B', G: '#4B9F4A', D: '#237841', d: '#184632',
  c: '#36AEBF', C: '#078BC9', b: '#9FC3E9', m: '#5A93DB', B: '#0055BF', v: '#0A3463',
  l: '#E1D5ED', p: '#AC78BA', P: '#3F3691', x: '#923978', k: '#E4ADC8', f: '#FF698F',
};

// ── 시설 그림 (12×12) ──
const FACILITY = {
  // 악당 왕좌: 뿔 달린 보라 의자 + 빨간 방석
  throne: [
    'Y..........Y',
    'YY.KKKKKK.YY',
    '.YKPPPPPPKY.',
    '..KPPYYPPK..',
    '..KPPPPPPK..',
    '.KKPPPPPPKK.',
    'KYKRRRRRRKYK',
    'KYKRRRRRRKYK',
    'KYYYYYYYYYYK',
    'KPKKKKKKKKPK',
    'KPK......KPK',
    'KKK......KKK',
  ],
  // 괴수 공장: 굴뚝에서 초록 연기, 라임 창문
  factory: [
    '........ggg.',
    '.......gggg.',
    '........gg..',
    '........KKK.',
    '.K..K...KaK.',
    'KAKKAKK.KaK.',
    'KAAAAAAKKaKK',
    'KAgAAgAAgAAK',
    'KAAAAAAAAAAK',
    'KAAAKKKKAAAK',
    'KAAAKggKAAAK',
    'KKKKKKKKKKKK',
  ],
  // 물감 창고: 물감이 넘치는 양동이
  paint: [
    '..R..Y...B..',
    '.RR.YY..BB..',
    'KKKKKKKKKKKK',
    'KRRRYYYYBBBK',
    'KAAAAAAAAAAK',
    'KARAAYAAABAK',
    '.KRAAYAAABK.',
    '.KRAAAAAABK.',
    '.KAAAAAAAAK.',
    '.KAWAAAAAAK.',
    '..KAAAAAAK..',
    '..KKKKKKKK..',
  ],
  // 연구실: 부글부글 초록 물약 병
  lab: [
    '....g...g...',
    '..g...g.....',
    '....KKKK....',
    '....KlWK....',
    '....KlWK....',
    '...KlWWWK...',
    '..KlWWWWWK..',
    '.KggggggggK.',
    'KgWggggggggK',
    'KggggggWgggK',
    'KGgggggggGGK',
    '.KKKKKKKKKK.',
  ],
  // 훈련장: 빨간 아령
  training: [
    '............',
    '............',
    '.KK......KK.',
    'KRRK....KRRK',
    'KRRK....KRRK',
    'KRRKKKKKKRRK',
    'KRRAAAAAARRK',
    'KRRKKKKKKRRK',
    'KRRK....KRRK',
    'KRRK....KRRK',
    '.KK......KK.',
    '............',
  ],
  // 금고: 금화가 튀어나오는 보물 상자
  vault: [
    '..Y..Y..Y...',
    '.YyY.YyYYyY.',
    '.KKKKKKKKKK.',
    'KNNNNNNNNNNK',
    'KNnnnnnnnnNK',
    'KYYYYKKYYYYK',
    'KNNNKYyKNNNK',
    'KNnnKKKKnnNK',
    'KNnnnnnnnnNK',
    'KNnnnnnnnnNK',
    'KNNNNNNNNNNK',
    '.KKKKKKKKKK.',
  ],
  // 감시탑: 빨간 지붕 아래 커다란 눈
  watchtower: [
    '.....KK.....',
    '....KRRK....',
    '...KRRRRK...',
    '..KRRRRRRK..',
    '.KKKKKKKKKK.',
    '.KnWWWWWWnK.',
    '.KnWWKKWWnK.',
    '.KnWWWWWWnK.',
    '.KKKKKKKKKK.',
    '..KNKNNKNK..',
    '..KN.KK.NK..',
    '.KNK....KNK.',
  ],
  // 함정 공방: 쇠 가시 함정
  traps: [
    '..K...K...K.',
    '.KAK.KAK.KAK',
    '.KAK.KAK.KAK',
    'KAWAKAWAKAWK',
    'KAAAKAAAKAAK',
    'KKKKKKKKKKKK',
    'KaaaaaaaaaaK',
    'KaRRaaaaRRaK',
    'KaaaaaaaaaaK',
    'KKKKKKKKKKKK',
    '.KaK....KaK.',
    '.KKK....KKK.',
  ],
  // 박쥐 동굴: 날개 편 보라 박쥐
  bats: [
    '............',
    '....K..K....',
    'K...KKKK...K',
    'KK.KPPPPK.KK',
    'KPKKPgPgKKPK',
    'KPPPPPPPPPPK',
    'KPPPPWPWPPPK',
    'KPPKPPPPKPPK',
    'KPK.KPPK.KPK',
    'KK...KK...KK',
    'K..........K',
    '............',
  ],
  // 용암 웅덩이: 보글보글 끓는 용암
  lava: [
    '....O.......',
    '...OLO..O...',
    '....O..OLO..',
    '........O...',
    '...KKKKKK...',
    '.KKaaaaaaKK.',
    'KaaOOOOOOaaK',
    'KaOOLLOOOOaK',
    'KaOYOOOLYOaK',
    'KaaOOOOOOaaK',
    '.KKaaaaaaKK.',
    '...KKKKKK...',
  ],
};

const ALL = { ...FACILITY, ...EXTRA_ART };

// 같은 뜻의 다른 이름 (데이터에서 다른 이름을 써도 그림이 나오게)
const ALIAS = {
  factoryLine: 'factory', workshop: 'factory', paintShop: 'paint', bucket: 'paint',
  flask: 'lab', potion: 'lab', science: 'lab', dumbbell: 'training', gym: 'training',
  chest: 'vault', gold: 'money', coinBag: 'money', bag: 'money', tower: 'watchtower', spy: 'eye',
  trap: 'traps', spikes: 'traps', bat: 'bats', cave: 'bats', volcano: 'lava', magma: 'lava',
  king: 'crown', throneRoom: 'throne', draw: 'monster', raid: 'map', hero: 'shield', knight: 'shield',
  win: 'trophy', goal: 'trophy', scheme: 'book', chain: 'link', fear: 'skull', bolt: 'fire', frost: 'ice',
};

const cache = new Map();

export function hasArt(id) {
  return !!ALL[ALIAS[id] ?? id];
}

export function art(id, { className = 'pix lart' } = {}) {
  const key = ALIAS[id] ?? id;
  const cacheKey = `${key}|${className}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);
  let html;
  if (ALL[key]) html = pixelArt(ALL[key], C, { className });
  else if (id && /[^\x00-\x7F]/.test(String(id))) html = `<span class="lart-emoji" aria-hidden="true">${String(id).slice(0, 4)}</span>`;
  else html = icon('block').replace('class="ico"', 'class="ico lart-fallback"');
  cache.set(cacheKey, html);
  return html;
}

// ── 마을 그림 (26×12) ──
const HARBOR = [
  '......................Y...',
  '.....................KyK..',
  '.....................RRR..',
  '........W............WWW..',
  '.......WW............RRR..',
  '......WWW.....RRRR...WWW..',
  '.....WWWW....RRRRRR..RRR..',
  '....WWWWW...KWWWWWWK.WWW..',
  '........N...KWbWWbWK.RRR..',
  '..RRRRRRRRR.KWWNNWWKWWWWW.',
  '...RRRRRRR..KWWNNWWKNNNNNN',
  '....RRRRR...KKKKKKKKN....N',
];

const CASTLE = [
  '...R..................R...',
  '...RR.................RR..',
  '...K.......YY.........K...',
  '.A.A.A....YYYY......A.A.A.',
  '.AAAAA...YYYYYY.....AAAAA.',
  '.AaAAA...KWWWWK.....AAaAA.',
  '.AAAAA.A.KWbbWK.A.A.AAAAA.',
  '.AAaAAAAAKWWWWKAAAAAAAaAA.',
  '.AAAAAaAAAAKKAAAAAaAAAAAA.',
  '.AaAAAAAAAKNNKAAAAAAAAaAA.',
  '.AAAAAAaAAKNNKAAaAAAAAAAA.',
  '.AAAAAAAAAKNNKAAAAAAAAAAA.',
];

const TOWNS = {
  village: TOWN_ART,
  harbor: pixelArt(HARBOR, C, { className: 'pix town-art' }),
  castle: pixelArt(CASTLE, C, { className: 'pix town-art' }),
};

export function townArt(id) {
  return TOWNS[id] ?? TOWNS.village;
}

// ── 영웅 얼굴 (12×12) ──
const ICE_MAGE = [
  '......Kb....',
  '.....KbbK...',
  '....KbbbK...',
  '...KbbYbbK..',
  '..KbbbbbbbK.',
  '.KCCCCCCCCK.',
  '..KSSSSSSK..',
  '..KSKSSKSK..',
  '..KSSSSSSK..',
  '..KWWWWWWK..',
  '...KWWWWK...',
  '....KKKK....',
];

const GUARDIAN = [
  '.....RR.....',
  '....RRRR....',
  '..KKKYYKKK..',
  '.KYYYYYYYYK.',
  'KYYyYYYYYYYK',
  'KYYYYYYYYYYK',
  'KYKKKKKKKKYK',
  'KYKbKKKKbKYK',
  'KYYYYYYYYYYK',
  'KYYoKYYKoYYK',
  '.KYYYYYYYYK.',
  '..KKKKKKKK..',
];

const FACES = {
  knight: HERO_FACE,
  iceMage: pixelArt(ICE_MAGE, C, { className: 'pix hero-face' }),
  guardian: pixelArt(GUARDIAN, C, { className: 'pix hero-face' }),
};

export function heroFace(kind) {
  return FACES[kind] ?? FACES.knight;
}

// ── 악명 휘장: 뿔 달린 해골, 단계마다 뿔 색 (5단계는 왕관) ──
const EMBLEM = [
  'H..........H',
  'HH........HH',
  '.HH.KKKK.HH.',
  '..HKWWWWKH..',
  '..KWWWWWWK..',
  '.KWWWWWWWWK.',
  '.KWKKWWKKWK.',
  '.KWKgWWKgWK.',
  '.KWWWKKWWWK.',
  '..KWWWWWWK..',
  '..KWKWKWWK..',
  '...KKKKKK...',
];
const RANK_HORN = ['#BBE90B', '#AC78BA', '#FE8A18', '#C91A09', '#F2CD37'];
const emblems = new Map();

export function rankEmblem(rank = 0) {
  const n = Math.max(0, Math.min(RANK_HORN.length - 1, Math.round(rank) || 0));
  if (!emblems.has(n)) emblems.set(n, pixelArt(EMBLEM, { ...C, H: RANK_HORN[n] }, { className: `pix rank-emblem rank-${n}` }));
  return emblems.get(n);
}

// 시험용: 그림 이름 목록
export const ART_IDS = Object.keys(ALL);
export const FACILITY_ART_IDS = Object.keys(FACILITY);
