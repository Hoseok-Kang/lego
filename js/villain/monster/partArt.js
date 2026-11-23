// 공격 부품 블록 모양 (집게발, 불 뿜는 입, 돌진 뿔)
// 괴수 그림의 칸 앞면에 스티커처럼 붙는 작은 장난감 부품입니다. 멀리서도 무엇인지 알아보게 색을 또렷하게 썼습니다.
//
//   getPartArt(type, side) → { voxels: [{ x, y, z, hex }], grip: [x, y, z], tip: [x, y, z], rest: { x, y, z } }
//       type: 'claw' | 'fireMouth' | 'horn'   side: +1 오른쪽 / -1 왼쪽 (집게발이 바깥쪽을 보게)
//       grip: 괴수에 붙는 점 (이 점을 중심으로 휘두름) ; tip: 끝 점 (불이 나오는 곳, 집게 끝)
//       rest: 가만히 있을 때 기울기 (라디안)
//   PART_TYPES   부품 이름 목록
//
// 모양을 바꾸려면 아래 그림(줄 = 위→아래, 글자 = 색, '.' = 빈칸)을 고치면 됩니다. 색은 블록 색 목록의 색만 씁니다.

const HEX = {
  R: '#C91A09', // 빨강
  D: '#720E0F', // 진한 빨강
  W: '#F4F4F4', // 흰색
  K: '#1B2A34', // 검정
  O: '#FE8A18', // 주황
  Y: '#FFF03A', // 연노랑
  C: '#F6D7B3', // 연살구 (뿔)
  T: '#AA7D55', // 캐러멜 (뿔 밑동)
  A: '#6C6E68', // 진한 회색
};

// 겹(앞뒤 z) 마다 그림 한 장. 첫 겹이 괴수 몸에 닿는 쪽.
const ART = {
  // 집게발: 팔 + 벌린 집게 (오른쪽을 보는 모양, 2겹 두께)
  claw: {
    layers: [
      ['...RRW', '..RR..', 'DDR...', '..RR..', '...RRW'],
      ['...RRW', '..RR..', 'DDR...', '..RR..', '...RRW'],
    ],
    grip: [0, 2, 0.5], // [가로 칸, 아래에서 몇 번째 줄, 겹]
    tip: [5, 2, 0.5],
    rest: { x: 0, y: 0, z: 0.3 },
  },
  // 불 뿜는 입: 송곳니가 있는 네모난 주둥이, 안쪽이 불빛
  fireMouth: {
    layers: [
      ['DDD', 'DDD', 'DDD'],
      ['DDD', 'OYO', 'DDD'],
      ['DDD', 'W.W', 'DDD'],
    ],
    grip: [1, 1, -0.5],
    tip: [1, 1, 2.6],
    rest: { x: 0, y: 0, z: 0 },
  },
  // 돌진 뿔: 앞으로 나와 위로 휘어 올라가는 뿔
  horn: {
    layers: [
      ['...', '.T.', 'TTT', '.T.'],
      ['...', '.C.', 'CCC', '...'],
      ['.C.', '.C.', '...', '...'],
      ['.W.', '.W.', '...', '...'],
      ['.W.', '...', '...', '...'],
    ],
    grip: [1, 1, -0.5],
    tip: [1, 3.4, 4],
    rest: { x: 0, y: 0, z: 0 },
  },
};

export const PART_TYPES = Object.keys(ART);

export function getPartArt(type, side = 1) {
  const art = ART[type];
  if (!art) return null;
  const flip = type === 'claw' && side < 0 ? -1 : 1;
  const voxels = [];
  art.layers.forEach((layer, z) => {
    layer.forEach((line, lineIndex) => {
      const y = layer.length - 1 - lineIndex;
      for (let x = 0; x < line.length; x++) {
        const hex = HEX[line[x]];
        if (hex) voxels.push({ x: x * flip, y, z, hex });
      }
    });
  });
  return {
    voxels,
    grip: [art.grip[0] * flip, art.grip[1], art.grip[2]],
    tip: [art.tip[0] * flip, art.tip[1], art.tip[2]],
    rest: { x: art.rest.x, y: art.rest.y, z: art.rest.z * flip },
  };
}
