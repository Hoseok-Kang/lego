// 몬스터 기본 그림
// 슬라임, 박쥐, 골렘, 대장 골렘의 모습을 글자 지도로 그립니다. 글자 하나 = 블록 한 칸.
// 줄의 글자 수(가로 칸 수)는 gameConfig.js 의 enemies.*.columns 와 꼭 같아야 합니다.
//   슬라임 8칸, 박쥐 9칸, 골렘 10칸, 대장 골렘 15칸
// 맨 왼쪽 칸과 맨 오른쪽 칸, 맨 위 줄과 맨 아래 줄에는 블록이 하나 이상 있어야 크기가 정확히 맞습니다.
// 색은 js/bricks/brickColors.js 에 있는 블록 색만 씁니다. '.' 은 빈칸입니다.
//
//   MONSTER_ART.slime()  → 캔버스 (슬라임 그림)
//   MONSTER_ART.bat()    → 캔버스 (박쥐 그림)
//   MONSTER_ART.golem()  → 캔버스 (골렘 그림)
//   MONSTER_ART.boss()   → 캔버스 (대장 골렘 그림)

import { drawPixelMap } from './pixelArt.js';

// 슬라임: 라임색 말랑말랑 젤리, 까만 눈, 볼터치 (가로 8칸)
const SLIME = {
  rows: [
    '...OO...',
    '..OLLO..',
    '.OWLLLO.',
    'OWLLLLLO',
    'OLKLLKLO',
    'OLKLLKLO',
    'OPLKKLPO',
    'OGLLLLGO',
    '.OOOOOO.',
  ],
  legend: {
    O: '#184632', // 테두리 (짙은 초록)
    L: '#BBE90B', // 몸 (라임)
    G: '#4B9F4A', // 아래쪽 그늘 (초록)
    W: '#F4F4F4', // 반짝임 (흰색)
    K: '#1B2A34', // 눈, 입 (검정)
    P: '#FF698F', // 볼터치 (코랄)
  },
};

// 박쥐: 보라색, 날개를 활짝 편 모습, 연보라 얼굴 (가로 9칸, 납작하게 넓음)
const BAT = {
  rows: [
    'P.......P',
    'PP.P.P.PP',
    'PMPVVVPMP',
    'MMPYVYPMM',
    'MMMVWVMMM',
    'M.MPPPM.M',
    '...P.P...',
  ],
  legend: {
    P: '#3F3691', // 날개 뼈, 귀, 몸 (보라)
    M: '#923978', // 날개 막 (자주)
    V: '#AC78BA', // 얼굴 (라벤더)
    Y: '#FFF03A', // 눈 (연노랑)
    W: '#F4F4F4', // 송곳니 (흰색)
  },
};

// 골렘: 회색 바위 몸, 노랗게 빛나는 눈, 어깨에 이끼 (가로 10칸)
// 위에서 내려다보는 게임이라 맨 윗줄(머리, 어깨)은 밝은 색으로 칠함
const GOLEM = {
  rows: [
    '..LLLLLL..',
    '.DLLLLLLD.',
    '.DLYLLYLD.',
    '.DLLKKLLD.',
    'LMDDDDDDML',
    'DLLDLLDLLD',
    'DLLDLLDLLD',
    'DLLDLLDLLD',
    'DDDDLLDDDD',
    '..DLLLLD..',
    '..DLDDLD..',
    '.DDD..DDD.',
  ],
  legend: {
    D: '#6C6E68', // 테두리, 바위 틈 (진한 회색)
    L: '#A0A5A9', // 바위 (밝은 회색)
    Y: '#FFF03A', // 빛나는 눈 (연노랑)
    K: '#1B2A34', // 입 (검정)
    M: '#4B9F4A', // 이끼 (초록)
  },
};

// 대장 골렘: 진한 빨강 큰 몸, 휘어진 뿔, 노란 왕관과 허리띠 (가로 15칸)
const BOSS = {
  rows: [
    'H....C.C.C....H',
    'HS...CCCCC...SH',
    '.SS.KKKKKKK.SS.',
    '..SKrrrrrrrKS..',
    '...KRYYRYYRK...',
    '...KRRRRRRRK...',
    '...KRWRWRWRK...',
    '.KKKKKKKKKKKKK.',
    'KrrrBrrrrrBrrrK',
    'KRRBBRRRRRBBRRK',
    'KRRKBRRRRRBKRRK',
    'KRRKBCCCCCBKRRK',
    'KBBKBRRRRRBKBBK',
    'KKKKKRRKRRKKKKK',
    '....KBBKBBK....',
    '...KKKKKKKKK...',
  ],
  legend: {
    K: '#1B2A34', // 테두리 (검정)
    R: '#720E0F', // 몸 (진한 빨강)
    r: '#C91A09', // 머리·어깨 밝은 부분 (빨강)
    B: '#582A12', // 그늘, 다리 (밤색)
    H: '#F4F4F4', // 뿔 끝 (흰색)
    S: '#E4CD9E', // 뿔 (모래색)
    C: '#F2CD37', // 왕관, 허리띠 (노랑)
    Y: '#FFF03A', // 눈 (연노랑)
    W: '#F4F4F4', // 이빨 (흰색)
  },
};

function draw({ rows, legend }) {
  return () => drawPixelMap(rows, legend);
}

export const MONSTER_ART = {
  slime: draw(SLIME),
  bat: draw(BAT),
  golem: draw(GOLEM),
  boss: draw(BOSS),
};
