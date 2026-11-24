// ─────────────────────────────────────────────────────────────
// 악당 타이쿤 3D 작업대: 한 장씩 보기 (손가락으로 정확하게 칠하는 2D 판)
// 블록 공간을 앞에서부터 한 장씩 잘라 그림판처럼 보여 줍니다. 그림판처럼 문질러 쌓고 · 지우고 · 칠할 수 있어요.
// 아래 막대(또는 ‹ › 단추)로 앞 장 · 뒤 장을 고르면 3D 화면에도 그 장이 주황 틀로 표시됩니다.
// 다른 장에 있는 블록은 흐린 점으로 보여서 괴수 모양을 놓치지 않아요.
//
// 쓰는 법
//   const slice = createSculptSlice(rootEl, { grid, colorOf(ch) → hex, hooks, onLayer(z) })
//     hooks: { tool(), start(), apply({ slice: { x, y, z } }) → 바뀌었는지, end(), cancel() }  (3D 화면과 같은 도구)
//   slice.setLayer(z) / slice.setMirror(on) / slice.layer / slice.render() / slice.refresh() (크기 다시 맞추기) / slice.destroy()
//
// 글자는 아래 TEXT, 칸 그리기는 draw/paintCanvas.js 를 같이 씁니다.
// ─────────────────────────────────────────────────────────────

import { createPaintCanvas } from '../draw/paintCanvas.js';
import { icon } from '../draw/paintIcons.js';
import { linePoints } from '../draw/paintOps.js';

const TEXT = {
  title: '한 장씩',
  front: '앞',
  back: '뒤',
  layer: (n, d) => `앞에서 ${n}째 장 / ${d}`,
  prev: '앞 장',
  next: '뒤 장',
};
const GHOST_ALPHA = 0.42; // 다른 장 블록 점의 진하기

export function createSculptSlice(rootEl, { grid, colorOf, hooks, onLayer }) {
  const { w, h, d } = grid;
  let layer = Math.floor((d - 1) / 2);
  let frameId = 0;
  let stroke = null;
  let hover = null;
  let mirror = false;
  rootEl.classList.add('vs-slice');
  rootEl.innerHTML = `
    <div class="vs-slice-head"><b>${TEXT.title}</b><span class="vs-slice-name"></span></div>
    <div class="vs-slice-stage"></div>
    <div class="vs-slice-bar">
      <button type="button" class="vs-round" data-step="-1" title="${TEXT.prev}" aria-label="${TEXT.prev}">${icon('back')}</button>
      <small>${TEXT.front}</small>
      <input type="range" min="1" max="${d}" step="1" aria-label="${TEXT.title}">
      <small>${TEXT.back}</small>
      <button type="button" class="vs-round" data-step="1" title="${TEXT.next}" aria-label="${TEXT.next}">${icon('next')}</button>
    </div>`;
  const stage = rootEl.querySelector('.vs-slice-stage');
  const range = rootEl.querySelector('input[type="range"]');
  const nameEl = rootEl.querySelector('.vs-slice-name');
  const paper = createPaintCanvas(stage, { cols: w, rows: h, colorOf, maxCell: 34 });
  const canvas = paper.canvas;
  canvas.setAttribute('aria-label', TEXT.title);

  // 다른 장 블록: 가장 가까운 장의 색을 작은 점으로
  function overlay(ctx, size) {
    const dot = Math.max(2, Math.round(size * 0.34));
    ctx.save();
    ctx.globalAlpha = GHOST_ALPHA;
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        if (grid.has(x, y, layer)) continue;
        let ch = null;
        for (let step = 1; step < d && !ch; step += 1) ch = grid.get(x, y, layer - step) ?? grid.get(x, y, layer + step);
        if (!ch) continue;
        ctx.fillStyle = colorOf(ch);
        ctx.fillRect(x * size + (size - dot) / 2, y * size + (size - dot) / 2, dot, dot);
      }
    }
    ctx.restore();
  }

  function render() {
    frameId = 0;
    const cells = new Array(w * h);
    for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) cells[y * w + x] = grid.get(x, y, layer) ?? '.';
    paper.draw(cells, { hover: stroke ? null : hover, overlay, mirror });
  }
  const requestRender = () => {
    if (!frameId) frameId = requestAnimationFrame(render);
  };
  const stopGrid = grid.onChange(requestRender);

  function setLayer(z) {
    layer = Math.max(0, Math.min(d - 1, Math.round(z)));
    range.value = String(layer + 1);
    nameEl.textContent = TEXT.layer(layer + 1, d);
    onLayer?.(layer);
    requestRender();
  }

  // ── 문지르기 ──
  function applyAt(cell) {
    if (cell.inside) hooks.apply({ slice: { x: cell.x, y: cell.y, z: layer } });
  }
  function onDown(event) {
    if (stroke || (event.pointerType === 'mouse' && event.button !== 0)) return;
    event.preventDefault();
    const cell = paper.cellAt(event.clientX, event.clientY);
    if (!cell.inside) return;
    canvas.setPointerCapture?.(event.pointerId);
    stroke = { id: event.pointerId, last: cell };
    hooks.start();
    applyAt(cell);
    requestRender();
  }
  function onMove(event) {
    if (!stroke) {
      if (event.pointerType !== 'mouse') return;
      const cell = paper.cellAt(event.clientX, event.clientY);
      hover = cell.inside ? cell : null;
      requestRender();
      return;
    }
    if (event.pointerId !== stroke.id) return;
    event.preventDefault();
    const cell = paper.cellAt(event.clientX, event.clientY);
    if (hooks.tool() !== 'pick') for (const [x, y] of linePoints(stroke.last.x, stroke.last.y, cell.x, cell.y)) applyAt({ x, y, inside: x >= 0 && y >= 0 && x < w && y < h });
    stroke.last = cell;
  }
  function onUp(event) {
    if (!stroke || event.pointerId !== stroke.id) return;
    stroke = null;
    if (event.type === 'pointercancel') hooks.cancel();
    else hooks.end();
    requestRender();
  }
  const onLeave = () => {
    hover = null;
    requestRender();
  };
  const onTouchMove = (event) => event.preventDefault();
  const listeners = [['pointerdown', onDown], ['pointermove', onMove], ['pointerup', onUp], ['pointercancel', onUp], ['pointerleave', onLeave]];
  for (const [name, fn] of listeners) canvas.addEventListener(name, fn);
  canvas.addEventListener('touchmove', onTouchMove, { passive: false });
  range.addEventListener('input', () => setLayer(Number(range.value) - 1));
  rootEl.querySelector('.vs-slice-bar').addEventListener('click', (event) => {
    const step = Number(event.target.closest('[data-step]')?.dataset.step);
    if (step) setLayer(layer + step);
  });

  setLayer(layer);

  return {
    setLayer,
    setMirror(on) {
      mirror = !!on;
      requestRender();
    },
    render: requestRender,
    refresh() {
      paper.layout();
      requestRender();
    },
    get layer() {
      return layer;
    },
    destroy() {
      cancelAnimationFrame(frameId);
      stopGrid();
      for (const [name, fn] of listeners) canvas.removeEventListener(name, fn);
      canvas.removeEventListener('touchmove', onTouchMove);
      paper.destroy();
      rootEl.innerHTML = '';
    },
  };
}
