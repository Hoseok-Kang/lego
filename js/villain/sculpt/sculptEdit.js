// ─────────────────────────────────────────────────────────────
// 악당 타이쿤 3D 작업대: 도구 쓰기 (쌓기 · 지우기 · 칠하기 · 색 뽑기 + 좌우 대칭)
// 3D 화면(sculptView.js)과 한 장씩 판(sculptSlice.js)이 "여기를 눌렀어요" 하면 블록 공간(sculptGrid.js)을 바꿉니다.
//   누른 자리 hit: { cell, normal } 블록의 한 면 · { floor } 바닥 칸 · { slice } 한 장씩 판의 칸
//   쌓기: 블록 면을 누르면 그 면 바깥 칸에, 바닥이나 판을 누르면 그 칸에 새 블록
//   좌우 대칭이 켜져 있으면 왼쪽 · 오른쪽 거울 자리도 똑같이
//
// 쓰는 법
//   const edit = createSculptEdit({ grid, colorOf, onPick(ch), onFull(), onDone(kind, cell) })
//   edit.hooks      { tool, start, apply, end, cancel, ghost }  (3D 화면 · 판에 그대로 넘김)
//   edit.tool / edit.color / edit.mirror  지금 값 ;  edit.setTool(name) / setColor(ch) / setMirror(on)
// ─────────────────────────────────────────────────────────────

export function createSculptEdit({ grid, colorOf, onPick = () => {}, onFull = () => {}, onDone = () => {} }) {
  let tool = 'add';
  let color = 'B';
  let mirror = true;
  let lastKind = null;
  let lastCell = null;
  let warnedFull = false;

  const mirrorOf = (c) => ({ x: grid.w - 1 - c.x, y: c.y, z: c.z });
  function put(c, ch) {
    let changed = grid.set(c.x, c.y, c.z, ch);
    if (mirror) changed = grid.set(grid.w - 1 - c.x, c.y, c.z, ch) || changed;
    if (ch && !changed && grid.full && !grid.has(c.x, c.y, c.z) && !warnedFull) {
      warnedFull = true;
      onFull();
    }
    return changed;
  }
  function recolor(c) {
    let changed = grid.has(c.x, c.y, c.z) && grid.set(c.x, c.y, c.z, color);
    const m = mirrorOf(c);
    if (mirror && grid.has(m.x, m.y, m.z)) changed = grid.set(m.x, m.y, m.z, color) || changed;
    return changed;
  }
  function pick(c) {
    const ch = grid.get(c.x, c.y, c.z);
    if (ch) onPick(ch);
    return false;
  }

  // 누른 자리 → 바꿀 칸
  function targetOf(hit) {
    if (hit.slice) return hit.slice;
    if (hit.floor) return tool === 'add' ? hit.floor : null;
    if (!hit.cell) return null;
    if (tool !== 'add') return hit.cell;
    const [dx, dy, dz] = hit.normal;
    const next = { x: hit.cell.x + dx, y: hit.cell.y + dy, z: hit.cell.z + dz };
    return grid.inside(next.x, next.y, next.z) ? next : null;
  }

  function apply(hit) {
    const c = targetOf(hit);
    if (!c) return false;
    lastKind = hit.slice ? 'slice' : 'view';
    lastCell = c;
    if (tool === 'add') return put(c, color);
    if (tool === 'erase') return put(c, null);
    if (tool === 'paint') return recolor(c);
    return pick(c);
  }

  function ghost(hit) {
    const c = targetOf(hit);
    if (!c) return null;
    if (tool === 'add') return grid.has(c.x, c.y, c.z) ? null : { cell: c, kind: 'add', hex: colorOf(color) };
    return { cell: c, kind: tool === 'erase' ? 'erase' : 'paint', hex: colorOf(color) };
  }

  const hooks = {
    tool: () => tool,
    start() {
      warnedFull = false;
      grid.begin();
    },
    apply,
    end() {
      const changed = grid.end();
      if (changed || tool === 'pick') onDone(lastKind, lastCell, tool);
    },
    cancel: () => grid.cancel(),
    ghost,
  };

  return {
    hooks,
    get tool() {
      return tool;
    },
    get color() {
      return color;
    },
    get mirror() {
      return mirror;
    },
    setTool(name) {
      if (['add', 'erase', 'paint', 'pick'].includes(name)) tool = name;
    },
    setColor(ch) {
      color = ch;
    },
    setMirror(on) {
      mirror = !!on;
    },
  };
}
