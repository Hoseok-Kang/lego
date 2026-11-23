// 영웅 '황금 수호자' 그림 (커다란 황금 갑옷, 하얀 눈이 빛나는 투구, 빨간 깃 장식, 남색 망토, 큰 방패와 황금 망치)
// 기사보다 큰 블록(GUARDIAN_SCALE)으로 만들어 키가 약 13칸입니다. 느리지만 묵직해 보이게 어깨를 넓게 했어요.
// 지도 읽는 법은 js/fight/art/voxelText.js 와 같습니다 (층마다 위에서 내려다본 글자 지도, 첫 줄이 뒤쪽).
//
//   GUARDIAN_SCALE
//   buildGuardianModel() → { parts, parents, popOrder, hammer: { voxels, grip, at }, height }
//       parts: legL legR body head crest(깃 장식) armL armR cape(망토) shield(방패)
//       popOrder: 맞을 때 먼저 떨어지는 블록 순서 (깃 장식 → 망토 아래부터 → 어깨 장식)
//       방패 손잡이는 평소 몸 왼쪽(SHIELD_REST)에 있고, 방패를 들 때 guardianRig 가 앞 가운데로 옮깁니다
//
// 색을 바꾸려면 COLORS 표를 고치세요. (js/bricks/brickColors.js 의 색만)

import { parseLayers } from '../../fight/art/voxelText.js';

export const GUARDIAN_SCALE = 0.75;
const SHIELD_REST = [-5, 6, 2]; // 방패 손잡이의 평소 자리 (모델 칸)

const COLORS = {
  Y: '#F2CD37', // 금색 갑옷
  O: '#F8BB3D', // 귤색 (금색 그늘)
  L: '#FFF03A', // 연노랑 (반짝)
  W: '#F4F4F4', // 흰색 (눈·무늬)
  N: '#0A3463', // 남색 (망토·속옷)
  B: '#0055BF', // 파랑 (방패 바탕)
  R: '#C91A09', // 빨강 (깃 장식)
  D: '#6C6E68', // 진한 회색 (장화·망치)
  A: '#A0A5A9', // 회색 (망치 머리)
  K: '#1B2A34', // 검정 (투구 틈)
  M: '#582A12', // 밤색 (허리띠·망치 자루)
};

const LEG = [
  [1, ['DD', 'DD', 'DD']],
  [1, ['OO', 'YY', 'YY']],
  [2, ['YY', 'YY', 'YL']],
];
const BODY = [
  [1, ['NNNNNNN', 'MMMMMMM', 'MMMMMMM', 'MMMMMMM', 'MMMYMMM']],
  [1, ['OOOOOOO', 'YYYYYYY', 'YYYYYYY', 'YYYYYYY', 'YYYWYYY']],
  [1, ['OOOOOOO', 'YYYYYYY', 'YYYYYYY', 'YYYYYYY', 'YYWWWYY']],
  [1, ['OOOOOOO', 'YYYYYYY', 'YYYYYYY', 'YYYYYYY', 'YYYWYYY']],
  [1, ['OOOOOOO', 'YYYYYYY', 'YYYYYYY', 'YYYYYYY', 'YLYYYLY']],
  [1, ['.OOOOO.', 'YYYYYYY', 'YYYYYYY', 'YYYYYYY', '.YYYYY.']],
];
const HEAD = [
  [1, ['YYYYY', 'YYYYY', 'YYYYY', 'YYYYY', 'YYKYY']],
  [1, ['YYYYY', 'YYYYY', 'YYYYY', 'YYYYY', 'KWKWK']], // 투구 틈 사이로 빛나는 눈
  [1, ['YYYYY', 'YYYYY', 'YYYYY', 'YYYYY', 'YYLYY']],
  [1, ['.OOO.', 'OYYYO', 'OYYYO', 'OYYYO', '.YYY.']],
];
const CREST = [
  [1, ['R', 'R', 'R', 'R', 'R']],
  [1, ['R', 'R', 'R', 'R', '.']],
  [1, ['R', 'R', '.', '.', '.']],
];
// 팔: 손 → 팔 → 큰 어깨 장식 (3×3)
const ARM = [
  [1, ['...', '.D.', '...']],
  [2, ['...', '.Y.', '...']],
  [1, ['...', '.O.', '...']],
  [1, ['YYY', 'YYY', 'YWY']],
  [1, ['OOO', 'YLY', 'YYY']],
];
const CAPE = [
  [1, ['N.N.N.N']],
  [2, ['NNNNNNN']],
  [1, ['NNNBNNN']],
  [3, ['NNNNNNN']],
  [1, ['NYYYYYN']],
];
// 방패: 앞에서 본 모습 (아래 → 위), 두께 한 칸. 파란 바탕에 흰 태양 무늬, 금 테두리
const SHIELD = [
  [1, ['..YYY..']],
  [1, ['.YBBBY.']],
  [1, ['YBBWBBY']],
  [1, ['YBWLWBY']],
  [1, ['YBBWBBY']],
  [1, ['YBBBBBY']],
  [1, ['YYYYYYY']],
];
// 망치: 아래(자루 끝) → 위(머리). 머리는 회색 몸통에 금 띠
const HAMMER = [
  [1, ['...', '.Y.', '...']],
  [5, ['...', '.M.', '...']],
  [1, ['AAA', 'AYA', 'AAA']],
  [1, ['AYA', 'YYY', 'AYA']],
  [1, ['AAA', 'AAA', 'AAA']],
];

export function buildGuardianModel() {
  const part = (layers, pivot, offset) => ({ pivot, voxels: parseLayers(layers, COLORS, { offset }) });
  const parts = {
    legL: part(LEG, [-1.5, 4, 0], [-1.5, 0, 0]),
    legR: part(LEG, [1.5, 4, 0], [1.5, 0, 0]),
    body: part(BODY, [0, 4, 0], [0, 4, 0]),
    head: part(HEAD, [0, 10, 0], [0, 10, 0]),
    crest: part(CREST, [0, 14, 0], [0, 14, 0]),
    armL: part(ARM, [-4.5, 9, 0], [-4.5, 4, 0]),
    armR: part(ARM, [4.5, 9, 0], [4.5, 4, 0]),
    cape: part(CAPE, [0, 9.5, -3], [0, 2, -3]),
    shield: part(SHIELD, SHIELD_REST, [SHIELD_REST[0], 3, SHIELD_REST[2]]),
  };
  const parents = { head: 'body', crest: 'head', armL: 'body', armR: 'body', cape: 'body', shield: 'body' };

  // 떨어지는 순서: 깃 장식(위 → 아래), 망토(아래 → 위), 어깨 장식 윗줄
  const byHeight = (name, dir, minY = -Infinity) =>
    parts[name].voxels
      .map((v, index) => ({ part: name, index, y: v.y }))
      .filter((v) => v.y >= minY)
      .sort((a, b) => (a.y - b.y) * dir)
      .map(({ part, index }) => ({ part, index }));
  const popOrder = [...byHeight('crest', -1), ...byHeight('cape', 1), ...byHeight('armL', -1, 8), ...byHeight('armR', -1, 8)];

  // 망치: 자루 아래쪽을 오른손(at)에 쥠 → 머리가 위로
  const hammer = { voxels: parseLayers(HAMMER, COLORS), grip: [0, 1.5, 0], at: [4.5, 4.5, 0.8] };
  return { parts, parents, popOrder, hammer, height: 17 * GUARDIAN_SCALE };
}
