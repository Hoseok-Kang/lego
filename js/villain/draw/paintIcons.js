// ─────────────────────────────────────────────────────────────
// 악당 타이쿤 그림판: 도구 단추 그림
// 단추마다 들어가는 작은 선 그림(SVG)입니다. 색은 단추 글자색을 그대로 따라갑니다.
//
// 쓰는 법: icon('pencil') → SVG 글자. 이름: pencil eraser fill picker line rect rectFilled move
//          mirror undo redo flip trash check back next coin thick addBlock cube heart speed lock
// ─────────────────────────────────────────────────────────────

const PATHS = {
  pencil: '<path d="M4 20l1.2-4.6L16.4 4.2a2 2 0 0 1 2.8 0l.6.6a2 2 0 0 1 0 2.8L8.6 18.8z"/><path d="M14 6.6l3.4 3.4"/><path d="M4 20l4.6-1.2" />',
  eraser: '<path d="M8.5 19.5L3.8 14.8a1.6 1.6 0 0 1 0-2.3l8.3-8.3a1.6 1.6 0 0 1 2.3 0l5.8 5.8a1.6 1.6 0 0 1 0 2.3l-7.2 7.2z"/><path d="M8.2 8.4l7.4 7.4"/><path d="M8.5 19.5H21"/>',
  fill: '<path d="M10.5 3.5l8 8-6.6 6.6a2 2 0 0 1-2.8 0L4.4 13.4a2 2 0 0 1 0-2.8z"/><path d="M4.2 12h13.6"/><path d="M8 6l2.5-2.5"/><path d="M20 15.2s-1.8 2.3-1.8 3.5a1.8 1.8 0 0 0 3.6 0c0-1.2-1.8-3.5-1.8-3.5z" fill="currentColor"/>',
  picker: '<path d="M14.2 5.8l4 4"/><path d="M12.5 7.5l4 4-7.6 7.6-3.9.9-.9.9-.9-.9.9-.9.9-3.9z"/><path d="M15.4 4.6a2.5 2.5 0 0 1 3.6 0l.4.4a2.5 2.5 0 0 1 0 3.6l-1.9 1.9-4-4z" fill="currentColor"/>',
  line: '<path d="M6 18L18 6"/><rect x="3" y="15.5" width="5" height="5" rx="1" fill="currentColor"/><rect x="16" y="3.5" width="5" height="5" rx="1" fill="currentColor"/>',
  rect: '<rect x="4" y="5" width="16" height="14" rx="1.5"/>',
  rectFilled: '<rect x="4" y="5" width="16" height="14" rx="1.5" fill="currentColor"/>',
  move: '<path d="M12 3v18M3 12h18"/><path d="M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3"/>',
  mirror: '<path d="M12 3v2.5M12 8v2.5M12 13.5V16M12 18.5V21"/><path d="M8.5 7.5v9L3.5 12z" fill="currentColor"/><path d="M15.500 7.5v9l5-4.500z"/>',
  undo: '<path d="M8.500 5L4 9.500l4.500 4.500"/><path d="M4 9.500h9.500a6 6 0 0 1 0 12H9"/>',
  redo: '<path d="M15.500 5L20 9.500 15.500 14"/><path d="M20 9.500h-9.500a6 6 0 0 0 0 12H15"/>',
  flip: '<path d="M7 4L3 8l4 4"/><path d="M3 8h14"/><path d="M17 12l4 4-4 4"/><path d="M21 16H7"/>',
  trash: '<path d="M4 7h16"/><path d="M9.500 7V4.500h5V7"/><path d="M6 7l1 12.500a1.500 1.500 0 0 0 1.500 1.500h7a1.500 1.500 0 0 0 1.500-1.500L18 7"/><path d="M10 11v6M14 11v6"/>',
  check: '<path d="M4.500 12.500l5 5L19.500 7"/>',
  back: '<path d="M14.500 5.500L8 12l6.500 6.500"/>',
  next: '<path d="M9.500 5.500L16 12l-6.500 6.500"/>',
  thick: '<path d="M4 8.5l8-4 8 4-8 4z"/><path d="M4 12.5l8 4 8-4"/><path d="M4 16.5l8 4 8-4"/>',
  addBlock: '<path d="M10 4l6.500 3.600v7.200L10 18.400l-6.500-3.600V7.600z"/><path d="M3.500 7.600L10 11.200l6.500-3.600M10 11.200v7.200"/><path d="M19.500 13.500v7M16 17h7"/>',
  cube: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M4 7.5l8 4.5 8-4.5M12 12v9"/>',
  heart: '<path d="M12 20s-7.500-4.600-7.500-10A4.300 4.300 0 0 1 12 7.200 4.300 4.300 0 0 1 19.500 10c0 5.400-7.500 10-7.500 10z" fill="#E4405F" stroke="#9E1B32"/>',
  speed: '<path d="M4 15a8 8 0 0 1 16 0"/><path d="M12 15l4-5"/><path d="M3 19h18"/>',
  lock: '<rect x="5" y="10.500" width="14" height="10" rx="2"/><path d="M8 10.500V8a4 4 0 0 1 8 0v2.500"/>',
  coin: '<circle cx="12" cy="12" r="8.500" fill="#F2CD37" stroke="#A95500"/><path d="M12 8v8M9.800 10h4.400M9.800 14h4.400" stroke="#A95500"/>',
};

export function icon(name) {
  const body = PATHS[name] ?? '';
  return `<svg class="pb-icon" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.200" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}
