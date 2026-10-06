// 웨이브 보상 카드
// 웨이브를 막을 때마다 카드 몇 장을 뽑아 보여 주고, 플레이어가 고른 카드의 효과를 적용합니다.
// 카드 목록·효과·잘 나오는 정도(weight)·고를 수 있는 횟수(maxPicks)는 gameConfig.js 의 cards 에서 바꿉니다.
//
// 할 수 있는 일
//   deck.draw(장 수, { unlockedSkills })   서로 다른 카드를 뽑아서 돌려줌 → [카드]
//                                          weight 가 클수록 잘 나옴. maxPicks 만큼 이미 고른 카드와
//                                          이미 열린 스킬의 '새 스킬' 카드는 나오지 않음
//   deck.apply(카드, { modifiers, economy, skills, castleParts })
//                                          카드 효과를 적용하고 고른 횟수를 기록 → 적용했으면 true
//   deck.timesPicked(카드 id)              지금까지 그 카드를 고른 횟수
//   deck.picked                            고른 카드 id 목록 (고른 순서대로)
//   deck.reset()                           다시 하기: 고른 기록 지우기
//
// 카드 효과(effect) 종류 (한 카드에 여러 개를 같이 써도 됨)
//   add: { '보정값 이름': 수 }    js/game/core/modifiers.js 의 값에 더하기
//   mul: { '보정값 이름': 수 }    곱하기
//   gold: 수                     바로 돈 받기
//   unlockSkill: '스킬 이름'      스킬 열기 (js/game/systems/skills.js)
//   freePart: '부품 이름'         다음 그 성 부품 하나를 무료로 (js/game/systems/castleParts.js)
//
// 뽑힌 카드는 설정 내용에 category 가 붙어서 나옵니다 (카드 그림 색을 고를 때 씀).
//   'tower'(타워) | 'castle'(성·부품) | 'gold'(돈) | 'skill'(스킬)
//   설정에 category 를 직접 적으면 그 값을 씁니다.

// 돈과 관련된 보정값 이름 (이 값을 바꾸는 카드는 'gold' 종류)
const GOLD_PATHS = ['killGoldBonus', 'waveGoldBonus', 'interestRate'];
// 성과 관련된 보정값 이름 (이 값을 바꾸는 카드는 'castle' 종류)
const CASTLE_PATHS = ['guardShots', 'repairBonus', 'partDiscount'];

export function createCardDeck({ config, random = Math.random }) {
  const pool = config.cards.pool;
  const picks = new Map(); // 카드 id → 고른 횟수
  const history = [];

  function timesPicked(id) {
    return picks.get(id) ?? 0;
  }

  // 지금 나올 수 있는 카드인지
  // emptySockets: 빈 성 부품 자리 수 { corner, side } (없으면 확인 안 함) → 지을 자리가 없는 '무료 부품'·'할인' 카드는 안 나옴
  function isAvailable(card, unlockedSkills, emptySockets) {
    if (!((card.weight ?? 1) > 0)) return false;
    if (card.maxPicks !== undefined && timesPicked(card.id) >= card.maxPicks) return false;
    const skillId = card.effect?.unlockSkill;
    if (skillId && unlockedSkills.includes(skillId)) return false;
    if (emptySockets) {
      const freeType = card.effect?.freePart;
      const kind = freeType ? config.castleParts?.types?.[freeType]?.socket : null;
      if (kind && !(emptySockets[kind] > 0)) return false;
      if (card.effect?.add?.partDiscount && !(emptySockets.corner + emptySockets.side > 0)) return false;
    }
    return true;
  }

  // weight 에 따라 한 장씩 뽑고, 뽑은 카드는 빼고 다시 뽑음 (같은 카드가 두 번 나오지 않게)
  function draw(count = config.cards.choices, { unlockedSkills = [], emptySockets = null } = {}) {
    const candidates = pool.filter((card) => isAvailable(card, unlockedSkills ?? [], emptySockets));
    const drawn = [];
    while (drawn.length < count && candidates.length > 0) {
      const index = pickIndex(candidates);
      const card = candidates[index];
      candidates.splice(index, 1);
      drawn.push({ ...card, category: card.category ?? categoryOf(card) });
    }
    return drawn;
  }

  function pickIndex(candidates) {
    let total = 0;
    for (const card of candidates) total += card.weight ?? 1;
    let roll = random() * total;
    for (let i = 0; i < candidates.length; i++) {
      roll -= candidates[i].weight ?? 1;
      if (roll < 0) return i;
    }
    return candidates.length - 1;
  }

  // 카드 효과 적용. 효과 하나가 잘못 적혀 있어도 (예: 없는 보정값 이름) 게임은 멈추지 않고 나머지를 적용함
  function apply(card, { modifiers, economy, skills, castleParts } = {}) {
    const found = typeof card === 'string' ? pool.find((item) => item.id === card) : card;
    if (!found) return false;
    const effect = found.effect ?? {};
    for (const [path, amount] of Object.entries(effect.add ?? {})) {
      safely(found, () => modifiers.add(path, amount));
    }
    for (const [path, factor] of Object.entries(effect.mul ?? {})) {
      safely(found, () => modifiers.mul(path, factor));
    }
    if (effect.gold) safely(found, () => economy.earn(effect.gold));
    if (effect.unlockSkill) safely(found, () => skills.unlock(effect.unlockSkill));
    if (effect.freePart) safely(found, () => castleParts.grantFreePart(effect.freePart));
    picks.set(found.id, timesPicked(found.id) + 1);
    history.push(found.id);
    return true;
  }

  function reset() {
    picks.clear();
    history.length = 0;
  }

  return {
    draw,
    apply,
    timesPicked,
    reset,
    get picked() {
      return history.slice();
    },
  };
}

function safely(card, action) {
  try {
    action();
  } catch (error) {
    console.warn(`카드 '${card.id}' 효과를 적용하지 못했어요:`, error);
  }
}

// 카드 종류 정하기: 효과에 처음 적힌 것 기준
export function categoryOf(card) {
  const effect = card.effect ?? {};
  for (const key of Object.keys(effect)) {
    if (key === 'unlockSkill') return 'skill';
    if (key === 'gold') return 'gold';
    if (key === 'freePart') return 'castle';
    if (key === 'add' || key === 'mul') {
      const firstPath = Object.keys(effect[key])[0];
      if (firstPath) return categoryOfPath(firstPath);
    }
  }
  return 'tower';
}

function categoryOfPath(path) {
  const name = path.split('.')[0];
  if (name.startsWith('skill')) return 'skill';
  if (GOLD_PATHS.includes(name)) return 'gold';
  if (name.startsWith('part') || CASTLE_PATHS.includes(name)) return 'castle';
  return 'tower';
}
