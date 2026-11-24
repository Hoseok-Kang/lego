// ─────────────────────────────────────────────────────────────
// 악당 타이쿤: 처음부터 들어 있는 괴수 3마리
// 16×16 칸 도트 그림입니다. 글자 하나가 한 칸이고 '.' 은 빈 칸입니다.
// 색 기호는 js/villain/villainConfig.js 의 draw.palette 를 따릅니다.
//   G 초록  g 라임  R 빨강  O 주황  Y 노랑  B 파랑  b 하늘  P 보라  p 분홍  N 밤색  A 회색  K 검정  W 흰색
// 그림을 고치려면 아래 글자를 바꾸면 됩니다. (줄마다 꼭 16글자, 맨 아랫줄에 발이 닿게)
// parts 는 붙어 있는 공격 부품: { type: 부품 이름, col: 왼쪽에서 몇째 칸(0부터), row: 위에서 몇째 칸(0부터) }
//
// 맨 끝에는 3D 작업대로 쌓은 기본 괴수(data/voxelMonsters.js)도 붙습니다.
//
// 이름은 L({ ko: '한국어', en: 'English' }) 꼴 (js/villain/lang/lang.js).
// 쓰는 법: DEFAULT_MONSTERS (괴수 그림 목록). 도감(bestiary.js)이 가져다 씁니다.
// ─────────────────────────────────────────────────────────────

import { VOXEL_MONSTERS } from './voxelMonsters.js';
import { L } from '../lang/lang.js';

const COLS = 16;
const ROWS = 16;

function monster(id, name, cells, parts) {
  return Object.freeze({ id, name, cols: COLS, rows: ROWS, cells: Object.freeze(cells), parts: Object.freeze(parts), builtIn: true, updatedAt: 0 });
}

export const DEFAULT_MONSTERS = Object.freeze([
  monster(
    'builtin-dino',
    L({ ko: '초록 공룡', en: 'Green Dino' }),
    [
      '................',
      '................',
      '.........GGGGG..',
      '........GGGGGGG.',
      '........GWKGGGG.',
      '.....O..GKKGGGGG',
      '....OGGGGGGGGGGG',
      '...OGGGGGGGGKKKK',
      '...GGGGGGGGGWGW.',
      '..OGGGGGgggGG...',
      '..GGGGGggggGGG..',
      '.OGGGGGGgggg....',
      'GGGGGGGGgggg....',
      'GGG.GGGGGgg.....',
      '....GGG.GGG.....',
      '....GGGG.GGGG...',
    ],
    [{ type: 'claw', col: 13, row: 10 }],
  ),
  monster(
    'builtin-octopus',
    L({ ko: '보라 문어', en: 'Purple Octo' }),
    [
      '................',
      '......PPPP......',
      '....PPPPPPPP....',
      '...PPPPPPPPPP...',
      '...PPPPPPPPPP...',
      '...PWWWPPWWWP...',
      '...PWKKPPKKWP...',
      '...PWKKPPKKWP...',
      '...PpPPPPPPpP...',
      '...PPPPKKPPPP...',
      '....PPPPPPPP....',
      '..PP.PP..PP.PP..',
      '.PP..PP..PP..PP.',
      '.PP..PP..PP..PP.',
      'PP...PP..PP...PP',
      'pP...Pp..pP...Pp',
    ],
    [{ type: 'claw', col: 14, row: 13 }],
  ),
  monster(
    'builtin-dokkaebi',
    L({ ko: '빨강 도깨비', en: 'Red Goblin' }),
    [
      '....Y......Y....',
      '....YY....YY....',
      '....RRRRRRRR....',
      '...RRRRRRRRRR...',
      '...RKKRRRRKKR...',
      '...RWWKRRKWWR...',
      '...RWWKRRKWWR...',
      '...RRRRRRRRRR...',
      '...RRKKKKKKRR...',
      '...RRWKKKKWRR...',
      '..RRRRRRRRRRRR..',
      '..RR.YKYYKY.RR..',
      '..RR.YYKYYK.RR..',
      '.....KYYKYY.....',
      '.....RR..RR.....',
      '....RRR..RRR....',
    ],
    [{ type: 'claw', col: 13, row: 12 }],
  ),
  ...VOXEL_MONSTERS,
]);
