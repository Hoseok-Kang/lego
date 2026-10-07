// 펑펑 토끼 싸움터 만들기 (3D 화면 + 싸움에 필요한 모든 부품을 한 번에)
// 무대·카메라·부딪힘·소품·블록 조각·효과·총알·내 토끼·미친토끼·당근을 만들고 서로 연결합니다.
// 화면 위 글자·버튼(정보판, 안내창)과 게임 순서는 game.js 가 맡습니다.
//
//   const world = createFightWorld(container)    container: fight.html 의 #arena
//   world.stage / view / events / collision / debris / props / fx / bullets / player / enemies / pickups
//   world.fighters()     총알이 맞힐 수 있는 토끼 목록 [내 토끼, 미친토끼…] (같은 배열을 돌려 씀)
//   world.resetRound()   한 판을 처음 상태로: 조각·잔해·총알·당근·효과를 치우고, 상자를 다시 세우고,
//                        미친토끼를 처음 자리에 세우고, 내 토끼를 되살리고, 처음 당근을 놓음
//
// 지도는 world/mapLayout.js, 숫자는 fightConfig.js 에서 바꿉니다.

import { FIGHT } from './fightConfig.js';
import { createFightStage } from './core/stage.js';
import { createFollowCamera } from './core/followCamera.js';
import { createCollisionWorld } from './core/collision.js';
import { createProps } from './world/props.js';
import { FIGHT_MAP } from './world/mapLayout.js';
import { createDebris } from '../game/core/debris.js';
import { createEvents } from '../game/core/events.js';
import { createEffects } from './render/effects.js';
import { createBullets } from './combat/bullets.js';
import { createPlayer } from './combat/player.js';
import { createEnemies } from './combat/enemies.js';
import { createPickups } from './combat/pickups.js';

const DEBRIS_INSET = 1; // 조각이 바닥판 끝에서 이만큼(칸) 안쪽에서 튕겨 돌아옴 (1 = 울타리 안쪽 면: 울타리는 바닥판 끝 한 칸 줄에 섬 → 잔해가 울타리 기둥에 박히지 않음)
const RUBBLE_JITTER = 0.05; // 잔해가 눕는 높이를 자리마다 0 ~ 이만큼 다르게 (겹친 블록 윗면 깜빡임 막기, 눈에는 안 보임. 쌓기를 끈 때만)

export function createFightWorld(container) {
  const stage = createFightStage(container);
  const scene = stage.scene;
  // 카메라: 휴대폰 세로 화면(가로 < 세로)은 좌우 폭을 portraitHalfWidth 로 줄여 토끼를 크게 보이게
  const cameraConfig = { ...FIGHT.camera };
  const view = createFollowCamera(stage.camera, stage.renderer.domElement, cameraConfig);
  const fitCamera = (width, height) => {
    cameraConfig.minHalfWidth = width < height ? (FIGHT.camera.portraitHalfWidth ?? FIGHT.camera.minHalfWidth) : FIGHT.camera.minHalfWidth;
    view.refreshRect(); // 화면 크기가 바뀔 때만 캔버스 위치·크기를 다시 읽음 (카메라는 매 장면 읽지 않음)
  };
  fitCamera(container.clientWidth, container.clientHeight);
  stage.onResize(fitCamera);
  const events = createEvents();

  // 전장 경계 = 바닥판 크기 (울타리는 props.js 가 경계 안쪽에 세움)
  const halfW = FIGHT.map.width / 2;
  const halfD = FIGHT.map.depth / 2;
  const collision = createCollisionWorld({ bounds: { minX: -halfW, maxX: halfW, minZ: -halfD, maxZ: halfD } });

  // 날아가는 조각은 울타리 안쪽 면에서 튕겨 돌아옴 → 내 토끼가 울타리 옆에서 터져도 잔해가 울타리 줄·바깥 땅에 떨어지지 않음
  const debrisBounds = { minX: -halfW + DEBRIS_INSET, maxX: halfW - DEBRIS_INSET, minZ: -halfD + DEBRIS_INSET, maxZ: halfD - DEBRIS_INSET };
  const debris = createDebris(scene, { ...FIGHT.debris, bounds: debrisBounds }); // FIGHT.debris.stack (블록 더미 쌓기) 도 함께 넘어감
  const props = createProps(scene, { collision, debris, events });
  // 조각이 떨어질 땅 높이: 돌담 위는 돌담 위, 바닥판 밖은 한 칸 낮은 바깥 땅 (잔해 더미 높이는 debris.js 가 따로 더함)
  // 쌓지 않을 때만: 자리마다 아주 조금 다른 높이 (겹쳐 누운 잔해 윗면이 같은 높이에서 지글거리지 않게)
  // 쌓을 때(debris.stack)는 잔해가 칸에 맞춰 겹치지 않고 놓이므로 0 (높이가 자리마다 다르면 쌓인 블록 사이가 살짝 들뜨거나 묻힘)
  const outsideY = -(FIGHT_MAP.plateThickness ?? 1);
  const jitter = FIGHT.debris.stack ? 0 : RUBBLE_JITTER;
  debris.setGroundHeight((x, z) => {
    const base = x < -halfW || x > halfW || z < -halfD || z > halfD ? outsideY : props.groundHeight(x, z);
    return jitter ? base + jitter * hash01(x, z) : base;
  });

  const fx = createEffects(scene);
  const bullets = createBullets(scene, { collision, props, debris, fx, events });
  let enemies = null; // 내 토끼가 먼저 만들어지므로 나중에 채움
  const player = createPlayer(scene, { collision, bullets, fx, debris, events, view, getEnemies: () => enemies?.list ?? [], props });
  enemies = createEnemies(scene, { collision, bullets, fx, debris, events, view, player });
  const pickups = createPickups(scene, { events, collision, fx });

  const fighterList = [];
  function fighters() {
    fighterList.length = 0;
    fighterList.push(player);
    for (let i = 0; i < enemies.list.length; i++) fighterList.push(enemies.list[i]);
    return fighterList;
  }

  function resetRound() {
    bullets.clear();
    pickups.clear();
    debris.clear(); // 날아다니는 조각 + 바닥 잔해 모두
    fx.clear();
    fx.aimLine(null, null, false);
    props.reset(); // 상자 블록·부딪힘 다시 세우기 (길 지도는 장애물이 바뀐 것을 알아서 다시 계산)
    enemies.spawnAll();
    player.reset();
    view.snapTo(player.position);
    for (const [x, z] of FIGHT.carrots.mapSpots) pickups.spawn(x, z, { pop: false });
  }

  return { stage, view, events, collision, debris, props, fx, bullets, player, enemies, pickups, fighters, resetRound };
}

// (x, z) → 0~1 사이의 늘 같은 값 (위치마다 다른 '무작위' 높이)
function hash01(x, z) {
  const v = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
  return v - Math.floor(v);
}
