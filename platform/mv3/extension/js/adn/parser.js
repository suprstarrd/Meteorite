/*******************************************************************************
    AdNauseam MV3 - Content script ad parser
    Simplified version of parser.js for MV3
    
    This script gets injected by uBlock Lite's registerInjectables()
    It queries the DOM using cosmetic filter selectors
*******************************************************************************/

(function() {
  'use strict';
  
  // Check if already injected
  if (window.adnParserInjected) return;
  window.adnParserInjected = true;
  
  console.log('[ADN Parser] Loaded on:', window.location.hostname);
  
  // This will be populated by uBlock's cosmetic filter system
  // We piggyback on the selectors that uBlock already uses for hiding
  let adSelectors = [];

  const imgSelectors = [
    'img',
    'amp-img',
    '.cropped-image-intermedia-box',
    '.imageholder'
  ];

  const titleSelectors = [
    '[data-title-id]',
    '.title',
    'h1',
    'h2',
    'h3',
    'h4'
  ];
  
  // Extract ad data from element
  function extractAdData(element) {
    const data = {
      targetUrl: null,
      imgSrc: null,
      imgWidth: -1,
      imgHeight: -1,
      text: '',
      title: ''
    };
    
    // Find target URL
    const clickable = findClickableParent(element);
    if (clickable) {
      if (clickable.hasAttribute('href')) {
        data.targetUrl = clickable.getAttribute('href');
      } else if (clickable.hasAttribute('onclick')) {
        data.targetUrl = parseOnClick(clickable.getAttribute('onclick'));
      }
    }
    
    if (!data.targetUrl) return null;
    
    // Make absolute URL
    if (data.targetUrl.indexOf('http') !== 0) {
      if (data.targetUrl.indexOf('//') === 0) {
        data.targetUrl = window.location.protocol + data.targetUrl;
      } else if (data.targetUrl.indexOf('/') === 0) {
        data.targetUrl = window.location.origin + data.targetUrl;
      } else {
        data.targetUrl = window.location.origin + '/' + data.targetUrl;
      }
    }
    
    // Find image
    const img = element.querySelector(imgSelectors.join(', '));
    if (img) {
      data.imgSrc = img.src || img.getAttribute('src') || img.dataset.src;
      data.imgWidth = img.naturalWidth || parseInt(img.getAttribute('width')) || img.clientWidth;
      data.imgHeight = img.naturalHeight || parseInt(img.getAttribute('height')) || img.clientHeight;
    }
    
    // Check background image
    if (!data.imgSrc) {
      const bgImage = getBackgroundImageUrl(element);
      if (bgImage) {
        data.imgSrc = bgImage;
        data.imgWidth = element.clientWidth;
        data.imgHeight = element.clientHeight;
      }
    }
    
    // Extract text and title
    data.text = element.textContent.trim().substring(0, 100);
    const titleEl = element.querySelector(titleSelectors);
    if (titleEl) {
      data.title = titleEl.textContent.trim();
    }
    
    // Validate dimensions
    if (data.imgWidth > 0 && data.imgHeight > 0) {
      const minDim = Math.min(data.imgWidth, data.imgHeight);
      const maxDim = Math.max(data.imgWidth, data.imgHeight);
      if (minDim < 31 || maxDim < 65) {
        return null; // Too small
      }
    }
    
    return data;
  }
  
  // Check if onclick attribute contains a valid URL
  function onclickHasUrl(onclickStr) {
    if (!onclickStr) return false;
    // Check for window.open with URL
    if (/window\.open\(['"]https?:\/\//i.test(onclickStr)) return true;
    // Check for location.href assignment
    if (/location\.href\s*=\s*['"]https?:\/\//i.test(onclickStr)) return true;
    // Check for any http(s) URL in the string
    if (/https?:\/\/[^\s'"]+/i.test(onclickStr)) return true;
    return false;
  }

  // Find clickable parent
  function findClickableParent(node) {
    let checkNode = node;
    let depth = 0;
    while (checkNode && checkNode.nodeType === 1 && depth < 10) {
      if (checkNode.tagName === 'A' || checkNode.hasAttribute('href')) {
        return checkNode;
      }
      // Only consider onclick if it contains a valid URL
      if (checkNode.hasAttribute('onclick') && onclickHasUrl(checkNode.getAttribute('onclick'))) {
        return checkNode;
      }
      checkNode = checkNode.parentNode;
      depth++;
    }
    return null;
  }
  
  // Extract URL from background-image
  function getBackgroundImageUrl(element) {
    const style = window.getComputedStyle(element);
    const bgImage = style.backgroundImage || style.background;
    
    if (bgImage && bgImage !== 'none') {
      const match = bgImage.match(/url\(['"]?([^'"]+)['"]?\)/);
      if (match && match[1]) {
        return match[1];
      }
    }
    return null;
  }
  
  // Parse onclick handler
  function parseOnClick(onclickStr) {
    if (!onclickStr) return null;
    
    const openMatch = /window\.open\(['"]([^'"]+)['"]/i.exec(onclickStr);
    if (openMatch && openMatch[1]) {
      return openMatch[1];
    }
    
    const urlMatch = /(https?:\/\/[^\s'"]+)/i.exec(onclickStr);
    if (urlMatch && urlMatch[1]) {
      return urlMatch[1];
    }
    
    return null;
  }
  
  // Process elements matching cosmetic filters
  // This is called by uBlock's cosmetic filter injection
  function processElements() {
    // Hook into uBlock's cosmetic filter mechanism
    // uBlock hides elements matching these selectors
    // We collect them as ads before they're hidden
    
    // Common ad selectors (fallback if we can't hook into uBlock)
    const defaultSelectors = [
      '.ad',
      '.advertisement', 
      '[data-ad]',
      '.sponsored',
      '.pla-unit',
      '.clickable-card',
      '.GoogleActiveViewElement'
    ];
    
    const selectorStr = defaultSelectors.join(', ');
    
    try {
      const elements = document.querySelectorAll(selectorStr);
      
      elements.forEach(element => {
        // Skip if already processed
        // if (element.hasAttribute('data-adn-processed')) return;
        element.setAttribute('data-adn-processed', 'true');
        
        const adData = extractAdData(element);
        if (adData && adData.targetUrl) {
          const ad = {
            id: `ad-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            pageUrl: window.location.href,
            pageDomain: window.location.hostname,
            foundTs: Date.now(),
            ...adData
          };
          
          console.log('[ADN Parser] Found ad:', ad);
          
          // Send to background
          chrome.runtime.sendMessage({
            what: 'adFound',
            ad: ad
          }).catch(err => {
            console.warn('[ADN Parser] Failed to send ad:', err);
          });
        }
      });
    } catch (error) {
      console.error('[ADN Parser] Error processing elements:', error);
    }
  }
  
  // Run on page load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', processElements);
  } else {
    processElements();
  }
  
  // Also run periodically for dynamic content
  setInterval(processElements, 5000);
  
  // Observe DOM changes
  const observer = new MutationObserver((mutations) => {
    // Debounce: only process after 500ms of no mutations
    clearTimeout(observer.timer);
    observer.timer = setTimeout(processElements, 500);
  });
  
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });
  
  console.log('[ADN Parser] Ready and observing DOM');
})();