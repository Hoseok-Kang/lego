// 같이 쓰는 3D 그림판 하나 (WebGL)
// 휴대폰은 3D 그림판(WebGL)을 많이 만들면 느려지거나 꺼져요. 그래서 '괴수 그리기 미리보기'와 '3D 블록 작업대'는
// 한 화면에 같이 나오지 않으니 그림판 하나를 번갈아 씁니다. 쓰려는 쪽이 claimRenderer(상자) 를 부르면
// 그림판(canvas)이 그 상자 안으로 옮겨 갑니다.
//
//   const renderer = claimRenderer(hostEl)   그림판을 hostEl 안으로 옮기고 돌려줌 (처음이면 새로 만듦)
//   ownsRenderer(hostEl)                     지금 그림판이 hostEl 안에 있는지 (아니면 그리지 말고 크기도 바꾸지 말 것)
//   releaseRenderer(hostEl)                  hostEl 이 가지고 있었으면 그림판을 빼냄 (지우지는 않음)
//
// 그림자 · 색감 설정은 아래 makeRenderer 에서 바꿉니다.

import * as THREE from '../../lib/three.js';

let renderer = null;
let owner = null;

function makeRenderer() {
  const r = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  r.setClearColor(0x000000, 0);
  r.shadowMap.enabled = true;
  r.shadowMap.type = THREE.PCFShadowMap;
  r.toneMapping = THREE.NeutralToneMapping;
  Object.assign(r.domElement.style, { display: 'block', width: '100%', height: '100%', touchAction: 'none' });
  return r;
}

export function claimRenderer(hostEl) {
  if (!renderer) renderer = makeRenderer();
  if (owner !== hostEl || renderer.domElement.parentNode !== hostEl) {
    hostEl.appendChild(renderer.domElement);
    owner = hostEl;
  }
  return renderer;
}

export const ownsRenderer = (hostEl) => !!renderer && owner === hostEl && renderer.domElement.parentNode === hostEl;

export function releaseRenderer(hostEl) {
  if (!ownsRenderer(hostEl)) return;
  renderer.domElement.remove();
  owner = null;
}
