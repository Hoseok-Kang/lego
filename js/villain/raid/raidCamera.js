// 습격 카메라 감독 (지금 장면에 맞게 카메라가 어디를 얼마나 가까이 볼지 정함)
// 괴수가 쌓일 때는 괴수를 가까이, 부술 때는 괴수와 노리는 건물 사이, 맞대결 때는 괴수와 영웅 사이를 봅니다.
//
//   const aim = createRaidCamera(view)        view: 마을 카메라 (stage.view, 없으면 아무 일도 안 함)
//   aim({ phase, monster, hero, target, landing, pending, collapsing })   매 장면 한 번
//
// 다가가는 정도(1 = 마을 전체가 보임)는 아래 ZOOM 표에서 바꿉니다.

const ZOOM = { building: 1.9, smashing: 1.3, alert: 1.2, duel: 1.45, cleanup: 1.25, finale: 1 };
const DUEL_SPREAD = 12; // 맞대결 때 둘이 이보다 멀어지면 조금씩 물러남
const DUEL_MIN = 1.1; // 맞대결 때 가장 멀리 물러난 정도

export const RAID_ZOOM = ZOOM;

export function createRaidCamera(view) {
  const focus = { x: 0, z: 0 };
  const mid = (a, b, t) => {
    focus.x = a.x + (b.x - a.x) * t;
    focus.z = a.z + (b.z - a.z) * t;
    return focus;
  };

  return function aim({ phase, monster, hero, target, landing, pending, collapsing }) {
    if (!view || !monster) return;
    const m = monster.position;
    if (collapsing || phase === 'ended') return view.setFocus(m, ZOOM.finale); // 마을 전체 (세로 화면은 괴수 쪽을 가까이)
    if (pending) {
      const at = pending.win ? m : hero?.alive ? mid(m, hero.position, 0.5) : m;
      return view.setFocus(at, ZOOM.cleanup);
    }
    switch (phase) {
      case 'building':
        return view.setFocus(m, ZOOM.building);
      case 'alert':
        return view.setFocus(landing ? mid(m, landing, 0.5) : m, ZOOM.alert);
      case 'duel': {
        if (!hero) return view.setFocus(m, ZOOM.duel);
        const gap = Math.hypot(hero.position.x - m.x, hero.position.z - m.z);
        return view.setFocus(mid(m, hero.position, 0.5), Math.max(DUEL_MIN, ZOOM.duel - Math.max(0, gap - DUEL_SPREAD) * 0.03));
      }
      case 'cleanup':
        return view.setFocus(target ? mid(m, target.position, 0.35) : m, ZOOM.cleanup);
      default:
        return view.setFocus(target ? mid(m, target.position, 0.35) : m, ZOOM.smashing);
    }
  };
}
