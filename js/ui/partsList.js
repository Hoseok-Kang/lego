// 부품 목록
// 조립 설명서처럼 '어떤 색 블록이 몇 개 필요한지'를 보여 줍니다.

export function renderPartsList(container, plan, palette) {
  container.replaceChildren(
    ...plan.colorCounts.map(({ colorIndex, count }) => {
      const color = palette[colorIndex];
      const item = document.createElement('li');
      item.className = 'part';

      const swatch = document.createElement('span');
      swatch.className = 'part-swatch';
      swatch.style.setProperty('--swatch', color.hex);
      swatch.setAttribute('aria-hidden', 'true');

      const name = document.createElement('span');
      name.className = 'part-name';
      name.textContent = color.name;

      const quantity = document.createElement('span');
      quantity.className = 'part-qty';
      quantity.textContent = `×${count.toLocaleString('ko-KR')}`;

      item.append(swatch, name, quantity);
      return item;
    }),
  );
}
