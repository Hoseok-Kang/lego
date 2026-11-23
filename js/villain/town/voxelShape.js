// 블록 모양 만들기 도구 (건물·나무 같은 것을 '상자, 벽, 한 칸' 으로 쌓아 올림)
// 같은 자리에 두 번 놓으면 나중 것이 남고, 색을 비워서 놓으면 그 칸이 지워집니다.
// 칸 좌표는 정수입니다: x 오른쪽, y 위(0 = 바닥에 닿는 층), z 앞쪽(카메라 쪽).
//
//   const s = createShape()
//   s.set(x, y, z, 색)                       한 칸 (색을 null 로 주면 지움)
//   s.box(x0, y0, z0, x1, y1, z1, 색)        꽉 찬 상자 (끝 칸 포함)
//   s.walls(x0, y0, z0, x1, y1, z1, 색)      속이 빈 네모 벽 (지붕·바닥 없음)
//   s.clear(x0, y0, z0, x1, y1, z1)          상자만큼 지우기 (문·창문 구멍)
//   s.voxels() → [{ x, y, z, hex }]

export function createShape() {
  const cells = new Map();
  const key = (x, y, z) => `${x},${y},${z}`;

  function set(x, y, z, hex) {
    if (hex) cells.set(key(x, y, z), { x, y, z, hex });
    else cells.delete(key(x, y, z));
  }

  function box(x0, y0, z0, x1, y1, z1, hex) {
    for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) set(x, y, z, hex);
  }

  function walls(x0, y0, z0, x1, y1, z1, hex) {
    for (let y = y0; y <= y1; y++) {
      for (let z = z0; z <= z1; z++) {
        for (let x = x0; x <= x1; x++) {
          if (x === x0 || x === x1 || z === z0 || z === z1) set(x, y, z, hex);
        }
      }
    }
  }

  return {
    set,
    box,
    walls,
    clear: (x0, y0, z0, x1, y1, z1) => box(x0, y0, z0, x1, y1, z1, null),
    voxels: () => [...cells.values()],
  };
}
