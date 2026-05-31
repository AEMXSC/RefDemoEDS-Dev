
/* Video file extensions recognised for auto-detection */
const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.mov', '.ogg', '.m4v', '.avi'];

/**
 * Check whether a given <a> element points to a video file.
 */
function isVideoLink(link) {
  if (!link || !link.href) return false;
  try {
    const url = new URL(link.href, window.location.origin);
    const pathname = url.pathname.toLowerCase();
    if (VIDEO_EXTENSIONS.some((ext) => pathname.endsWith(ext))) return true;

    const assetName = url.searchParams.get('assetname') || '';
    if (VIDEO_EXTENSIONS.some((ext) => assetName.toLowerCase().endsWith(ext))) return true;
  } catch (_) {
    // malformed URL — not a video
  }
  return false;
}

/**
 * Find the first video link anywhere inside the block.
 */
function findVideoLink(block) {
  const links = block.querySelectorAll('a[href]');
  for (const link of links) {
    if (isVideoLink(link)) return link;
  }
  return null;
}

/**
 * Remove every video-URL <a> from the block DOM.
 * Also removes the parent <p> if it becomes empty after the link is removed.
 */
function removeVideoLinks(block) {
  block.querySelectorAll('a[href]').forEach((link) => {
    if (isVideoLink(link)) {
      const parent = link.parentElement;
      link.remove();
      if (parent && parent.tagName === 'P' && parent.textContent.trim() === '') {
        parent.remove();
      }
    }
  });
}

/**
 * Check whether a div has meaningful authored content.
 */
function hasMeaningfulContent(div) {
  if (!div) return false;
  if (div.querySelector('h1, h2, h3, h4, h5, h6')) return true;
  if (div.querySelector('.button-container')) return true;

  const hasText = [...div.querySelectorAll('p')].some(
    (p) => !p.classList.contains('button-container') && p.textContent.trim().length > 0,
  );
  return hasText;
}

/**
 * Hero block decorator.
 * Supports both image and video backgrounds — asset type is auto-detected.
 * Video plays muted, looped, autoplayed with no controls (background video).
 *
 * DOM child-div order (matches model field order):
 *   1  image + imageAlt   (reference + text share same row)
 *   2  text               (richtext — headings, paragraphs, CTA)
 *   3  enableunderline
 *   4  herolayout
 *   5  ctastyle
 *   6  backgroundstyle
 *
 * @param {Element} block
 */
export default function decorate(block) {
  // --- Capture all direct child divs BEFORE any DOM mutations ---
  // This gives us stable references regardless of prepend/remove operations.
  const childDivs = [...block.querySelectorAll(':scope > div')];
  const assetDiv = childDivs[0]; // div 1: image/video asset + alt
  const textDiv = childDivs[1]; // div 2: richtext (headings, paragraphs, CTA)
  const underlineDiv = childDivs[2]; // div 3: enableunderline
  const layoutDiv = childDivs[3]; // div 4: herolayout
  const ctaDiv = childDivs[4]; // div 5: ctastyle
  const bgDiv = childDivs[5]; // div 6: backgroundstyle

  // --- Read configuration values ---
  const enableUnderline = underlineDiv?.querySelector('div')?.textContent?.trim() || 'true';
  const layoutStyle = layoutDiv?.querySelector('div')?.textContent?.trim() || 'overlay';
  const ctaStyle = ctaDiv?.querySelector('div')?.textContent?.trim() || 'button';
  const backgroundStyle = bgDiv?.querySelector('div')?.textContent?.trim() || 'default';

  // --- Apply layout & theme classes ---
  if (layoutStyle) block.classList.add(layoutStyle);
  if (backgroundStyle) block.classList.add(backgroundStyle);
  if (enableUnderline.toLowerCase() === 'false') block.classList.add('removeunderline');

  /*
  // --- CTA styling ---
  const buttonContainer = block.querySelector('p.button-container');
  if (buttonContainer) {
    buttonContainer.classList.add(`cta-${ctaStyle}`);
  }
  */
  // Scoped to textDiv only (not the whole block) and runs after removeVideoLinks
  // so video-URL paragraphs are already gone and can't be mistaken for CTAs.
  if (textDiv) {
    textDiv.querySelectorAll('p.button-container').forEach((p) => {
      p.classList.add(`cta-${ctaStyle}`);
    });
  }

  // --- Mark text div with a stable class so CSS targets it regardless of DOM position ---
  if (textDiv) textDiv.classList.add('hero-text');

  // --- Auto-detect video from any <a> in the block ---
  const videoLink = findVideoLink(block);

  if (videoLink) {
    block.classList.add('hero-video');
    const videoUrl = videoLink.href;

    // Remove ALL video-URL links from the DOM before building the player.
    removeVideoLinks(block);

    // Create a plain HTML5 <video> — no controls, background behaviour
    const video = document.createElement('video');
    video.src = videoUrl;
    video.autoplay = true;
    video.loop = true;
    video.muted = true;
    video.playsInline = true;
    video.setAttribute('disablepictureinpicture', '');
    video.setAttribute('disableremoteplayback', '');
    video.className = 'hero-video-bg';

    const isBackgroundLayout = [
      'overlay',
      'image-background-text-left',
      'image-background-text-right',
    ].includes(layoutStyle);

    if (isBackgroundLayout) {
      block.prepend(video);
    } else if (assetDiv) {
      assetDiv.innerHTML = '';
      assetDiv.appendChild(video);
    }
  }

  // --- Hide the asset div if it's empty (video link removed, or no asset authored) ---
  if (assetDiv && assetDiv.textContent.trim() === '' && !assetDiv.querySelector('picture, video')) {
    assetDiv.style.display = 'none';
  }

  // --- Hide the text overlay div if it has no meaningful authored content ---
  if (!hasMeaningfulContent(textDiv)) {
    if (textDiv) textDiv.style.display = 'none';
  }

  // --- Hide configuration-only divs ---
  [underlineDiv, layoutDiv, ctaDiv, bgDiv].forEach((div) => {
    if (div) div.style.display = 'none';
  });
}