// 소굴 효과 그림 재료 (빛 점 재질, 떠오르는 글자 그림, 빛 고리 그림)
// lairFx.js(효과)와 lairLinks.js(계책 줄)가 같이 씁니다.
//
//   createGlowPointMaterial() → 빛 점 재질 (점마다 색 · 크기 · 투명도, 더하기 섞기). uniforms.scale = 화면 높이 px ÷ (2·tan(시야각/2))
//   drawLabel(canvas, 글자, 색) → 가로세로 비율     굵은 글자 + 짙은 보라 테두리 + 양옆 별
//   makeRingTexture() → 빛 고리 그림               easeOutBack(t) → 살짝 넘쳤다 돌아오는 0~1

import * as THREE from '../../lib/three.js';

// 빛 점 재질: 동그랗게 번지는 빛 (더하기 섞기). 크기는 블록 단위 → 멀리 있으면 작게
export function createGlowPointMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { scale: { value: 600 } },
    vertexShader: `
      attribute vec3 color; attribute float size; attribute float alpha;
      uniform float scale;
      varying vec3 vColor; varying float vAlpha;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = max(1.5, size * scale / -mv.z);
        gl_Position = projectionMatrix * mv;
        vColor = color; vAlpha = alpha;
      }`,
    fragmentShader: `
      varying vec3 vColor; varying float vAlpha;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        float a = smoothstep(1.0, 0.0, d);
        float core = pow(a, 5.0);
        a = a * a * vAlpha;
        gl_FragColor = vec4((vColor + vec3(core * 0.8)) * a, a);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

// 글자 그림: 굵은 글자 + 짙은 보라 테두리 + 양옆 별. 가로세로 비율을 돌려줌
export function drawLabel(canvas, text, hex) {
  const g = canvas.getContext('2d');
  g.clearRect(0, 0, canvas.width, canvas.height);
  g.font = '64px "Jua", "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif';
  const width = Math.min(canvas.width - 20, g.measureText(text).width + 110);
  const x0 = (canvas.width - width) / 2;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineJoin = 'round';
  g.lineWidth = 14;
  g.strokeStyle = '#1b0f33';
  g.strokeText(text, canvas.width / 2, 68);
  g.fillStyle = hex;
  g.fillText(text, canvas.width / 2, 68);
  g.fillStyle = '#FFF03A';
  for (const x of [x0 + 26, x0 + width - 26]) star(g, x, 64, 20);
  return canvas.width / canvas.height;
}

function star(g, x, y, r) {
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  g.closePath();
  g.lineWidth = 6;
  g.strokeStyle = '#1b0f33';
  g.stroke();
  g.fill();
}

export function makeRingTexture() {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const g = canvas.getContext('2d');
  const grad = g.createRadialGradient(size / 2, size / 2, size * 0.28, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(255,255,255,0)');
  grad.addColorStop(0.55, 'rgba(255,255,255,0.95)');
  grad.addColorStop(0.75, 'rgba(255,255,255,0.35)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function easeOutBack(t) {
  const c = 1.9;
  const u = t - 1;
  return 1 + (c + 1) * u * u * u + c * u * u;
}
