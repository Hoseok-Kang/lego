// ─────────────────────────────────────────────────────────────
// 악당 타이쿤 그림판: 화면 안 확인 창
// "정말 지울까요?" 같은 것을 브라우저 기본 창 대신 예쁜 작은 카드로 물어봅니다.
//
// 쓰는 법
//   const yes = await askConfirm(hostEl, { message: '그림을 전부 지울까요?', yes: '지울래요', no: '아니요', danger: true });
//   hostEl 은 position 이 잡힌(relative/fixed) 상자여야 합니다. 그 상자를 덮고 가운데에 카드가 뜹니다.
//   Esc 또는 바깥을 누르면 '아니요' 입니다.
// ─────────────────────────────────────────────────────────────

export function askConfirm(hostEl, { message, yes = '네', no = '아니요', danger = false } = {}) {
  return new Promise((resolve) => {
    hostEl.querySelector(':scope > .pb-confirm')?.remove();
    const veil = document.createElement('div');
    veil.className = 'pb-confirm';
    veil.innerHTML = `
      <div class="pb-confirm-card" role="alertdialog" aria-modal="true">
        <p class="pb-confirm-text"></p>
        <div class="pb-confirm-actions">
          <button type="button" class="pb-btn" data-answer="no"></button>
          <button type="button" class="pb-btn pb-btn--primary" data-answer="yes"></button>
        </div>
      </div>`;
    veil.querySelector('.pb-confirm-text').textContent = message;
    const noBtn = veil.querySelector('[data-answer="no"]');
    const yesBtn = veil.querySelector('[data-answer="yes"]');
    noBtn.textContent = no;
    yesBtn.textContent = yes;
    if (danger) yesBtn.classList.add('pb-btn--danger');

    function finish(answer) {
      document.removeEventListener('keydown', onKey, true);
      veil.remove();
      resolve(answer);
    }
    function onKey(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        finish(false);
      }
    }
    veil.addEventListener('click', (event) => {
      const answer = event.target.closest('[data-answer]')?.dataset.answer;
      if (answer) finish(answer === 'yes');
      else if (event.target === veil) finish(false);
    });
    document.addEventListener('keydown', onKey, true);
    hostEl.append(veil);
    yesBtn.focus({ preventScroll: true });
  });
}
