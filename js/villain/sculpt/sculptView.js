// ─────────────────────────────────────────────────────────────
// 악당 타이쿤 3D 작업대: 3D 화면 (보기 + 누르기 · 끌기 · 두 손가락)
// 블록 공간을 3D 로 보여 주고, 누른 자리를 작업대 화면(sculptScreen.js)에 알려 줍니다.
//   · 블록이나 바닥을 누르면 → 도구 쓰기 (지우기 · 칠하기는 끌면 같은 면을 따라 계속)
//   · 빈 곳을 끌기 / 마우스 오른쪽 끌기 / 두 손가락 끌기 → 빙 둘러보기 (쌓기 도구는 블록 위에서 끌어도 둘러보기)
//   · 두 손가락 벌리기 · 마우스 휠 · [+][−] 단추 → 가까이 · 멀리,  빈 곳 두 번 톡 · [정면] 단추 → 처음 모습
// 그림판(WebGL)은 그리기 화면 미리보기와 하나를 같이 씁니다 (monster/sharedRenderer.js).
//
// 쓰는 법
//   const view = createSculptView(hostEl, { grid, colorOf(ch) → hex, hooks })
//     hooks: { tool() → 'add'|'erase'|'paint'|'pick', start(), apply(hit) → 바뀌었는지, end(), cancel(), ghost(hit) → { cell, kind, hex } | null }
//   view.show() / view.hide()      작업대를 열고 닫을 때 (보일 때 그림판을 가져옴)
//   view.setLayer(z) / view.setMirror(on) / view.render() (다시 그려 달라고 부탁) / view.dispose()
//
// 글자는 아래 TEXT, 손가락이 이만큼 움직이면 '끌기'로 보는 거리는 SLOP 에서 바꿉니다.
// ─────────────────────────────────────────────────────────────

import * as THREE from '../../lib/three.js';
import { claimRenderer, ownsRenderer, releaseRenderer } from '../monster/sharedRenderer.js';
import { createSculptCamera } from './sculptCamera.js';
import { createSculptScene } from './sculptScene.js';
import { icon } from '../draw/paintIcons.js';
import { L } from '../lang/lang.js';

const TEXT = L({
  ko: {
    zoomIn: '가까이',
    zoomOut: '멀리',
    reset: '정면 · 처음 모습',
    turn: '옆으로 돌리기',
    help: '빈 곳을 끌면 빙 돌아요 · 두 손가락으로 벌리면 가까이',
  },
  en: {
    zoomIn: 'Zoom in',
    zoomOut: 'Zoom out',
    reset: 'Front · Reset view',
    turn: 'Turn sideways',
    help: 'Drag empty space to spin · Pinch with two fingers to zoom',
  },
});
const SLOP = { mouse: 5, touch: 12, pen: 8 }; // 이만큼(픽셀) 움직이면 '끌기'
const DOUBLE_TAP_MS = 320;
const WHEEL_STEP = 1.12;

export function createSculptView(hostEl, { grid, colorOf, hooks }) {
  hostEl.classList.add('vs-view');
  hostEl.innerHTML = `
    <div class="vs-surface"></div>
    <div class="vs-view-tools">
      <button type="button" class="vs-round" data-view="in" title="${TEXT.zoomIn}" aria-label="${TEXT.zoomIn}">+</button>
      <button type="button" class="vs-round" data-view="out" title="${TEXT.zoomOut}" aria-label="${TEXT.zoomOut}">−</button>
      <button type="button" class="vs-round" data-view="turn" title="${TEXT.turn}" aria-label="${TEXT.turn}">${icon('redo')}</button>
      <button type="button" class="vs-round" data-view="reset" title="${TEXT.reset}" aria-label="${TEXT.reset}">${icon('cube')}</button>
    </div>
    <p class="vs-view-help">${TEXT.help}</p>`;
  const surface = hostEl.querySelector('.vs-surface');
  const renderer = claimRenderer(surface);
  const world = createSculptScene(renderer, { w: grid.w, h: grid.h, d: grid.d });
  world.setColors(colorOf);
  const cam = createSculptCamera({ w: grid.w, h: grid.h, d: grid.d, center: world.center });
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let builtVersion = -1;
  let frame = 0;
  let open = false;
  const pointers = new Map();
  let gesture = null;
  let lastTap = { time: 0, x: 0, y: 0 };

  function draw() {
    frame = 0;
    if (!open) return;
    if (!ownsRenderer(surface)) {
      claimRenderer(surface);
      resize();
    }
    if (builtVersion !== grid.version) {
      world.rebuild(grid);
      builtVersion = grid.version;
    }
    cam.apply();
    renderer.render(world.scene, cam.camera);
  }
  const render = () => {
    if (!frame && open) frame = requestAnimationFrame(draw);
  };

  function resize() {
    if (!ownsRenderer(surface)) return;
    const width = Math.max(1, surface.clientWidth);
    const height = Math.max(1, surface.clientHeight);
    renderer.setSize(width, height, false);
    cam.setAspect(width / height);
    render();
  }
  const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
  observer?.observe(surface);
  const stopGrid = grid.onChange(render);

  function hitAt(clientX, clientY) {
    const rect = renderer.domElement.getBoundingClientRect();
    ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    if (builtVersion !== grid.version) {
      world.rebuild(grid);
      builtVersion = grid.version;
    }
    cam.apply();
    raycaster.setFromCamera(ndc, cam.camera);
    return world.hit(raycaster);
  }

  // 끌기 도중에는 처음 누른 면과 같은 판 위의 블록만 (지우개가 굴을 파고 들어가지 않게)
  function lockOf(hit) {
    if (!hit.cell) return null;
    const axis = hit.normal.findIndex((v) => v !== 0);
    return { axis, value: [hit.cell.x, hit.cell.y, hit.cell.z][axis] };
  }
  const onLock = (hit, lock) => !lock || (hit.cell && [hit.cell.x, hit.cell.y, hit.cell.z][lock.axis] === lock.value);

  function showGhost(hit) {
    const ghost = hit ? hooks.ghost?.(hit) : null;
    world.setGhost(ghost?.cell ?? null, ghost?.kind, ghost?.hex);
    render();
  }

  function onDown(event) {
    event.preventDefault();
    try {
      surface.setPointerCapture?.(event.pointerId);
    } catch {
      // 손가락이 이미 떨어진 경우 등: 붙잡지 않아도 됨
    }
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    showGhost(null);
    if (pointers.size >= 2) {
      if (gesture?.kind === 'tool' && gesture.stroke) hooks.cancel();
      const [a, b] = [...pointers.values()];
      gesture = { kind: 'pinch', dist: Math.hypot(a.x - b.x, a.y - b.y), x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      return;
    }
    const base = { id: event.pointerId, x: event.clientX, y: event.clientY, sx: event.clientX, sy: event.clientY, moved: false, slop: SLOP[event.pointerType] ?? 8 };
    if (event.pointerType === 'mouse' && event.button !== 0) {
      gesture = { ...base, kind: 'orbit' };
      return;
    }
    const hit = hitAt(event.clientX, event.clientY);
    if (!hit) {
      gesture = { ...base, kind: 'orbit', background: true };
      return;
    }
    const tool = hooks.tool();
    const stroke = tool === 'erase' || tool === 'paint';
    gesture = { ...base, kind: 'tool', hit, stroke, lock: stroke ? lockOf(hit) : null };
    if (stroke) {
      hooks.start();
      hooks.apply(hit);
    }
  }

  function onMove(event) {
    const point = pointers.get(event.pointerId);
    if (!point) {
      if (event.pointerType === 'mouse' && !gesture) showGhost(hitAt(event.clientX, event.clientY));
      return;
    }
    point.x = event.clientX;
    point.y = event.clientY;
    if (!gesture) return;
    if (gesture.kind === 'pinch') {
      if (pointers.size < 2) return;
      const [a, b] = [...pointers.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const x = (a.x + b.x) / 2;
      const y = (a.y + b.y) / 2;
      if (gesture.dist > 0 && dist > 0) cam.zoom(dist / gesture.dist);
      cam.rotate(x - gesture.x, y - gesture.y);
      Object.assign(gesture, { dist, x, y });
      render();
      return;
    }
    if (event.pointerId !== gesture.id) return;
    if (!gesture.moved && Math.hypot(event.clientX - gesture.sx, event.clientY - gesture.sy) > gesture.slop) gesture.moved = true;
    if (gesture.kind === 'tool') {
      if (gesture.stroke) {
        const hit = hitAt(event.clientX, event.clientY);
        if (hit && onLock(hit, gesture.lock)) hooks.apply(hit);
        return;
      }
      if (!gesture.moved) return;
      gesture.kind = 'orbit'; // 쌓기 · 색 뽑기는 끌면 둘러보기로
    }
    cam.rotate(event.clientX - gesture.x, event.clientY - gesture.y);
    gesture.x = event.clientX;
    gesture.y = event.clientY;
    render();
  }

  function onUp(event) {
    if (!pointers.has(event.pointerId)) return;
    pointers.delete(event.pointerId);
    if (surface.hasPointerCapture?.(event.pointerId)) surface.releasePointerCapture(event.pointerId);
    const g = gesture;
    if (!g) return;
    if (g.kind === 'pinch') {
      if (pointers.size === 0) gesture = null;
      return;
    }
    if (event.pointerId !== g.id) return;
    gesture = null;
    if (event.type === 'pointercancel') {
      if (g.kind === 'tool' && g.stroke) hooks.cancel();
      return;
    }
    if (g.kind === 'tool') {
      if (!g.stroke) {
        hooks.start();
        hooks.apply(g.hit);
      }
      hooks.end();
      if (event.pointerType === 'mouse') showGhost(hitAt(event.clientX, event.clientY));
    } else if (g.background && !g.moved) {
      const now = performance.now();
      if (now - lastTap.time < DOUBLE_TAP_MS && Math.hypot(event.clientX - lastTap.x, event.clientY - lastTap.y) < 30) {
        cam.reset();
        render();
        lastTap.time = 0;
      } else lastTap = { time: now, x: event.clientX, y: event.clientY };
    }
  }

  function onWheel(event) {
    event.preventDefault();
    cam.zoom(event.deltaY < 0 ? WHEEL_STEP : 1 / WHEEL_STEP);
    render();
  }
  const onLeave = () => !gesture && showGhost(null);
  const onContext = (event) => event.preventDefault();
  const listeners = [['pointerdown', onDown], ['pointermove', onMove], ['pointerup', onUp], ['pointercancel', onUp], ['pointerleave', onLeave], ['contextmenu', onContext]];
  for (const [name, fn] of listeners) surface.addEventListener(name, fn);
  surface.addEventListener('wheel', onWheel, { passive: false });

  hostEl.querySelector('.vs-view-tools').addEventListener('click', (event) => {
    const act = event.target.closest('[data-view]')?.dataset.view;
    if (act === 'in') cam.zoom(1.25);
    else if (act === 'out') cam.zoom(1 / 1.25);
    else if (act === 'turn') cam.turn(-Math.PI / 4);
    else if (act === 'reset') cam.reset();
    render();
  });

  return {
    show() {
      open = true;
      claimRenderer(surface);
      resize();
      render();
    },
    hide() {
      open = false;
      pointers.clear();
      gesture = null;
      world.setGhost(null);
    },
    setLayer(z) {
      world.setLayer(z);
      render();
    },
    setMirror(on) {
      world.setMirror(on);
      render();
    },
    render,
    resetCamera() {
      cam.reset();
      render();
    },
    dispose() {
      open = false;
      cancelAnimationFrame(frame);
      observer?.disconnect();
      stopGrid();
      for (const [name, fn] of listeners) surface.removeEventListener(name, fn);
      surface.removeEventListener('wheel', onWheel);
      world.dispose();
      releaseRenderer(surface);
      hostEl.innerHTML = '';
    },
  };
}
