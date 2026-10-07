// 떠오르는 글자 ('-10', '펑!', '+30', '장전!')
// 토끼 머리 위에서 통 튀어나와 위로 떠오르다 사라집니다. 카메라가 움직여도 그 자리(세상 위치)를 따라갑니다.
// 글자 칸(DOM)을 미리 만들어 두고 돌려 써서, 많이 떠도 가볍습니다.
//
//   const floats = createFloatText(layerElement, worldToScreen)
//       layerElement: fight.html 의 #floatLayer
//       worldToScreen(위치, out) → { x, y, visible }   (followCamera.js 의 view.worldToScreen)
//   floats.add(위치, 글자, { kind = 'damage', height })   위치: 세상 위치 (Vector3, 보통 토끼 발밑)
//       kind: 'damage' 적이 맞음 · 'big' 세게 맞음 · 'hurt' 내 토끼가 맞음 · 'pop' 펑! · 'heal' 회복
//             'info' 안내 (장전! 등) · 'deflect' 총알 튕김
//       height: 위치보다 몇 칸 위에서 시작할지 (없으면 종류별 기본값 → 토끼 머리 위)
//   floats.update(dt)       매 장면 (게임이 멈추면 글자도 멈춤)
//   floats.clear()          모두 지우기 (다시 하기)
//
// 글자 색·크기는 css/fight-fx.css 의 '떠오르는 글자', 움직임은 아래 상수에서 바꿉니다.

import * as THREE from '../../lib/three.js';

const POOL_SIZE = 32; // 동시에 뜰 수 있는 글자 수 (넘으면 가장 오래된 글자를 다시 씀)
const RISE_PX = 52; // 사라질 때까지 위로 떠오르는 거리 (화면 px)
const JITTER_PX = 16; // 같은 곳에 여러 글자가 겹치지 않게 좌우로 흩는 정도
const EDGE_PX = 44; // 글자 가운데가 화면 가장자리에서 이만큼은 안쪽에 (잘리지 않게)
// 종류별: 사는 시간(초), 시작 높이(칸), 처음에 커지는 정도, 흔들리는 각도
const KINDS = {
  damage: { life: 0.7, height: 13, pop: 1.35, wobble: 0 },
  big: { life: 0.85, height: 14, pop: 1.6, wobble: 6 },
  hurt: { life: 0.8, height: 14, pop: 1.4, wobble: 0 },
  pop: { life: 1.15, height: 9, pop: 1.9, wobble: 10 },
  heal: { life: 1.0, height: 14, pop: 1.4, wobble: 0 },
  info: { life: 0.9, height: 17, pop: 1.2, wobble: 0 },
  deflect: { life: 0.6, height: 8, pop: 1.3, wobble: 0 },
};

export function createFloatText(layerElement, worldToScreen) {
  const items = [];
  const screen = { x: 0, y: 0, visible: false };
  const view = { width: 0, height: 0 }; // 화면 크기: 처음 한 번과 창 크기가 바뀔 때만 읽음 (매 장면 읽으면 브라우저가 화면 배치를 다시 계산해 느려짐)
  let nextSteal = 0;

  for (let i = 0; i < POOL_SIZE; i++) {
    const node = document.createElement('span');
    node.className = 'float-text';
    node.style.display = 'none';
    layerElement.append(node);
    items.push({ node, active: false, age: 0, life: 1, world: new THREE.Vector3(), jitter: 0, style: KINDS.damage, shown: false });
  }

  function add(position, text, { kind = 'damage', height } = {}) {
    const style = KINDS[kind] ?? KINDS.damage;
    let item = items.find((entry) => !entry.active);
    if (!item) {
      item = items[nextSteal];
      nextSteal = (nextSteal + 1) % items.length;
    }
    item.active = true;
    item.age = 0;
    item.life = style.life;
    item.style = style;
    item.world.set(position.x, (position.y ?? 0) + (height ?? style.height), position.z);
    item.jitter = (Math.random() * 2 - 1) * JITTER_PX;
    item.spin = (Math.random() < 0.5 ? -1 : 1) * style.wobble;
    item.node.textContent = String(text);
    item.node.dataset.kind = kind;
    layerElement.append(item.node); // 새 글자가 맨 위에 보이게
    place(item);
    return item;
  }

  function measure() {
    view.width = window.innerWidth;
    view.height = window.innerHeight;
  }

  measure();
  window.addEventListener('resize', measure, { passive: true });

  function update(dt) {
    for (const item of items) {
      if (!item.active) continue;
      item.age += dt;
      if (item.age >= item.life) {
        item.active = false;
        hide(item);
        continue;
      }
      place(item);
    }
  }

  // 글자 하나를 화면에 놓기: 통 커졌다 → 제자리 → 떠오르며 흐려짐
  function place(item) {
    worldToScreen(item.world, screen);
    if (!screen.visible) {
      hide(item);
      return;
    }
    const t = item.age / item.life;
    const { pop } = item.style;
    let scale;
    if (t < 0.12) scale = 0.4 + (pop - 0.4) * easeOut(t / 0.12);
    else if (t < 0.3) scale = pop + (1 - pop) * easeOut((t - 0.12) / 0.18);
    else scale = 1;
    const rise = RISE_PX * easeOut(t);
    const angle = item.spin * Math.sin(t * Math.PI * 3) * (1 - t);
    const opacity = t < 0.65 ? 1 : 1 - (t - 0.65) / 0.35;
    const node = item.node;
    if (!item.shown) {
      node.style.display = '';
      item.shown = true;
    }
    node.style.opacity = opacity.toFixed(2);
    const x = clamp(screen.x + item.jitter, EDGE_PX, view.width - EDGE_PX);
    const y = clamp(screen.y - rise, EDGE_PX, view.height - EDGE_PX * 0.5);
    node.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -50%) scale(${scale.toFixed(3)}) rotate(${angle.toFixed(1)}deg)`;
  }

  function hide(item) {
    if (!item.shown) return;
    item.node.style.display = 'none';
    item.shown = false;
  }

  function clear() {
    for (const item of items) {
      item.active = false;
      hide(item);
    }
  }

  return { add, update, clear };
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

function easeOut(t) {
  return 1 - (1 - t) * (1 - t);
}
