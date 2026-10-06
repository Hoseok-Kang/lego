// 글자 지도로 픽셀 그림 그리기
// 글자 하나가 블록 한 칸입니다. 글자를 바꾸면 그림이 바뀝니다.
//
//   drawPixelMap([
//     '..GG..',
//     '.GGGG.',
//   ], { G: '#4B9F4A' })
//
// '.' 과 ' ' 는 빈칸(투명)입니다. 색은 js/bricks/brickColors.js 에 있는 블록 색을 쓰면 정확히 그 색 블록이 됩니다.

export function drawPixelMap(rows, legend, cellSize = 10) {
  const width = Math.max(...rows.map((row) => row.length));
  const canvas = document.createElement('canvas');
  canvas.width = width * cellSize;
  canvas.height = rows.length * cellSize;
  const ctx = canvas.getContext('2d');
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const char = row[x];
      if (char === '.' || char === ' ') continue;
      const color = legend[char];
      if (!color) throw new Error(`픽셀 지도에 없는 글자 '${char}' (${y + 1}번째 줄)`);
      ctx.fillStyle = color;
      ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
    }
  });
  return canvas;
}
