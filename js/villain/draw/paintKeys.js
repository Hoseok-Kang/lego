// ─────────────────────────────────────────────────────────────
// 악당 타이쿤 그림판: 키보드 단축키 (컴퓨터용)
//   B 연필 · E 지우개 · G 페인트통 · I 색 뽑기 · L 선 · R 네모 · M 옮기기
//   Ctrl+Z 되돌리기 · Ctrl+Shift+Z / Ctrl+Y 다시하기 · 숫자 1~9, 0 색 고르기
// 이름 칸에 글자를 치는 중이거나 그림판이 안 보일 때는 듣지 않습니다.
// 키를 바꾸려면 아래 KEY_TOOLS 를 고치면 됩니다.
//
// 쓰는 법: const detach = attachPaintKeys(rootEl, { undo, redo, tool(name), colorIndex(n) });  detach() 로 그만 듣기
// ─────────────────────────────────────────────────────────────

const KEY_TOOLS = { b: 'pencil', e: 'eraser', g: 'fill', i: 'picker', l: 'line', r: 'rect', m: 'move', v: 'move' };

export function attachPaintKeys(rootEl, { undo, redo, tool, colorIndex }) {
  function onKeyDown(event) {
    if (rootEl.offsetParent === null || event.altKey) return;
    const target = event.target;
    if (target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
    if (document.querySelector('.pb-confirm')) return;
    const key = event.key.toLowerCase();
    if (event.ctrlKey || event.metaKey) {
      if (key === 'z') {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
      } else if (key === 'y') {
        event.preventDefault();
        redo();
      }
      return;
    }
    if (KEY_TOOLS[key]) tool(KEY_TOOLS[key]);
    else if (/^[0-9]$/.test(key)) colorIndex(key === '0' ? 9 : Number(key) - 1);
  }
  globalThis.addEventListener('keydown', onKeyDown);
  return () => globalThis.removeEventListener('keydown', onKeyDown);
}
