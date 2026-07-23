import { createOptimizedPicture } from '../../scripts/aem.js';
import { moveInstrumentation } from '../../scripts/scripts.js';

export default function decorate(block) {
  const ul = document.createElement('ul');
  [...block.children].forEach((row) => {
    const li = document.createElement('li');

    // Field order (by model): 0=image, 1=text, 2=ctalabel, 3=ctalink, 4=ctastyle
    const ctaLabelDiv = row.children[2];
    const ctaLabel = ctaLabelDiv?.querySelector('p')?.textContent?.trim()
      || ctaLabelDiv?.textContent?.trim() || '';

    const ctaLinkDiv = row.children[3];
    const ctaLinkAnchor = ctaLinkDiv?.querySelector('a');
    const ctaLink = ctaLinkAnchor?.getAttribute('href')
      || ctaLinkDiv?.querySelector('p')?.textContent?.trim()
      || ctaLinkDiv?.textContent?.trim() || '';

    const ctaStyleDiv = row.children[4];
    const ctaStyle = ctaStyleDiv?.querySelector('p')?.textContent?.trim()
      || ctaStyleDiv?.textContent?.trim() || 'button';

    moveInstrumentation(row, li);
    while (row.firstElementChild) li.append(row.firstElementChild);

    // Process the li children
    [...li.children].forEach((div, index) => {
      if (index === 0) {
        div.className = 'cards-card-image';
      } else if (index === 1) {
        div.className = 'cards-card-body';
      } else {
        // Hide config divs (ctalabel, ctalink, ctastyle)
        div.className = 'cards-config';
        div.style.display = 'none';
      }
    });

    // Render CTA button from label + link fields
    if (ctaLabel && ctaLink) {
      const bodyDiv = li.querySelector('.cards-card-body');
      if (bodyDiv) {
        const ctaContainer = document.createElement('p');
        ctaContainer.className = `button-container cta-${ctaStyle}`;
        const anchor = document.createElement('a');
        anchor.className = 'button';
        anchor.href = ctaLink;
        anchor.title = ctaLabel;
        anchor.textContent = ctaLabel;
        ctaContainer.appendChild(anchor);
        bodyDiv.appendChild(ctaContainer);
      }
    }
    
    ul.append(li);
  });
  ul.querySelectorAll('picture > img').forEach((img) => {
    const optimizedPic = createOptimizedPicture(img.src, img.alt, false, [{ width: '750' }]);
    moveInstrumentation(img, optimizedPic.querySelector('img'));
    img.closest('picture').replaceWith(optimizedPic);
  });
 
  block.textContent = '';
  block.append(ul);
}
