// ─────────────────────────────────────────────────────────────
// 악당 타이쿤: 괴수 도트 그림 작은 그림 만들기
// 저장된 괴수 그림(MonsterDesign)을 작은 캔버스에 또렷하게 그립니다. (도감 카드, 미리보기용)
//
// 쓰는 법
//   drawDesign(canvas, design, { parts: true, padding: 1 })   캔버스에 꽉 차게 그림 (투명 바탕)
//   designThumbURL(design, px = 128, options)                 <img src> 에 넣을 수 있는 그림 주소
// ─────────────────────────────────────────────────────────────

import { VILLAIN } from '../villainConfig.js';
import { drawPartIcon } from './partIcons.js';

function hexMap() {
  return new Map(VILLAIN.draw.palette.map((c) => [c.ch, c.hex]));
}

export function drawDesign(canvas, design, { parts = true, padding = 1 } = {}) {
  const ctx = canvas.getContext('2d');
  const cols = design.cols ?? VILLAIN.draw.cols;
  const rows = design.rows ?? VILLAIN.draw.rows;
  const colors = hexMap();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const unit = Math.max(1, Math.floor(Math.min(canvas.width / (cols + padding * 2), canvas.height / (rows + padding * 2))));
  const left = Math.floor((canvas.width - unit * cols) / 2);
  const top = Math.floor((canvas.height - unit * rows) / 2);
  for (let row = 0; row < rows; row += 1) {
    const line = design.cells?.[row] ?? '';
    for (let col = 0; col < cols; col += 1) {
      const hex = colors.get(line[col]);
      if (!hex) continue;
      const x = left + col * unit;
      const y = top + row * unit;
      ctx.fillStyle = hex;
      ctx.fillRect(x, y, unit, unit);
    }
  }
  if (parts) {
    const size = unit * 3.4;
    for (const part of design.parts ?? []) {
      drawPartIcon(ctx, part.type, left + (part.col + 0.5) * unit - size / 2, top + (part.row + 0.5) * unit - size / 2, size);
    }
  }
  return { unit, left, top };
}

export function designThumbURL(design, px = 128, options) {
  const canvas = document.createElement('canvas');
  canvas.width = px;
  canvas.height = px;
  drawDesign(canvas, design, options);
  return canvas.toDataURL('image/png');
}
