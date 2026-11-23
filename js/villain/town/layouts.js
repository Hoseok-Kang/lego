// 마을 배치도 모음 (마을 id → 배치도)
// 마을 설정(js/villain/data/towns.js)의 layout 이름으로 배치도를 찾습니다. 모르는 이름이면 꼬마 마을.
//
//   TOWN_LAYOUTS = { village, harbor, castle }
//   layoutFor(townOrId) → 배치도     townOrId: 마을 설정 { id, layout } 또는 id 글자
//
// 새 마을을 더하려면 배치도 파일을 만들고 아래 표에 한 줄 더하면 됩니다.

import { TOWN_LAYOUT } from './townLayout.js';
import { HARBOR_LAYOUT } from './harborLayout.js';
import { CASTLE_LAYOUT } from './castleLayout.js';

export const TOWN_LAYOUTS = {
  village: TOWN_LAYOUT,
  harbor: HARBOR_LAYOUT,
  castle: CASTLE_LAYOUT,
};

export function layoutFor(town) {
  const key = typeof town === 'string' ? town : town?.layout || town?.id;
  return TOWN_LAYOUTS[key] || TOWN_LAYOUT;
}
