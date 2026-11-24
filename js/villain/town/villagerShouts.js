// 마을 사람 말풍선 상자 (3D 마을 위에 만화 말풍선을 띄움 — '으악!' '살려줘!' '영웅이다!')
// 누가 무슨 말을 할지는 villagerTalk.js 가 정하고, 여기서는 받은 말풍선을 그 사람 머리 위 화면 자리에 그리기만 합니다.
// 말풍선은 뿅 커졌다가 흔들흔들, 끝에는 흐려지며 사라집니다. 나이(bubble.age)가 게임 시간으로만 늘어서
// 실제 시계를 쓰지 않고, ?capture 로 한 장면씩 넘겨도 똑같이 나옵니다.
//
//   const shouts = createVillagerShouts({ events, view, layer })
//       view: 마을 카메라 (stage.view, worldToScreen 을 씀),  layer: 말풍선을 넣을 화면 위 상자 (raidFeedback 의 글자 상자)
//   shouts.update()      매 장면 (자리·크기·흐려짐 맞추기) ; shouts.clear() ; shouts.dispose()
//   shouts.count         지금 화면에 있는 말풍선 수
//
// 듣는 소식: villagerShout { bubble }
// 말풍선 모양·색·글자 크기는 css/villain-villagers.css, 뿅·흔들 느낌은 아래 상수에서 바꿉니다.

const POP_SECONDS = 0.12; // 뿅 커지는 시간
const SETTLE_SECONDS = 0.1; // 살짝 줄어 제 크기가 되는 시간
const POP_FROM = 0.25; // 처음 크기 (배)
const POP_OVER = 1.22; // 가장 커질 때 (배)
const WOBBLE_DEG = 10; // 흔들리는 각도
const WOBBLE_RATE = 22; // 흔들리는 빠르기
const WOBBLE_DAMP = 3; // 흔들림이 잦아드는 빠르기
const FADE_SECONDS = 0.28; // 끝에 흐려지는 시간
const RISE_PX = 10; // 떠 있는 동안 위로 떠오르는 높이 (px)
const GAP_PX = 4; // 겹친 말풍선끼리 띄우는 틈
const EDGE_PX = 4; // 화면 가장자리와 말풍선 사이 여유
const MAX_ELEMENTS = 8; // 안전장치: 이보다 많으면 가장 오래된 것부터 지움

export function createVillagerShouts({ events = null, view = null, layer = null } = {}) {
  if (!events || !view || !layer || typeof document === 'undefined') {
    return { update() {}, clear() {}, dispose() {}, count: 0 };
  }
  const root = document.createElement('div');
  root.className = 'vv-shouts';
  root.setAttribute('aria-hidden', 'true');
  layer.appendChild(root);
  const items = []; // { el, bubble, w, h, x, y }
  const area = { w: 0, h: 0 }; // 상자 안 크기 (px, 화면 크기 배율 전)
  const pool = [];

  function add({ bubble } = {}) {
    if (!bubble || bubble.done) return;
    if (items.length >= MAX_ELEMENTS) release(items.shift());
    const el = pool.pop() || document.createElement('div');
    el.className = `vv-bubble vv-${bubble.kind || 'panic'}`;
    el.textContent = bubble.text;
    el.style.opacity = '0';
    root.appendChild(el);
    // 크기는 한 번만 잼 (겹침 비키기에 씀)
    const item = { el, bubble, w: el.offsetWidth || 60, h: el.offsetHeight || 28, x: 0, y: 0 };
    items.push(item);
    const box = root.getBoundingClientRect();
    place(item, box, scaleOf(box));
    write(item);
  }

  function release(item) {
    if (!item) return;
    item.el.remove();
    pool.push(item.el);
  }

  // box: 상자의 화면 위치, k: 상자가 화면 크기 배율(--ui-scale)로 줄거나 커진 정도 (화면 px = 상자 안 px × k)
  function place(item, box, k = 1) {
    const b = item.bubble;
    const screen = view.worldToScreen(b.anchor);
    const age = b.age;
    const t = b.life > 0 ? Math.min(1, age / b.life) : 1;
    let scale = 1;
    if (age < POP_SECONDS) scale = POP_FROM + (POP_OVER - POP_FROM) * (1 - (1 - age / POP_SECONDS) ** 2);
    else if (age < POP_SECONDS + SETTLE_SECONDS) scale = POP_OVER - (POP_OVER - 1) * ((age - POP_SECONDS) / SETTLE_SECONDS);
    const tilt = Math.sin(age * WOBBLE_RATE + (b.text.length % 3)) * WOBBLE_DEG * Math.exp(-age * WOBBLE_DAMP);
    const left = b.life - age;
    const opacity = left < FADE_SECONDS ? Math.max(0, left / FADE_SECONDS) : 1;
    item.x = (screen.x - box.left) / k;
    item.y = (screen.y - box.top) / k - t * RISE_PX;
    item.scale = scale;
    item.tilt = tilt;
    item.el.style.opacity = screen.visible ? opacity.toFixed(3) : '0';
  }

  // 화면 가장자리에 걸친 말풍선은 안쪽으로 밀어 넣어 글자가 잘리지 않게
  function keepInside(item) {
    const W = area.w;
    const H = area.h;
    if (!(W > 0 && H > 0)) return;
    const half = (item.w * (item.scale || 1)) / 2 + EDGE_PX;
    item.x = Math.min(W - half, Math.max(half, item.x));
    item.y = Math.min(H - EDGE_PX, Math.max(item.h + EDGE_PX * 2, item.y));
  }

  function write(item) {
    keepInside(item);
    item.el.style.transform = `translate(${item.x.toFixed(1)}px,${item.y.toFixed(1)}px) translate(-50%,-100%) rotate(${item.tilt.toFixed(2)}deg) scale(${item.scale.toFixed(3)})`;
  }

  // 겹친 말풍선은 나중 것을 위로 올림 (꼬리 끝은 그대로 머리 위, 몸통만 비킴)
  function unstack() {
    for (let i = 1; i < items.length; i++) {
      const a = items[i];
      for (let j = 0; j < i; j++) {
        const b = items[j];
        if (Math.abs(a.x - b.x) < (a.w + b.w) / 2 && Math.abs(a.y - b.y) < (a.h + b.h) / 2 + GAP_PX) a.y = b.y - (a.h + b.h) / 2 - GAP_PX;
      }
    }
  }

  // 말풍선 상자는 화면 크기 배율(#ui 의 --ui-scale)만큼 통째로 줄거나 커져 있음 → 화면 px 을 상자 안 px 로 바꿀 때 나눔
  function scaleOf(box) {
    area.w = root.offsetWidth;
    area.h = root.offsetHeight;
    return area.w > 0 && box.width > 0 ? box.width / area.w : 1;
  }

  function update() {
    if (!items.length) return;
    const box = root.getBoundingClientRect();
    const k = scaleOf(box);
    for (let i = items.length - 1; i >= 0; i--) {
      const item = items[i];
      if (item.bubble.done) {
        release(item);
        items.splice(i, 1);
      } else place(item, box, k);
    }
    unstack();
    for (const item of items) write(item);
  }

  function clear() {
    for (const item of items) release(item);
    items.length = 0;
  }

  const off = events.on('villagerShout', add);
  return {
    update,
    clear,
    get count() {
      return items.length;
    },
    dispose() {
      clear();
      off?.();
      root.remove();
    },
  };
}
