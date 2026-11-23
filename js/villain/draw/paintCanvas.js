// ─────────────────────────────────────────────────────────────
// 악당 타이쿤 그림판: 도화지 (칸 그림을 화면에 그리는 부분)
// 칸 하나하나를 또렷한 네모로 그리고, 빈 칸은 바둑판 무늬, 칸 사이에는 눈금 줄을 긋습니다.
// 화면 크기에 맞춰 '칸 하나의 크기'를 정수로 맞추기 때문에 그림이 흐려지지 않습니다.
// 그림판(paintBoard.js)과 부품 붙이기(partPlacer.js)가 같이 씁니다.
//
// 쓰는 법
//   const paper = createPaintCanvas(stageEl, { cols, rows, colorOf })   // colorOf(기호) → '#RRGGBB'
//   paper.draw(grid, { mirror, hover:{x,y}, dimEmpty, flash:[{cells:[칸 번호], alpha}] })
//   paper.cellAt(clientX, clientY) → { x, y, inside }   화면 좌표 → 칸
//   paper.cellBox(x, y) → { left, top, size }           칸의 자리 (frame 기준 CSS 픽셀)
//   paper.onLayout(fn)  크기가 바뀌면 호출 / paper.layout() 지금 다시 맞추기 / paper.destroy()
//   paper.frame, paper.canvas, paper.cellSize
//
// 색(바둑판, 눈금 줄)은 css/villain-draw.css 의 --pb-check-a, --pb-check-b, --pb-grid, --pb-grid-strong, --pb-guide 에서 바꿉니다.
// ─────────────────────────────────────────────────────────────

import { EMPTY } from './paintOps.js';

const MIN_CELL = 8;

export function createPaintCanvas(stageEl, { cols, rows, colorOf, maxCell = 46 }) {
  const frame = document.createElement('div');
  frame.className = 'pb-frame';
  const canvas = document.createElement('canvas');
  canvas.className = 'pb-canvas';
  canvas.setAttribute('role', 'img');
  frame.append(canvas);
  stageEl.append(frame);

  const ctx = canvas.getContext('2d');
  const layoutListeners = new Set();
  let cellDev = 0; // 칸 하나의 실제 픽셀 수 (정수)
  let cellCss = 0;
  let theme = null;
  let lastDraw = null;

  function readTheme() {
    const style = getComputedStyle(canvas);
    const pick = (name, fallback) => style.getPropertyValue(name).trim() || fallback;
    theme = {
      checkA: pick('--pb-check-a', '#ffffff'),
      checkB: pick('--pb-check-b', '#ece8f4'),
      grid: pick('--pb-grid', 'rgba(40,20,80,0.16)'),
      gridStrong: pick('--pb-grid-strong', 'rgba(40,20,80,0.34)'),
      guide: pick('--pb-guide', '#7a3fe0'),
    };
  }

  // 무대(stageEl) 안에 들어가는 가장 큰 정수 칸 크기를 찾습니다
  function layout() {
    const style = getComputedStyle(frame);
    const padX = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight) + parseFloat(style.borderLeftWidth) + parseFloat(style.borderRightWidth);
    const padY = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom) + parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth);
    const stage = getComputedStyle(stageEl);
    const availW = stageEl.clientWidth - parseFloat(stage.paddingLeft) - parseFloat(stage.paddingRight) - padX;
    let availH = stageEl.clientHeight - parseFloat(stage.paddingTop) - parseFloat(stage.paddingBottom) - padY;
    if (availH < MIN_CELL * rows) availH = availW; // 높이가 정해지지 않은 곳에서는 너비만 봄
    if (availW <= 0) return;
    const dpr = Math.max(1, globalThis.devicePixelRatio || 1);
    const css = Math.max(MIN_CELL, Math.min(maxCell, Math.floor(Math.min(availW / cols, availH / rows))));
    const dev = Math.max(1, Math.round(css * dpr));
    readTheme();
    if (dev !== cellDev || canvas.width !== dev * cols) {
      cellDev = dev;
      cellCss = dev / dpr;
      canvas.width = dev * cols;
      canvas.height = dev * rows;
      canvas.style.width = `${cellCss * cols}px`;
      canvas.style.height = `${cellCss * rows}px`;
    }
    if (lastDraw) draw(lastDraw.grid, lastDraw.options);
    for (const fn of layoutListeners) fn(cellCss);
  }

  function drawCell(x, y, ch, dimEmpty) {
    const d = cellDev;
    const px = x * d;
    const py = y * d;
    if (ch === EMPTY) {
      const half = Math.round(d / 2);
      ctx.fillStyle = theme.checkA;
      ctx.fillRect(px, py, d, d);
      ctx.fillStyle = theme.checkB;
      ctx.fillRect(px + half, py, d - half, half);
      ctx.fillRect(px, py + half, half, d - half);
      if (dimEmpty) {
        ctx.fillStyle = theme.dim ?? 'rgba(120,110,140,0.18)';
        ctx.fillRect(px, py, d, d);
      }
      return;
    }
    ctx.fillStyle = colorOf(ch) ?? '#ff00ff';
    ctx.fillRect(px, py, d, d);
    // 장난감 블록처럼 위는 살짝 밝게, 아래는 살짝 어둡게
    const edge = Math.max(1, Math.round(d * 0.09));
    ctx.fillStyle = 'rgba(255,255,255,0.26)';
    ctx.fillRect(px, py, d, edge);
    ctx.fillRect(px, py, edge, d);
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(px, py + d - edge, d, edge);
    ctx.fillRect(px + d - edge, py, edge, d);
  }

  function drawGridLines() {
    const d = cellDev;
    const line = Math.max(1, Math.round((globalThis.devicePixelRatio || 1) * 0.75));
    for (let i = 1; i < cols; i += 1) {
      ctx.fillStyle = i % 4 === 0 ? theme.gridStrong : theme.grid;
      ctx.fillRect(i * d - Math.floor(line / 2), 0, line, canvas.height);
    }
    for (let i = 1; i < rows; i += 1) {
      ctx.fillStyle = i % 4 === 0 ? theme.gridStrong : theme.grid;
      ctx.fillRect(0, i * d - Math.floor(line / 2), canvas.width, line);
    }
  }

  function drawGuide() {
    const d = cellDev;
    const width = Math.max(2, Math.round(d * 0.1));
    const x = Math.round((cols / 2) * d - width / 2);
    const dash = Math.max(4, Math.round(d * 0.5));
    ctx.fillStyle = theme.guide;
    for (let y = Math.round(dash / 4); y < canvas.height; y += dash * 1.5) ctx.fillRect(x, Math.round(y), width, dash);
  }

  function drawHover(hover) {
    const d = cellDev;
    const w = Math.max(2, Math.round(d * 0.08));
    ctx.lineWidth = w;
    ctx.strokeStyle = 'rgba(0,0,0,0.75)';
    ctx.strokeRect(hover.x * d + w / 2, hover.y * d + w / 2, d - w, d - w);
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.strokeRect(hover.x * d + w * 1.5, hover.y * d + w * 1.5, d - w * 3, d - w * 3);
  }

  function draw(grid, options = {}) {
    lastDraw = { grid, options };
    if (!cellDev) return;
    if (!theme) readTheme();
    for (let y = 0; y < rows; y += 1) {
      for (let x = 0; x < cols; x += 1) drawCell(x, y, grid[y * cols + x], options.dimEmpty);
    }
    for (const flash of options.flash ?? []) {
      ctx.fillStyle = `rgba(255,255,255,${Math.max(0, Math.min(1, flash.alpha))})`;
      for (const index of flash.cells) ctx.fillRect((index % cols) * cellDev, Math.floor(index / cols) * cellDev, cellDev, cellDev);
    }
    drawGridLines();
    if (options.mirror) drawGuide();
    if (options.hover) drawHover(options.hover);
  }

  function cellAt(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor(((clientX - rect.left) / rect.width) * cols);
    const y = Math.floor(((clientY - rect.top) / rect.height) * rows);
    return { x, y, inside: x >= 0 && y >= 0 && x < cols && y < rows };
  }

  function cellBox(x, y) {
    return { left: canvas.offsetLeft + x * cellCss, top: canvas.offsetTop + y * cellCss, size: cellCss };
  }

  const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(() => layout()) : null;
  observer?.observe(stageEl);
  const onWindowResize = () => layout();
  globalThis.addEventListener?.('resize', onWindowResize);
  const media = globalThis.matchMedia?.('(prefers-color-scheme: dark)');
  const onTheme = () => {
    readTheme();
    if (lastDraw) draw(lastDraw.grid, lastDraw.options);
  };
  media?.addEventListener?.('change', onTheme);
  layout();

  return {
    frame,
    canvas,
    draw,
    layout,
    cellAt,
    cellBox,
    refreshTheme: onTheme,
    get cellSize() {
      return cellCss;
    },
    onLayout(fn) {
      layoutListeners.add(fn);
      return () => layoutListeners.delete(fn);
    },
    destroy() {
      observer?.disconnect();
      globalThis.removeEventListener?.('resize', onWindowResize);
      media?.removeEventListener?.('change', onTheme);
      layoutListeners.clear();
      frame.remove();
    },
  };
}
