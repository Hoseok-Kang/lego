// 괴수 블록 인형 만들기 (몸 + 붙인 부품)
// 그림(design)을 통통한 블록 인형으로 만들고, 그림 칸에 붙인 공격 부품을 그 자리에 달아 줍니다.
// 싸우는 괴수(monster.js)와 미리보기(monsterPreview.js)가 같이 씁니다.
//
//   const figure = createMonsterFigure(scene, design, { castShadow = true })
//   figure.fig                  블록 인형 (voxelFigure.js) — fig.root 가 서 있는 자리, fig.parts.body 가 몸 손잡이
//   figure.model                설계도 (monsterVoxels.js)
//   figure.mounts               붙인 부품 [{ type, name, cell, side, art, node, attached, at }]
//   figure.attachAll()          부품 전부 달기 ; figure.attach(mount) 하나 달기
//   figure.detach(mount) → [{ position, color }]   부품을 떼고 그 블록들을 돌려줌 (부서진 조각용)
//   figure.partWorld(mount, 'tip' | 'grip', out)   부품 끝/붙은 점의 세상 위치
//   figure.dispose()

import * as THREE from '../../lib/three.js';
import { createVoxelFigure } from '../../fight/render/voxelFigure.js';
import { VILLAIN } from '../villainConfig.js';
import { buildMonsterModel } from './monsterVoxels.js';
import { getPartArt } from './partArt.js';

export function createMonsterFigure(scene, design, { castShadow = true } = {}) {
  const model = buildMonsterModel(design);
  const fig = createVoxelFigure(scene, model, { castShadow });

  // 붙일 부품 목록 (빈 칸에 놓였거나 모르는 부품은 건너뜀)
  const mounts = [];
  for (const part of (design?.parts || []).slice(0, VILLAIN.parts.slots)) {
    const at = model.cellToWorld(part.col, part.row);
    if (!at || !VILLAIN.parts.types[part.type]) continue;
    const side = at.x < 0 ? -1 : 1;
    const art = getPartArt(part.type, side);
    if (!art) continue;
    mounts.push({
      type: part.type,
      name: `part${mounts.length}_${part.type}`,
      cell: model.cellIndexAt(part.col, part.row),
      side,
      art,
      at: [at.x, at.y, at.z],
      node: null,
      attached: false,
    });
  }

  function attach(mount) {
    if (mount.attached) return mount.node;
    mount.node = fig.addPart(mount.name, mount.art.voxels, { parent: 'body', pivot: mount.art.grip, at: mount.at });
    mount.node.rotation.set(mount.art.rest.x, mount.art.rest.y, mount.art.rest.z);
    mount.attached = true;
    return mount.node;
  }

  const point = new THREE.Vector3();
  function partWorld(mount, which, out = new THREE.Vector3()) {
    const grip = mount.art.grip;
    const p = which === 'tip' ? mount.art.tip : grip;
    out.set(p[0] - grip[0], p[1] - grip[1], p[2] - grip[2]);
    if (!mount.node) return out.set(mount.at[0], mount.at[1], mount.at[2]).applyMatrix4(fig.parts.body.matrixWorld);
    mount.node.updateWorldMatrix(true, false);
    return out.applyMatrix4(mount.node.matrixWorld);
  }

  function detach(mount) {
    if (!mount.attached) return [];
    const grip = mount.art.grip;
    mount.node.updateWorldMatrix(true, false);
    const blocks = mount.art.voxels.map((voxel) => ({
      position: point.set(voxel.x - grip[0], voxel.y - grip[1], voxel.z - grip[2]).applyMatrix4(mount.node.matrixWorld).clone(),
      color: new THREE.Color(voxel.hex),
    }));
    fig.removePart(mount.name);
    mount.attached = false;
    mount.node = null;
    return blocks;
  }

  return {
    fig,
    model,
    mounts,
    attach,
    attachAll: () => mounts.forEach(attach),
    detach,
    partWorld,
    dispose: () => fig.dispose(),
  };
}
