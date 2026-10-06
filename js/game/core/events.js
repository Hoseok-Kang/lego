// 게임 소식 전달함
// 한 모듈이 "적이 쓰러졌어요" 같은 소식을 보내면(emit), 듣고 있던 모듈들이(on) 각자 반응합니다.
// 덕분에 모듈끼리 서로를 몰라도 함께 움직일 수 있습니다.
//
// 주고받는 소식 이름과 내용
//   'blockLanded'        { }                                  블록 하나가 쌓임 (딸깍 소리)
//   'castleBuilt'        { }
//   'castleHit'          { damage, hp, maxHp, position }      성이 공격받음
//   'castleRepaired'     { amount, hp, maxHp }                웨이브를 막고 성이 수리됨
//   'castleDestroyed'    { }
//   'enemySpawned'       { enemy }
//   'enemyHit'           { enemy, damage, position }
//   'enemyKilled'        { enemy, gold, position }
//   'towerBuildStarted'  { tower }
//   'towerBuilt'         { tower }
//   'towerUpgraded'      { tower }
//   'towerSold'          { tower, refund }
//   'projectileFired'    { kind, position }                   kind: 'arrow' | 'cannonball' | 'ice'
//   'projectileHit'      { kind, position }
//   'goldChanged'        { gold, delta }
//   'wavePreview'        { wave, total, directions }          쉬는 시간에 다음 웨이브 방향 미리 알림
//   'waveStarted'        { wave, total, directions }          directions: 적이 오는 각도(라디안) 목록
//   'waveSpawnDone'      { wave }
//   'waveCleared'        { wave, total }
//   'landGrowStarted'    { from, to }                         땅이 넓어지기 시작 (둘레에 블록이 쌓임)
//   'landGrown'          { size, previousSize, spawnRadius }  땅이 다 넓어짐
//   'partBuilt'          { part }                             성 부품 완성
//   'partUpgraded'       { part }
//   'cardPicked'         { card }                             보상 카드를 고름
//   'skillUnlocked'      { id }
//   'skillCast'          { id, point }                        스킬 사용
//   'skillImpact'        { id, point }                        블록 떨어뜨리기가 땅에 닿음
//   'skillReady'         { id }                               스킬 대기시간 끝
//   'bossAssembling'     { enemy, fromRubble, total }         바닥 잔해가 모여 대장이 만들어지기 시작
//   'bossAssembled'      { enemy }                            대장 완성 (이제 움직이고 맞을 수 있음)

export function createEvents() {
  const listeners = new Map();
  return {
    on(name, handler) {
      if (!listeners.has(name)) listeners.set(name, new Set());
      listeners.get(name).add(handler);
      return () => listeners.get(name).delete(handler);
    },
    emit(name, payload = {}) {
      const handlers = listeners.get(name);
      if (!handlers) return;
      for (const handler of handlers) handler(payload);
    },
  };
}
