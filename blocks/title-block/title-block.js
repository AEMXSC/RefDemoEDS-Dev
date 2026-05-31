const VALID_TAGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']);

const KEY_MAP = {
  title: 'title',
  titletext: 'title',
  titletype: 'titleType',
  headinglevel: 'titleType',
  align: 'align',
  textalignment: 'align',
  color: 'color',
  paddingtop: 'paddingTop',
  paddingbottom: 'paddingBottom',
  bgcolor: 'bgColor',
  backgroundcolor: 'bgColor',
};

function normalize(s) {
  return (s || '').toLowerCase().replace(/[\s_-]+/g, '');
}

function getCellText(cell) {
  return cell?.textContent?.trim() || '';
}

export default function decorate(block) {
  // Idempotency guard: avoid corrupting the block if decorate runs again on already-decorated DOM.
  if (block.dataset.titleBlockDecorated === 'true') return;

  const config = {};
  [...block.children].forEach((row) => {
    const cells = [...row.children];
    if (cells.length < 2) return;
    const field = KEY_MAP[normalize(cells[0].textContent || '')];
    if (!field) return;
    config[field] = cells[1];
  });

  const titleText = getCellText(config.title);
  const typeText = getCellText(config.titleType);
  const alignText = getCellText(config.align);
  const colorText = getCellText(config.color);
  const padTopText = getCellText(config.paddingTop);
  const padBottomText = getCellText(config.paddingBottom);
  const bgColor = getCellText(config.bgColor);

  const tagLower = typeText.toLowerCase();
  const tag = VALID_TAGS.has(tagLower) ? tagLower : 'h2';

  const heading = document.createElement(tag);
  heading.textContent = titleText;
  [alignText, colorText].filter(Boolean).forEach((c) => heading.classList.add(c));

  block.textContent = '';
  [padTopText, padBottomText].filter(Boolean).forEach((c) => block.classList.add(c));
  if (bgColor) block.style.backgroundColor = bgColor;
  block.append(heading);

  block.dataset.titleBlockDecorated = 'true';
}
