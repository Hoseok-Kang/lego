// 예시 그림: 당근을 든 토끼
// 사진을 올리기 전에 보여 줄 그림을 캔버스에 직접 그립니다.
// 이 그림도 사진과 똑같은 과정을 거쳐 블록으로 바뀝니다.
// (색은 brickColors.js에 있는 블록 색과 똑같이 맞춰 두었습니다)

const WIDTH = 400;
const HEIGHT = 500;
const OUTLINE_WIDTH = 18;

const COLORS = {
  fur: '#F4F4F4', // 흰색
  outline: '#1B2A34', // 검정
  innerEar: '#E4ADC8', // 분홍
  cheek: '#E4ADC8', // 분홍
  nose: '#C870A0', // 진분홍
  eye: '#1B2A34', // 검정
  shine: '#F4F4F4', // 흰색
  carrot: '#FE8A18', // 주황
  carrotLine: '#A95500', // 진한 주황
  leaf: '#4B9F4A', // 초록
};

export function drawSampleRabbit() {
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d');
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // 귀 (머리 뒤에 있으니 먼저 그림)
  outlined(ctx, () => ellipse(ctx, 156, 104, 30, 84, -0.2), COLORS.fur);
  outlined(ctx, () => ellipse(ctx, 244, 104, 30, 84, 0.2), COLORS.fur);
  filled(ctx, () => ellipse(ctx, 157, 112, 13, 58, -0.2), COLORS.innerEar);
  filled(ctx, () => ellipse(ctx, 243, 112, 13, 58, 0.2), COLORS.innerEar);

  // 몸통과 발
  outlined(ctx, () => ellipse(ctx, 200, 378, 112, 98), COLORS.fur);
  outlined(ctx, () => ellipse(ctx, 138, 464, 50, 22), COLORS.fur);
  outlined(ctx, () => ellipse(ctx, 262, 464, 50, 22), COLORS.fur);

  // 머리
  outlined(ctx, () => ellipse(ctx, 200, 218, 110, 94), COLORS.fur);

  // 얼굴
  filled(ctx, () => ellipse(ctx, 160, 210, 17, 21), COLORS.eye);
  filled(ctx, () => ellipse(ctx, 240, 210, 17, 21), COLORS.eye);
  filled(ctx, () => ellipse(ctx, 154, 201, 7, 7), COLORS.shine);
  filled(ctx, () => ellipse(ctx, 234, 201, 7, 7), COLORS.shine);
  filled(ctx, () => ellipse(ctx, 124, 254, 19, 13), COLORS.cheek);
  filled(ctx, () => ellipse(ctx, 276, 254, 19, 13), COLORS.cheek);
  filled(ctx, () => ellipse(ctx, 200, 246, 13, 10), COLORS.nose);

  // 당근 잎 → 당근 → 당근을 잡은 앞발
  outlined(ctx, () => ellipse(ctx, 182, 306, 11, 26, -0.45), COLORS.leaf, 12);
  outlined(ctx, () => ellipse(ctx, 218, 306, 11, 26, 0.45), COLORS.leaf, 12);
  outlined(ctx, () => ellipse(ctx, 200, 298, 11, 28), COLORS.leaf, 12);
  outlined(
    ctx,
    () => {
      ctx.moveTo(160, 330);
      ctx.quadraticCurveTo(200, 312, 240, 330);
      ctx.lineTo(204, 446);
      ctx.quadraticCurveTo(200, 452, 196, 446);
      ctx.closePath();
    },
    COLORS.carrot,
    14,
  );
  ctx.strokeStyle = COLORS.carrotLine;
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.moveTo(186, 372);
  ctx.lineTo(210, 368);
  ctx.moveTo(192, 408);
  ctx.lineTo(209, 405);
  ctx.stroke();
  outlined(ctx, () => ellipse(ctx, 158, 352, 28, 22), COLORS.fur);
  outlined(ctx, () => ellipse(ctx, 242, 352, 28, 22), COLORS.fur);

  return canvas;
}

function ellipse(ctx, x, y, rx, ry, rotation = 0) {
  ctx.ellipse(x, y, rx, ry, rotation, 0, Math.PI * 2);
}

// 테두리를 먼저 굵게 그리고 그 위를 색으로 채워서 바깥쪽 테두리만 남김
function outlined(ctx, path, fill, lineWidth = OUTLINE_WIDTH) {
  ctx.beginPath();
  path();
  ctx.lineWidth = lineWidth;
  ctx.strokeStyle = COLORS.outline;
  ctx.stroke();
  ctx.fillStyle = fill;
  ctx.fill();
}

function filled(ctx, path, fill) {
  ctx.beginPath();
  path();
  ctx.fillStyle = fill;
  ctx.fill();
}
