// 웨이브 (적이 몰려오는 차례)
// 웨이브 하나가 시작되면 어떤 몬스터가 몇 마리, 어느 방향에서, 언제 나올지 순서표(대기열)를 만들고
// 시간이 되면 한 마리씩 내보냅니다. 몇 마리가 나오는지는 gameConfig.js 의 waves 에서 바꿉니다.
//
//   waves.composition(번호)    그 웨이브에 나오는 몬스터 목록 [{ typeId, count }] (계산만 함)
//   waves.preview(번호)        다음 웨이브가 올 방향을 미리 정하고 알림 → 'wavePreview' 소식 (쉬는 시간에 씀)
//   waves.start(번호)          웨이브 시작 → 'waveStarted' 소식 (미리 정한 방향이 있으면 그 방향)
//   waves.update(dt)          매 장면마다: 나올 시간이 된 몬스터 내보내기
//                             다 내보내면 'waveSpawnDone' 한 번, 그 뒤 살아 있는 적이 0이 되면 'waveCleared' 한 번
//   waves.remainingToSpawn()  아직 안 나온 몬스터 수
//   waves.reset()             진행 중인 웨이브 멈추고 잊기 (다시 하기)
//   waves.currentWave         마지막으로 시작한 웨이브 번호 (아직 없으면 0)
//
// 나오는 순서: 종류를 골고루 섞고, 대장(boss)은 맨 마지막에 잠깐 쉬었다가 등장합니다.
// 방향: 방향 수만큼 둘레를 대충 똑같이 나눈 뒤(돌려서 매번 다르게), 몬스터마다 돌아가며 방향을 정합니다.

// ── 바꿔도 되는 숫자 ──
const BOSS_TYPE = 'boss'; // 맨 마지막에 나오는 대장 몬스터 종류
const BOSS_GAP_SECONDS = 2; // 대장이 나오기 전에 더 기다리는 시간
const DIRECTION_JITTER = 0.25; // 방향마다 둘레를 똑같이 나눈 각도에서 조금씩 어긋나는 정도 (라디안)
const SPAWN_JITTER = 0.12; // 몬스터마다 자기 방향에서 조금씩 어긋나는 정도 (라디안)
const CUSTOM_TYPE = 'custom'; // 사용자가 올린 '내 몬스터' 종류
const CUSTOM_ART_ID = 'monster:custom';

const TWO_PI = Math.PI * 2;

export function createWaveDirector({ events, enemies, art, config, random = Math.random }) {
  const waveConfig = config.waves;
  const totalWaves = waveConfig.list.length;
  let run = null; // 진행 중인 웨이브: { wave, queue, next, elapsed, spawnDone, cleared }
  let currentWave = 0;
  let planned = null; // 미리 정한 다음 웨이브 방향: { wave, directions }

  function preview(wave) {
    if (!waveConfig.list[wave - 1]) return null;
    if (!planned || planned.wave !== wave) planned = { wave, directions: pickDirections(directionCount(wave)) };
    events.emit('wavePreview', { wave, total: totalWaves, directions: planned.directions });
    return planned;
  }

  // 그 웨이브에 나오는 몬스터 종류와 수
  function composition(wave) {
    const result = [];
    const entry = waveConfig.list[wave - 1];
    if (!entry) return result;
    for (const [typeId, count] of Object.entries(entry)) {
      if (config.enemies[typeId] && count > 0) result.push({ typeId, count: Math.round(count) });
    }
    if (art.hasCustom(CUSTOM_ART_ID) && wave >= waveConfig.customFromWave && config.enemies[CUSTOM_TYPE]) {
      const count = Math.max(1, Math.round(wave * waveConfig.customPerWave));
      const existing = result.find((item) => item.typeId === CUSTOM_TYPE);
      if (existing) existing.count += count;
      else result.push({ typeId: CUSTOM_TYPE, count });
    }
    return result;
  }

  function start(wave) {
    const directions = planned && planned.wave === wave ? planned.directions : pickDirections(directionCount(wave));
    planned = null;
    const hpScale = 1 + waveConfig.hpGrowth * (wave - 1);
    const order = spawnOrder(composition(wave));

    let time = 0;
    const queue = order.map((typeId, k) => {
      if (k > 0) time += waveConfig.spawnInterval;
      if (typeId === BOSS_TYPE) time += BOSS_GAP_SECONDS;
      const base = directions[k % directions.length];
      return { typeId, time, hpScale, angle: base + (random() * 2 - 1) * SPAWN_JITTER };
    });
    // 첫 몬스터는 웨이브가 시작하자마자 나옴 (첫 순서가 대장이어도 바로)
    const shift = queue.length > 0 ? queue[0].time : 0;
    for (const item of queue) item.time -= shift;

    currentWave = wave;
    run = { wave, queue, next: 0, elapsed: 0, spawnDone: false, cleared: false };
    events.emit('waveStarted', { wave, total: totalWaves, directions });
  }

  function update(dt) {
    const current = run;
    if (!current || current.cleared) return;
    current.elapsed += dt;

    const { queue } = current;
    while (current.next < queue.length && queue[current.next].time <= current.elapsed) {
      const item = queue[current.next++];
      enemies.spawn(item.typeId, { angle: item.angle, hpScale: item.hpScale });
      if (run !== current) return; // 소식을 받은 쪽에서 웨이브를 멈추거나 새로 시작했으면 여기서 끝
    }

    if (!current.spawnDone && current.next >= queue.length) {
      current.spawnDone = true;
      events.emit('waveSpawnDone', { wave: current.wave });
      if (run !== current) return;
    }

    if (current.spawnDone && enemies.aliveCount() === 0) {
      current.cleared = true;
      events.emit('waveCleared', { wave: current.wave, total: totalWaves });
    }
  }

  function remainingToSpawn() {
    return run ? run.queue.length - run.next : 0;
  }

  function reset() {
    run = null;
    currentWave = 0;
    planned = null;
  }

  // ── 아래는 내부에서 쓰는 기능 ──

  function directionCount(wave) {
    const list = waveConfig.directions;
    const count = list[wave - 1] ?? list[list.length - 1] ?? 1;
    return Math.max(1, Math.round(count));
  }

  // 둘레를 count 등분하고, 전체를 아무렇게나 돌린 뒤 방향마다 조금씩 흔듦 (0 ~ 2π 라디안)
  function pickDirections(count) {
    const turn = random() * TWO_PI;
    const directions = [];
    for (let i = 0; i < count; i++) {
      const angle = turn + (i * TWO_PI) / count + (random() * 2 - 1) * DIRECTION_JITTER;
      directions.push(((angle % TWO_PI) + TWO_PI) % TWO_PI);
    }
    return directions;
  }

  // 종류를 골고루 섞은 순서 (대장은 맨 끝)
  // 종류마다 count 마리를 0~1 사이에 같은 간격으로 놓고, 그 자리 순서대로 줄 세움
  function spawnOrder(groups) {
    const slots = [];
    const bosses = [];
    groups.forEach(({ typeId, count }, typeIndex) => {
      for (let j = 0; j < count; j++) {
        if (typeId === BOSS_TYPE) bosses.push(typeId);
        else slots.push({ typeId, at: (j + 0.5) / count, typeIndex });
      }
    });
    slots.sort((a, b) => a.at - b.at || a.typeIndex - b.typeIndex);
    return [...slots.map((slot) => slot.typeId), ...bosses];
  }

  return {
    composition,
    preview,
    start,
    update,
    remainingToSpawn,
    reset,
    get currentWave() {
      return currentWave;
    },
    get isSpawnDone() {
      return Boolean(run && run.spawnDone);
    },
    get isCleared() {
      return Boolean(run && run.cleared);
    },
  };
}
