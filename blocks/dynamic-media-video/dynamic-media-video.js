import { loadScript } from '../../scripts/aem.js';

const DM_VIDEO_VIEWER_URL = 'https://delivery-p153659-e1620914.adobeaemcloud.com/adobe/assets/urn:aaid:aem:dmviewers-html5/as/DMVideoViewer.js';

let dmViewerPromise;

/**
 * Wait for the DM VideoViewer to be available on window.dmviewers
 * @param {number} timeout - Maximum time to wait in ms
 * @returns {Promise<boolean>} - Resolves to true when available, rejects on timeout
 */
function waitForDMViewer(timeout = 10000) {
  return new Promise((resolve, reject) => {
    // Check if already available
    if (window.dmviewers?.VideoViewer) {
      resolve(true);
      return;
    }

    const startTime = Date.now();
    const checkInterval = setInterval(() => {
      if (window.dmviewers?.VideoViewer) {
        clearInterval(checkInterval);
        resolve(true);
      } else if (Date.now() - startTime > timeout) {
        clearInterval(checkInterval);
        reject(new Error('DM VideoViewer failed to load within timeout'));
      }
    }, 100);
  });
}

/**
 * Load the DM Video Viewer script and wait for it to be ready
 * @returns {Promise<void>}
 */
async function loadDMVideoViewer() {
  if (!dmViewerPromise) {
    dmViewerPromise = (async () => {
      // Load the script (will skip if already in DOM)
      await loadScript(DM_VIDEO_VIEWER_URL);
      // Wait for the viewer to be available on window
      await waitForDMViewer();
    })();
  }
  return dmViewerPromise;
}

/**
 * Fire analytics event to Adobe Data Layer or console for demo
 * @param {string} type - Event type (play, pause, complete, milestone, chapterJump)
 * @param {string} assetPath - Asset path for tracking
 * @param {object} payload - Additional event data
 */
function fireAnalyticsEvent(type, assetPath, payload = {}) {
  if (window.adobeDataLayer && Array.isArray(window.adobeDataLayer)) {
    window.adobeDataLayer.push({
      event: 'videoInteraction',
      eventInfo: {
        type,
        assetPath,
        ...payload,
      },
    });
  } else {
    // For demo/debug only
    // eslint-disable-next-line no-console
    console.debug('[DM Video Analytics]', type, payload);
  }
}

/**
 * Setup analytics tracking for the video player
 * @param {object} videoViewer - DM VideoViewer instance
 * @param {string} assetIdPath - Asset ID path for tracking
 * @param {Element} chaptersContainer - Optional chapters container element
 */
function setupAnalytics(videoViewer, assetIdPath, chaptersContainer) {
  if (typeof videoViewer.getMediaPlayer !== 'function') return;

  const player = videoViewer.getMediaPlayer();
  if (!player) return;

  // HTML5-like events if available
  player.addEventListener('play', () => fireAnalyticsEvent('play', assetIdPath));
  player.addEventListener('pause', () => fireAnalyticsEvent('pause', assetIdPath));
  player.addEventListener('ended', () => fireAnalyticsEvent('complete', assetIdPath));

  // Milestone tracking (25%, 50%, 75%)
  const milestones = [0.25, 0.5, 0.75];
  const hitMilestones = new Set();

  player.addEventListener('timeupdate', () => {
    const duration = player.duration || 0;
    const currentTime = player.currentTime || 0;
    if (!duration) return;
    const progress = currentTime / duration;
    milestones.forEach((m) => {
      if (progress >= m && !hitMilestones.has(m)) {
        hitMilestones.add(m);
        fireAnalyticsEvent('milestone', assetIdPath, { milestone: m * 100 });
      }
    });
  });

  // Chapter buttons controlling playback
  if (chaptersContainer) {
    chaptersContainer.addEventListener('click', (e) => {
      const btn = e.target.closest('.dm-video-chapter');
      if (!btn) return;
      const time = parseFloat(btn.dataset.time || '0');
      try {
        player.currentTime = time;
        player.play();
        fireAnalyticsEvent('chapterJump', assetIdPath, { label: btn.textContent, time });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('Unable to seek to chapter', err);
      }
    });
  }
}

/**
 * Decorate the dm-video block.
 * @param {Element} block The block root element.
 */
export default async function decorate(block) {
  // Add a stable base class so CSS can target this reliably
  block.classList.add('dynamic-media-video');

  try {
    await loadDMVideoViewer();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to load DM VideoViewer:', error);
    block.setAttribute('data-video-loaded', 'error');
    return;
  }

  if (!window.dmviewers?.VideoViewer) {
    // eslint-disable-next-line no-console
    console.error('DM VideoViewer not available on window.dmviewers');
    block.setAttribute('data-video-loaded', 'error');
    return;
  }

  const videoLinks = block.querySelectorAll('a[href]');
  if (!videoLinks.length) {
    // Nothing to do, but hide the raw content
    Array.from(block.children).forEach((child) => {
      child.style.display = 'none';
    });
    block.setAttribute('data-video-loaded', 'error');
    return;
  }

  const videoUrl = videoLinks[0].href;
  const urnPattern = /(\/adobe\/assets\/urn:[^/]+)/i;
  const match = videoUrl.match(urnPattern);

  if (!match) {
    // eslint-disable-next-line no-console
    console.error('Invalid Dynamic Media video URL format', videoUrl);
    block.setAttribute('data-video-loaded', 'error');
    return;
  }

  // Extract the base URL (protocol + hostname)
  const videoURLObj = new URL(videoUrl);
  const baseUrl = `${videoURLObj.protocol}//${videoURLObj.hostname}`;

  // Extract the asset ID path (e.g., /adobe/assets/urn:aaid:aem:...)
  const assetIdPath = match[1];

  // Construct the URLs
  const posterImageUrl = `${baseUrl}${assetIdPath}/as/thumbnail.jpeg?preferwebp=true`;
  const dashUrl = `${baseUrl}${assetIdPath}/manifest.mpd`;
  const hlsUrl = `${baseUrl}${assetIdPath}/manifest.m3u8`;

  // Generate a stable container ID
  block.id = block.id || `dm-video-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

  // --- Read configuration from block rows (Universal Editor) or data-attributes ---
  // Universal Editor outputs fields as rows: [video, videoTitle, autoplay, loop, muted]
  // Data attributes can override: data-autoplay, data-loop, data-muted, data-controls, data-chapters

  const children = Array.from(block.children);

  // Helper to get text content from a block row by index
  const getTextFromRow = (index) => {
    const row = children[index];
    if (!row) return '';
    // Check for text in div > div > p or just div > p structure
    const textEl = row.querySelector('p') || row.querySelector('div');
    return textEl?.textContent?.trim() || row.textContent?.trim() || '';
  };

  // Helper to get boolean from data attribute or block row
  const getBoolFromDataOrRow = (attrName, rowIndex, defaultValue = false) => {
    // First check data attribute (higher priority)
    if (block.dataset[attrName] != null) {
      return String(block.dataset[attrName]).toLowerCase() === 'true';
    }
    // Fall back to block row content
    const rowValue = getTextFromRow(rowIndex);
    if (rowValue) {
      return rowValue.toLowerCase() === 'true';
    }
    return defaultValue;
  };

  // Row indices based on component model: [0: video, 1: videoTitle, 2: autoplay, 3: loop, 4: muted]
  const autoplay = getBoolFromDataOrRow('autoplay', 2, false);
  const loop = getBoolFromDataOrRow('loop', 3, false);
  const muted = getBoolFromDataOrRow('muted', 4, false);
  const showControls = block.dataset.controls != null
    ? String(block.dataset.controls).toLowerCase() === 'true'
    : true; // Default to showing controls

  // Optional: Chapters from data attribute as JSON
  // e.g. data-chapters='[{"label":"Intro","time":0},{"label":"Feature A","time":30}]'
  let chapters = [];
  if (block.dataset.chapters) {
    try {
      chapters = JSON.parse(block.dataset.chapters);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('Invalid chapters JSON on dm-video block', e);
    }
  }

  // Hide original children (link, author helper text, etc.) for a clean UI
  Array.from(block.children).forEach((child) => {
    if (!child.classList.contains('dm-video-ui')) {
      child.style.display = 'none';
    }
  });

  // --- Player container wrapper for responsive layout & overlays ---
  const wrapper = document.createElement('div');
  wrapper.className = 'dm-video-player-wrapper';

  const playerContainer = document.createElement('div');
  playerContainer.className = 'dm-video-player';
  playerContainer.id = `${block.id}-player`;

  wrapper.appendChild(playerContainer);
  block.appendChild(wrapper);

  // Optional: chapters UI container
  let chaptersContainer = null;
  if (chapters.length) {
    chaptersContainer = document.createElement('div');
    chaptersContainer.className = 'dm-video-chapters';
    chapters.forEach((chapter) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'dm-video-chapter';
      btn.textContent = chapter.label;
      btn.dataset.time = chapter.time;
      chaptersContainer.appendChild(btn);
    });
    block.appendChild(chaptersContainer);
  }

  const params = {
    posterimage: posterImageUrl,
    autoplay: autoplay ? '1' : '0',
    loop: loop ? '1' : '0',
    muted: muted ? '1' : '0',
    hidecontrolbar: showControls ? '0' : '1',
    sources: {},
  };

  if (dashUrl) params.sources.DASH = dashUrl;
  if (hlsUrl) params.sources.HLS = hlsUrl;

  try {
    block.setAttribute('data-video-loaded', 'loading');

    const videoViewer = new window.dmviewers.VideoViewer({
      containerId: playerContainer.id,
      params,
    });

    videoViewer.init();

    // Setup analytics hooks for play/pause/complete and milestone tracking
    setupAnalytics(videoViewer, assetIdPath, chaptersContainer);

    block.setAttribute('data-video-loaded', 'true');
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('Failed to initialize DM VideoViewer', e);
    block.setAttribute('data-video-loaded', 'error');
  }
}
