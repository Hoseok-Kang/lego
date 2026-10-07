// 블록 인형의 블록 목록 다루기 (voxelFigure.js 가 씀)
// 블록마다 '어느 손잡이에 붙었는지, 손잡이에서 얼마나 떨어졌는지, 무슨 색인지, 숨었는지'를 숫자 배열에 담고,
// 그 숫자로 그래픽 카드에 보낼 위치(행렬)와 색을 빠르게 채웁니다. 다시 붙는 블록의 톡 떨어지는 모션도 여기서.
//
//   createBlockStore(크기, 예전목록?) → { offset, node, color, hidden, dropY, grow, kind }   (예전 것을 복사해 늘림)
//   writeMatrices(배열, store, nodes, 개수)       손잡이 자세대로 블록 행렬 채우기 (숨은 블록은 크기 0)
//   writeColors(배열, store, 개수, 반짝색, 정도)   원래 색에 반짝임 섞어 채우기
//   blockWorldPosition(store, nodes, i, out)      블록 i 의 지금 세상 위치
//   createRestoreQueue(크기) → { add(i, 늦게), remove(i), step(dt, store), clear(), count }
//   markUpload(attribute, range, 개수)            앞쪽 '개수' 칸만 그래픽 카드로 보내기 (range 는 미리 만든 { start: 0, count: 0 })
//       다시 붙는 블록: 위에서 톡 떨어져 제자리에 붙고 살짝 통 튐
//
// 떨어지는 높이·빠르기는 아래 상수에서 바꿉니다.

const RESTORE_DROP = 5; // 다시 붙는 블록이 떨어지기 시작하는 높이 (칸)
const RESTORE_FALL = 0.26; // 떨어지는 시간 (초)
const RESTORE_BOUNCE = 0.2; // 붙은 뒤 톡 튀는 시간 (초)
const RESTORE_BOUNCE_HEIGHT = 0.45; // 톡 튀는 높이 (칸)

// three.js 의 addUpdateRange 는 부를 때마다 새 물건을 만들어서, 미리 만든 range 하나를 돌려 씀
export function markUpload(attribute, range, count) {
  range.start = 0;
  range.count = Math.max(1, count);
  attribute.updateRanges.length = 0;
  attribute.updateRanges.push(range);
  attribute.needsUpdate = true;
}

export function createBlockStore(size, old = null) {
  const store = {
    offset: new Float32Array(size * 3), // 손잡이에서 블록 가운데까지 (x, y, z)
    node: new Uint16Array(size), // 붙어 있는 손잡이 번호
    color: new Float32Array(size * 3), // 원래 색 (r, g, b)
    hidden: new Uint8Array(size), // 1 = 숨김 (떨어져 나감)
    dropY: new Float32Array(size), // 다시 붙는 중: 위로 떠 있는 높이
    grow: new Float32Array(size).fill(1), // 다시 붙는 중: 크기 (0 = 아직 안 보임)
    kind: new Uint8Array(size), // 0 보통, 1 몸통, 2 더한 부위(무기)
  };
  if (old) {
    for (const key of Object.keys(store)) store[key].set(old[key].subarray(0, Math.min(old[key].length, store[key].length)));
  }
  return store;
}

export function writeMatrices(array, store, nodes, total) {
  const { offset, node, hidden, dropY, grow } = store;
  for (let i = 0; i < total; i++) {
    const o = i * 16;
    const s = hidden[i] ? 0 : grow[i];
    if (s === 0) {
      for (let k = 0; k < 16; k++) array[o + k] = 0;
      continue;
    }
    const e = nodes[node[i]].matrixWorld.elements;
    const ox = offset[i * 3];
    const oy = offset[i * 3 + 1];
    const oz = offset[i * 3 + 2];
    array[o] = e[0] * s;
    array[o + 1] = e[1] * s;
    array[o + 2] = e[2] * s;
    array[o + 3] = 0;
    array[o + 4] = e[4] * s;
    array[o + 5] = e[5] * s;
    array[o + 6] = e[6] * s;
    array[o + 7] = 0;
    array[o + 8] = e[8] * s;
    array[o + 9] = e[9] * s;
    array[o + 10] = e[10] * s;
    array[o + 11] = 0;
    array[o + 12] = e[0] * ox + e[4] * oy + e[8] * oz + e[12];
    array[o + 13] = e[1] * ox + e[5] * oy + e[9] * oz + e[13] + dropY[i];
    array[o + 14] = e[2] * ox + e[6] * oy + e[10] * oz + e[14];
    array[o + 15] = 1;
  }
}

export function writeColors(array, store, total, flashColor, amount) {
  const keep = 1 - amount;
  const fr = flashColor.r * amount;
  const fg = flashColor.g * amount;
  const fb = flashColor.b * amount;
  const color = store.color;
  for (let i = 0, n = total * 3; i < n; i += 3) {
    array[i] = color[i] * keep + fr;
    array[i + 1] = color[i + 1] * keep + fg;
    array[i + 2] = color[i + 2] * keep + fb;
  }
}

export function blockWorldPosition(store, nodes, i, out) {
  const e = nodes[store.node[i]].matrixWorld.elements;
  const ox = store.offset[i * 3];
  const oy = store.offset[i * 3 + 1];
  const oz = store.offset[i * 3 + 2];
  return out.set(
    e[0] * ox + e[4] * oy + e[8] * oz + e[12],
    e[1] * ox + e[5] * oy + e[9] * oz + e[13] + store.dropY[i],
    e[2] * ox + e[6] * oy + e[10] * oz + e[14],
  );
}

export function createRestoreQueue(size) {
  const list = new Int32Array(Math.max(1, size));
  const time = new Float32Array(Math.max(1, size));
  let count = 0;

  function removeAt(k) {
    count--;
    list[k] = list[count];
    time[k] = time[count];
  }

  return {
    // 블록 i 를 delay 초 뒤에 떨어뜨리기 시작
    add(i, delay, store) {
      store.grow[i] = 0;
      store.dropY[i] = RESTORE_DROP;
      list[count] = i;
      time[count] = -delay;
      count++;
    },
    remove(i) {
      for (let k = 0; k < count; k++) {
        if (list[k] === i) {
          removeAt(k);
          return;
        }
      }
    },
    step(dt, store) {
      let k = 0;
      while (k < count) {
        const i = list[k];
        const t = (time[k] += dt);
        if (t < 0) {
          store.grow[i] = 0;
        } else if (t < RESTORE_FALL) {
          const p = t / RESTORE_FALL;
          store.dropY[i] = RESTORE_DROP * (1 - p * p);
          store.grow[i] = Math.min(1, 0.35 + p * 1.6);
        } else if (t < RESTORE_FALL + RESTORE_BOUNCE) {
          const q = (t - RESTORE_FALL) / RESTORE_BOUNCE;
          const bump = Math.sin(Math.PI * q);
          store.dropY[i] = RESTORE_BOUNCE_HEIGHT * bump * (1 - q);
          store.grow[i] = 1 + 0.22 * bump;
        } else {
          store.dropY[i] = 0;
          store.grow[i] = 1;
          removeAt(k);
          continue;
        }
        k++;
      }
    },
    clear() {
      count = 0;
    },
    get count() {
      return count;
    },
  };
}
