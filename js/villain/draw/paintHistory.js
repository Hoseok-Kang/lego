// ─────────────────────────────────────────────────────────────
// 악당 타이쿤 그림판: 되돌리기 · 다시하기 기록
// 그림 한 장(색 + 두께)을 통째로 기억해 두었다가 꺼내 줍니다. 그림판(paintBoard.js)과 3D 작업대가 같이 씁니다.
//
// 쓰는 법
//   const history = createHistory(100)       기억할 수 있는 횟수
//   history.push(before)                      바꾸기 바로 전 모습을 넣음 (다시하기 기록은 지워짐)
//   history.back(now) → 전 모습 | null         되돌리기 (지금 모습은 다시하기 쪽으로)
//   history.forward(now) → 다음 모습 | null    다시하기
//   history.reset() / history.canUndo / history.canRedo
// ─────────────────────────────────────────────────────────────

export function createHistory(limit = 100) {
  let undo = [];
  let redo = [];
  return {
    push(before) {
      undo.push(before);
      if (undo.length > limit) undo.shift();
      redo = [];
    },
    back(now) {
      if (!undo.length) return null;
      redo.push(now);
      return undo.pop();
    },
    forward(now) {
      if (!redo.length) return null;
      undo.push(now);
      return redo.pop();
    },
    reset() {
      undo = [];
      redo = [];
    },
    get canUndo() {
      return undo.length > 0;
    },
    get canRedo() {
      return redo.length > 0;
    },
  };
}
