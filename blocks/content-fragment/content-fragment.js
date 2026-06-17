import { getMetadata } from '../../scripts/aem.js';
import { isAuthorEnvironment } from '../../scripts/scripts.js';
import { getHostname, mapAemPathToSitePath } from '../../scripts/utils.js';

/**
 *
 * @param {Element} block
 */
export default async function decorate(block) {
  // Configuration
  const CONFIG = {
    GRAPHQL_QUERY: '/graphql/execute.json/ref-demo-eds/CTAByPath',
    CF_API_PATH: '/adobe/contentFragments/byPath',
  };

  const hostnameFromPlaceholders = await getHostname();
  const hostname = hostnameFromPlaceholders || getMetadata('hostname');
  const aemauthorurl = getMetadata('authorurl') || '';
  const aempublishurl = hostname?.replace('author', 'publish')?.replace(/\/$/, '');

  const contentPath = block.querySelector(':scope div:nth-child(1) > div a')?.textContent?.trim();
  const variationname = block.querySelector(':scope div:nth-child(2) > div')?.textContent?.trim()?.toLowerCase()?.replace(' ', '_') || 'master';
  const displayStyle = block.querySelector(':scope div:nth-child(3) > div')?.textContent?.trim() || '';
  const alignment = block.querySelector(':scope div:nth-child(4) > div')?.textContent?.trim() || '';
  const ctaStyle = block.querySelector(':scope div:nth-child(5) > div')?.textContent?.trim() || 'button';

  block.innerHTML = '';
  let isAuthor = false;//isAuthorEnvironment();

  // Prepare request configuration based on environment
  const requestConfig = isAuthor
    ? {
        url: `${aemauthorurl}${CONFIG.GRAPHQL_QUERY};path=${contentPath};variation=${variationname};ts=${Date.now()}`,
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      }
    : {
        url: `${aempublishurl}${CONFIG.CF_API_PATH}?references=all-hydrated&path=${encodeURIComponent(contentPath)}`,
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      };

  try {
    // Fetch data
    const response = await fetch(requestConfig.url, {
      method: requestConfig.method,
      headers: requestConfig.headers,
    });

    if (!response.ok) {
      console.error(`Error making CF request: ${response.status}`, {
        contentPath,
        variationname,
        isAuthor,
      });
      block.innerHTML = '';
      return;
    }

    let responseData;
    try {
      responseData = await response.json();
    } catch (parseError) {
        console.error('Error parsing CF JSON response:', {
        error: parseError.message,
        contentPath,
        variationname,
        isAuthor,
      });
      block.innerHTML = '';
      return;
    }

    // Normalize data from different response structures (author vs publish)
    let cfData;
    let imgUrl;

    if (isAuthor) {
      // Author: GraphQL response structure
      cfData = responseData?.data?.ctaByPath?.item;
      if (!cfData) {
        console.error('Error parsing GraphQL response - no valid data found', {
          response: responseData,
          contentPath,
          variationname,
        });
        block.innerHTML = '';
        return;
      }
      imgUrl = cfData.bannerimage?._authorUrl;
    } else {
      // Publish: CF API response structure
      if (!responseData?.fields) {
        console.error('Error parsing CF API response - no valid data found', {
          response: responseData,
          contentPath,
        });
        block.innerHTML = '';
        return;
      }
      // Map publish response to normalized structure
      const { fields, references } = responseData;
      cfData = {
        title: fields.title,
        subtitle: fields.subtitle,
        description: { plaintext: fields.description?.value || '' },
        ctalabel: fields.ctalabel,
        ctaurl: fields.ctaurl,
      };
      // Resolve image URL from references
      const imageUrn = fields.bannerimage;
      if (imageUrn && references?.[imageUrn]?.value?.path) {
        imgUrl = `${aempublishurl}${references[imageUrn].value.path}`;
      }
    }

    // Set up block attributes
    const itemId = `urn:aemconnection:${contentPath}/jcr:content/data/${variationname}`;
    block.setAttribute('data-aue-type', 'container');

    // Determine the layout style
    const isImageLeft = displayStyle === 'image-left';
    const isImageRight = displayStyle === 'image-right';
    const isImageTop = displayStyle === 'image-top';
    const isImageBottom = displayStyle === 'image-bottom';

    // Set background image and styles based on layout
    let bannerContentStyle = '';
    let bannerDetailStyle = '';

    if (isImageLeft || isImageRight || isImageTop || isImageBottom) {
      bannerContentStyle = `background-image: url(${imgUrl});`;
    } else {
      // Default layout: image as background with gradient overlay
      bannerDetailStyle = `background-image: linear-gradient(90deg,rgba(0,0,0,0.6), rgba(0,0,0,0.1) 80%) ,url(${imgUrl});`;
    }

    // Derive CTA href: supports author-side paths/URLs and publish/EDS URLs
    let ctaHref = '#';
    const cta = cfData?.ctaurl;
    if (cta) {
      if (typeof cta === 'string') {
        ctaHref = /^https?:\/\//i.test(cta) ? cta : `${isAuthor ? (aemauthorurl || '') : (aempublishurl || '')}${cta}`;
      } else if (typeof cta === 'object') {
        const authorUrl = cta._authorUrl;
        const pathOnly = cta._path;
        if (isAuthor) {
          ctaHref = authorUrl || (pathOnly ? `${aemauthorurl || ''}${pathOnly}` : '#');
        } else {
          ctaHref = pathOnly;
        }
      }
    }

    // Map content paths to site-relative paths using paths.json on live
    if (!isAuthor) {
      try {
        let candidate = ctaHref;
        if (/^https?:\/\//i.test(candidate)) {
          const u = new URL(candidate);
          candidate = u.pathname;
        }
        if (candidate && candidate.startsWith('/content/')) {
          const mapped = await mapAemPathToSitePath(candidate);
          if (mapped) ctaHref = mapped;
        }
      } catch (e) {
        console.warn('Failed to map CTA via paths.json', e);
      }
    }

    block.innerHTML = `<div class='banner-content block ${displayStyle}' data-aue-resource=${itemId} data-aue-label=${variationname || 'Elements'} data-aue-type="reference" data-aue-filter="contentfragment" style="${bannerContentStyle}">
      <div class='banner-detail ${alignment}' style="${bannerDetailStyle}" data-aue-prop="bannerimage" data-aue-label="Main Image" data-aue-type="media">
        <h2 data-aue-prop="title" data-aue-label="Title" data-aue-type="text" class='cftitle'>${cfData?.title || ''}</h2>
        <h3 data-aue-prop="subtitle" data-aue-label="SubTitle" data-aue-type="text" class='cfsubtitle'>${cfData?.subtitle || ''}</h3>
        <div data-aue-prop="description" data-aue-label="Description" data-aue-type="richtext" class='cfdescription'><p>${cfData?.description?.plaintext || ''}</p></div>
        <p class="button-container ${ctaStyle}">
          <a href="${ctaHref}" data-aue-prop="ctaurl" data-aue-label="Button Link/URL" data-aue-type="reference" target="_blank" rel="noopener" data-aue-filter="page" class='button'>
            <span data-aue-prop="ctalabel" data-aue-label="Button Label" data-aue-type="text">${cfData?.ctalabel || ''}</span>
          </a>
        </p>
      </div>
      <div class='banner-logo'></div>
    </div>`;
  } catch (error) {
    console.error('Error rendering content fragment:', {
      error: error.message,
      stack: error.stack,
      contentPath,
      variationname,
      isAuthor,
    });
    block.innerHTML = '';
  }
}
