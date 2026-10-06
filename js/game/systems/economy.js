// 돈
// 타워를 지을 때 쓰고, 몬스터를 쓰러뜨리거나 웨이브를 막으면 법니다.

export function createEconomy(events, config) {
  let gold = config.startGold;

  function change(delta) {
    gold += delta;
    events.emit('goldChanged', { gold, delta });
  }

  return {
    get gold() {
      return gold;
    },
    canAfford: (amount) => gold >= amount,
    spend(amount) {
      if (gold < amount) return false;
      change(-amount);
      return true;
    },
    earn(amount) {
      if (amount > 0) change(amount);
    },
    reset() {
      gold = config.startGold;
      events.emit('goldChanged', { gold, delta: 0 });
    },
  };
}
