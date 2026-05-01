/*******************************************************************************

    AdNauseam - Fight back against advertising surveillance.
    Copyright (C) 2014-2024 Daniel C. Howe

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see {http://www.gnu.org/licenses/}.

    Home: https://github.com/dhowe/AdNauseam
*/

(function () {

  'use strict';

  if (typeof vAPI !== 'object') return; // injection failed

  if (typeof vAPI.adCheck === 'function') return;

  vAPI.adCheck = function (elem) {
    if (typeof vAPI.adParser === 'undefined') {
      vAPI.adParser = createParser();
    }
    elem && vAPI.adParser.process(elem);
  }
  

  const ignorableImages = ['mgid_logo_mini_43x20.png', 'data:image/gif;base64,R0lGODlh7AFIAfAAAAAAAAAAACH5BAEAAAAALAAAAADsAUgBAAL+hI+py+0Po5y02ouz3rz7D4biSJbmiabqyrbuC8fyTNf2jef6zvf+DwwKh8Si8YhMKpfMpvMJjUqn1Kr1is1qt9yu9wsOi8fksvmMTqvX7Lb7DY/L5/S6/Y7P6/f8vv8PGCg4SFhoeIiYqLjI2Oj4CBkpOUlZaXmJmam5ydnp+QkaKjpKWmp6ipqqusra6voKGys7S1tre4ubq7vL2+v7CxwsPExcbHyMnKy8zNzs/AwdLT1NXW19jZ2tvc3d7f0NHi4+Tl5ufo6err7O3u7+Dh8vP09fb3+Pn6+/z9/v/w8woMCBBAsaPIgwocKFDBs6fAgxosSJFCtavIgxo8b+jRw7evwIMqTIkSRLmjyJMqXKlSxbunwJM6bMmTRr2ryJM6fOnTx7+vwJNKjQoUSLGj2KNKnSpUybOn0KNarUqVSrWr2KNavWrVy7ev0KNqzYsWTLmj2LNq3atWzbun0LN67cuXTr2r2LN6/evXz7+v0LOLDgwYQLGz6MOLHixYwbO34MObLkyZQrW76MObPmzZw7e/4MOrTo0aRLmz6NOrXq1axbu34NO7bs2bRr276NO7fu3bx7+/4NPLjw4cSLGz+OPLny5cybO38OPbr06dSrW7+OPbv27dy7e/8OPrz48eTLmz+PPr369ezbu38PP778+fTr27+PP7/+/fxR+/v/D2CAAg5IYIEGHohgggouyGCDDj4IYYQSTkhhhRZeiGGGGm7IYYcefghiiCKOSGKJJp6IYooqrshiiy6+CGOMMs5IY4023ohjjjruCFYBADs='];
  const ocRegex = /((([A-Za-z]{3,9}:(?:\/\/)?)(?:[-;:&=\+\$,\w]+@)?[A-Za-z0-9.-]+|(?:www.|[-;:&=\+\$,\w]+@)[A-Za-z0-9.-]+)((?:\/[\+~%\/.\w-_]*)?\??(?:[-\+=&;%@.\w_]*)#?(?:[\w]*))?)/gi;
  const urlRegex = /(?:(?:https?|ftp|file):\/\/|www\.|ftp\.)(?:\([-A-Z0-9+&@#\/%=~_|$?!:,.]*\)|[-A-Z0-9+&@#\/%=~_|$?!:,.])*(?:\([-A-Z0-9+&@#\/%=~_|$?!:,.]*\)|[A-Z0-9+&@#\/%=~_|$])/igm;

  const imgSelectors = [
    'img',
    'amp-img',
    'picture',
    'picture > source[srcset]',
    'img[srcset]',
    '.cropped-image-intermedia-box',
    '.imageholder',
    '[data-imgsrc]',
    '[data-src]',
    '[data-lazy-src]',
    '[data-original]',
    '[data-original-src]',
    '[data-bgset]',
    '[data-background-image]',
    '[data-thumb]',
    '[data-thumbnail]',
    '[data-image-url]',
    '[data-image]',
    '.posterImage-link'
  ];

  const createParser = function () {

    const findImageAds = function (imgs) {

      let hits = 0;
      for (let i = 0; i < imgs.length; i++) {
        logP('[FIND-IMG] Processing image ' + i + ' of ' + imgs.length);
        if (processImage(imgs[i])) hits++;
      }

      if (hits < 1) {
        logP('[FIND-IMG] No (loaded) image Ads found in ' + imgs.length + ' images');
        return false
      } else {
        logP('[FIND-IMG] Found ' + hits + ' image ads');
        return true
      }
    };

    const findVideoAds = function (elements) {
      
      let hits = 0;
      for (let i = 0; i < elements.length; i++) {
        logP('[FIND-VIDEO] Processing video ' + i + ' of ' + elements.length);
        if (processVideo(elements[i])) hits++;
      }

      if (hits < 1) {
        logP('[FIND-VIDEO] No (loaded) video Ads found in ' + elements.length + ' videos');
      } else {
        logP('[FIND-VIDEO] Found ' + hits + ' video ads');
        return true
      }
    };
    

    const getSrcFromAttribute = function (attribute) {
      let src = attribute.match(/\((.*?)\)/);
      if (src && src.length > 1) src = src[1].replace(/('|")/g, '');
      return src
    }

    // Parse srcset attribute and return the best (largest) image URL
    const parseSrcset = function (srcset) {
      if (!srcset) return null;
      // srcset format: "url1 300w, url2 600w" or "url1 1x, url2 2x"
      const candidates = srcset.split(',').map(function(s) { return s.trim(); });
      let bestUrl = null;
      let bestSize = 0;
      for (let i = 0; i < candidates.length; i++) {
        const parts = candidates[i].split(/\s+/);
        if (parts.length >= 1 && parts[0]) {
          const url = parts[0];
          let size = 1;
          if (parts.length > 1) {
            const descriptor = parts[1];
            const num = parseFloat(descriptor);
            if (!isNaN(num)) size = num;
          }
          if (size >= bestSize) {
            bestSize = size;
            bestUrl = url;
          }
        }
      }
      return bestUrl;
    }

    const extractUrlSrc = function (attribute) {
      let src = attribute.match(urlRegex)
      return src && src[0] ;
    } 

    const findBgImage = function (elem) {
      logP("[BG-IMG] Finding background image on", elem.tagName, elem.id, elem.className)
      // Try inline style first, then computed style
      var attribute = elem.style.backgroundImage || elem.style.background;
      if (!attribute || attribute === 'none') {
        const computedStyle = getComputedStyle(elem);
        attribute = computedStyle.backgroundImage || computedStyle.background;
      }
      
      if (!attribute || attribute === 'none') {
        logP('[BG-IMG] FAIL: No background-image found on element');
        return;
      }
      
      logP('[BG-IMG] Found background attribute:', attribute.substring(0, 100))
      
      // Check for clickable parent OR clickable child
      const clickable = clickableParent(elem) || clickableChild(elem);
      if (!clickable) {
        logP('[BG-IMG] FAIL: No clickable parent or child found');
        return;
      }
      logP('[BG-IMG] Found clickable:', clickable.tagName)
      
      if (attribute && attribute !== 'none' && clickable) {
        const targetUrl = getTargetUrlFromClickable(clickable);
        if (attribute && targetUrl) {
          // create Image element for ad size
          const img = document.createElement("img");
          const src = getSrcFromAttribute(attribute);
          if (!src) {
            logP("Fail: no src found in background attribute", attribute);
            return;
          }
          img.src = src
          
          return createImageAd(img, src, targetUrl);
        } else {
          // No targetUrl from main element, check children with background-image
          var bgElements = elem.querySelector("[style*='background-image'], [style*='background']")
          if (bgElements) {
            // Try inline style first, then computed style for child element
            attribute = bgElements.style.backgroundImage || bgElements.style.background;
            if (!attribute || attribute === 'none') {
              const computedStyle = getComputedStyle(bgElements);
              attribute = computedStyle.backgroundImage || computedStyle.background;
            }
            if (attribute && attribute !== 'none') {
              const childClickable = clickableParent(bgElements) || clickableChild(bgElements);
              const childTargetUrl = childClickable ? getTargetUrlFromClickable(childClickable) : null;
              if (childTargetUrl) {
                const img = document.createElement("img");
                const src = getSrcFromAttribute(attribute);
                if (src) {
                  img.src = src
                  return createImageAd(img, src, childTargetUrl);
                }
              }
            }
          }
        }
      }
    };

    const pageCount = function (ads, pageUrl) {

      let num = 0;
      for (let i = 0; i < ads.length; i++) {
        if (ads[i].pageUrl === pageUrl)
          num++;
      }
      return num;
    };

    // Data attributes commonly used as click targets by ad networks
    const dataClickAttrs = ['data-href', 'data-url', 'data-link', 'data-click-url', 'data-target-url', 'data-beacon'];

    const clickableParent = function (node) {
    let checkNode = node;
    let depth = 0;
    while (checkNode && checkNode.nodeType === 1 && depth < 15) {
      if (checkNode.tagName === 'A' || checkNode.hasAttribute('href')) {
        return checkNode;
      }
      // Only consider onclick if it contains a valid URL
      if (checkNode.hasAttribute('onclick') && onclickHasUrl(checkNode.getAttribute('onclick'))) {
        return checkNode;
      }
      // Check data-href, data-url, data-link, etc.
      for (let i = 0; i < dataClickAttrs.length; i++) {
        if (checkNode.hasAttribute(dataClickAttrs[i])) {
          logP('[URL] Found data click attribute:', dataClickAttrs[i], checkNode.getAttribute(dataClickAttrs[i])?.substring(0, 50));
          return checkNode;
        }
      }
      checkNode = checkNode.parentNode;
      depth++;
    }
    return null;
  }

    // Find clickable element within a node (child anchor tags)
    const clickableChild = function (node) {
      if (!node || node.nodeType !== 1) return null;
      // First check if the node itself is clickable
      if (node.tagName === 'A' || node.hasAttribute('href')) {
        return node;
      }
      // Check if the node itself has data click attributes
      for (let i = 0; i < dataClickAttrs.length; i++) {
        if (node.hasAttribute(dataClickAttrs[i])) {
          return node;
        }
      }
      // Look for anchor tags within the element
      const anchors = node.querySelectorAll('a[href]');
      if (anchors.length > 0) {
        return anchors[0]; // Return the first clickable child
      }
      // Check for children with data click attributes
      const dataClickSelector = dataClickAttrs.map(function(a) { return '[' + a + ']'; }).join(', ');
      const dataClickEls = node.querySelectorAll(dataClickSelector);
      if (dataClickEls.length > 0) {
        logP('[URL] Found child with data click attribute:', dataClickEls[0].tagName);
        return dataClickEls[0];
      }
      // Check for elements with onclick handlers containing URLs
      const clickables = node.querySelectorAll('[onclick]');
      for (let i = 0; i < clickables.length; i++) {
        if (onclickHasUrl(clickables[i].getAttribute('onclick'))) {
          return clickables[i];
        }
      }
      return null;
    }

    // Helper to check if onclick attribute contains a URL
    const onclickHasUrl = function (onclick) {
      if (!onclick) return false;
      return urlRegex.test(onclick) || ocRegex.test(onclick);
    }

    const Ad = function (network, targetUrl, data) {

      this.id = null;
      this.attempts = 0;
      this.visitedTs = 0; // 0=unattempted, -timestamp=err, +timestamp=ok
      this.attemptedTs = 0;
      this.contentData = data;
      this.contentType = data.src ? 'img' : 'text';
      this.title = data.title || 'Pending';
      this.foundTs = +new Date();
      this.targetUrl = targetUrl;
      this.pageTitle = null;
      this.pageUrl = null;
    };

    const REPROCESS_DELAY = 5000; // 10 seconds in milliseconds

    const canProcess = function (elem) {
      const lastProcessed = elem.getAttribute('process-adn');
      if (!lastProcessed) return true;
      const elapsed = Date.now() - parseInt(lastProcessed, 10);
      return elapsed >= REPROCESS_DELAY;
    }

    const markProcessed = function (elem) {
      elem.setAttribute('process-adn', Date.now().toString());
    }

    const processImage = function (img) {

      logP('[IMG] Starting processImage for', img.tagName, 'src:', img.src?.substring(0, 50));

      if (!canProcess(img)) {
        logP('[IMG] SKIP: Image recently processed (within REPROCESS_DELAY)', img);
        return false;
      }
      markProcessed(img);

      var src = img.src || img.getAttribute("src") || img.getAttribute("data-src") || img.getAttribute("data-bgset") || img.getAttribute("data-imgsrc");

      // Handle <picture> element: get the displayed <img> inside it or first <source srcset>
      if (!src && img.tagName === 'PICTURE') {
        const innerImg = img.querySelector('img');
        if (innerImg) {
          src = innerImg.currentSrc || innerImg.src || innerImg.getAttribute('src');
          logP('[IMG] Got src from <picture> > <img>:', src?.substring(0, 60));
          // Use the inner img for dimension checking later
          if (src) img = innerImg;
        }
        if (!src) {
          const source = img.querySelector('source[srcset]');
          if (source) {
            src = parseSrcset(source.getAttribute('srcset'));
            logP('[IMG] Got src from <picture> > <source srcset>:', src?.substring(0, 60));
          }
        }
      }

      // Handle <source> element directly (from querySelectorAll matching 'picture > source[srcset]')
      if (!src && img.tagName === 'SOURCE' && img.hasAttribute('srcset')) {
        src = parseSrcset(img.getAttribute('srcset'));
        logP('[IMG] Got src from <source srcset>:', src?.substring(0, 60));
        // Navigate to parent picture's img for dimensions
        if (img.parentElement && img.parentElement.tagName === 'PICTURE') {
          const innerImg = img.parentElement.querySelector('img');
          if (innerImg) img = innerImg;
        }
      }

      // Fallback: check srcset attribute on <img> itself
      if (!src && img.getAttribute && img.getAttribute('srcset')) {
        src = parseSrcset(img.getAttribute('srcset'));
        logP('[IMG] Got src from img srcset:', src?.substring(0, 60));
      }

      // Fallback: check native ad data attributes
      if (!src) {
        src = img.getAttribute('data-thumb') || img.getAttribute('data-thumbnail') 
          || img.getAttribute('data-image-url') || img.getAttribute('data-image')
          || img.getAttribute('data-lazy-src') || img.getAttribute('data-original')
          || img.getAttribute('data-original-src');
        if (src) logP('[IMG] Got src from native ad data attribute:', src.substring(0, 60));
      }

      // ignore this element which only server to generate div size. It is a transparent png image. Fixing https://github.com/dhowe/AdNauseam/issues/1843
      if (img.className === 'i-amphtml-intrinsic-sizer') {
        logP("[IMG] FILTERED: transparent fake detection from AMP-IMG", img);
        return;
      }

      if (!src && img.dataset.src) { // try to get data-src which is the case for some images
        let data_src = img.dataset.src
        logP('[IMG] Found data-src attribute:', data_src?.substring(0, 50));
        src = (data_src.indexOf("http://") == 0 || data_src.indexOf("https://") == 0) ? data_src : window.location.host + data_src
      }

      if (!src) { // no image src
        logP('[IMG] No standard src found, checking background-image');
        // try to get from background-image style
        let attribute = img.style.backgroundImage || img.style.background;
        if (!attribute || attribute === 'none') {
          const computedStyle = getComputedStyle(img);
          attribute = computedStyle.backgroundImage || computedStyle.background;
          logP('[IMG] Computed style background:', attribute?.substring(0, 80));
          src = extractUrlSrc(attribute);
        }
      }
      
      if (!src) return warnP("[IMG] FAIL: No image src found anywhere", img);

      logP('[IMG] Found src:', src.substring(0, 80));

      let targetUrl = getTargetUrl(img);

      if (!targetUrl) {
        logP('[IMG] FAIL: No target URL found for image');
        return;
      }

      logP('[IMG] Found target URL:', targetUrl.substring(0, 80));

      // we have an image and a click-target now 
      // OR the image is from type AMP-IMG which doesn't have a "complete parameter", so we let it go through... https://github.com/dhowe/AdNauseam/issues/1843
      if (img.complete || img.tagName === "AMP-IMG" ) {
        logP('[IMG] Image complete or AMP-IMG, processing immediately');
        // process the image now
        return createImageAd(img, src, targetUrl);

      } else {
        logP('[IMG] Image not loaded yet, waiting for onload event');
        // wait for loading to finish
        img.onload = function () {
          logP('[IMG] Image onload fired, now creating ad');
          // can't return true here, so findImageAds() will still report
          // 'No Ads found' for the image, but a hit will be still be logged
          // in createImageAd() below
          createImageAd(img, src, targetUrl);
        }
      }
    }

    // Get URL from a known clickable element
    const getTargetUrlFromClickable = function (target) {
      const loc = window.location;
      let targetUrl;

      if (!target) return null;

      if (target.hasAttribute('href')) {
        targetUrl = target.getAttribute("href");

        // do we have a relative url
        if (targetUrl && targetUrl.indexOf("/") === 0) {
          // in case the ad is from an iframe
          if (target.hasAttribute('data-original-click-url')) {
            const targetDomain = parseDomain(target.getAttribute("data-original-click-url"));
            const proto = window.location.protocol || 'http';
            targetUrl = normalizeUrl(proto, targetDomain, targetUrl);
          }
        }
      } else if (target.hasAttribute('onclick')) {
        const onclickInfo = target.getAttribute("onclick");
        if (onclickInfo && onclickInfo.length) {
          targetUrl = parseOnClick(onclickInfo, loc.hostname, loc.protocol);
        }
      }

      // Fallback: check data click attributes (data-href, data-url, data-link, etc.)
      if (!targetUrl) {
        for (let i = 0; i < dataClickAttrs.length; i++) {
          const val = target.getAttribute(dataClickAttrs[i]);
          if (val && val.length > 1) {
            logP('[URL] Extracted URL from ' + dataClickAttrs[i] + ':', val.substring(0, 60));
            targetUrl = val;
            break;
          }
        }
      }

      return targetUrl;
    }

    const getTargetUrl = function (elem) {

      // Check for clickable parent first, then clickable child
      const target = clickableParent(elem);
      if (!target) {
        logP('[URL] No clickable parent found, checking for clickable child');
      } else {
        logP('[URL] Found clickable parent:', target.tagName, target.getAttribute('href')?.substring(0, 50));
      }
      
      const childTarget = !target ? clickableChild(elem) : null;
      if (childTarget && !target) {
        logP('[URL] Found clickable child:', childTarget.tagName, childTarget.getAttribute('href')?.substring(0, 50));
      } else if (!target && !childTarget) {
        logP('[URL] No clickable child found either');
      }
      
      const finalTarget = target || childTarget;
      let targetUrl;

      if (!finalTarget) { // no clickable parent or child
        logP("[URL] FAIL: No ClickableParent or ClickableChild found", 'elem:', elem.tagName, 'parent:', elem.parentNode?.tagName);
        return;
      }

      targetUrl = getTargetUrlFromClickable(finalTarget);

      if (!targetUrl) { // no clickable tag in our target
        logP("[URL] FAIL: No URL from clickable target (no href or onclick with URL)", 'target:', finalTarget.tagName, 'onclick:', finalTarget.getAttribute('onclick')?.substring(0, 50));
        return warnP("Fail: no href for anchor", finalTarget, elem);
      }

      logP('[URL] Successfully extracted target URL:', targetUrl.substring(0, 80));
      return targetUrl;
    }

    const createImageAd = function (el, src, targetUrl) {
      let wFallback = parseInt(el.getAttribute("width") || -1)
      let hFallback = parseInt(el.getAttribute("height") || -1)
      
      const iw = el.naturalWidth || wFallback || el.getAttribute("clientWidth");
      const ih = el.naturalHeight || hFallback || el.getAttribute("clientHeight");
      const minDim = Math.min(iw, ih);
      const maxDim = Math.max(iw, ih);

      logP('[IMG-AD] Creating image ad: size=' + iw + 'x' + ih + ', src=' + src.substring(0, 60) + ', url=' + targetUrl.substring(0, 60));

      function isIgnorable(imgSrc) {
        for (let i = 0; i < ignorableImages.length; i++) {
          if (imgSrc.includes(ignorableImages[i])) {
            return true;
          }
        }
        return false;
      }

      function isFacebookProfilePic(imgSrc, imgWidth) {
        // hack to avoid facebook profile pics
        return (imgSrc.includes("fbcdn.net") && // will fire if w > 0
          imgSrc.includes("scontent") && imgWidth < 150);
      }

      // Check size: require a min-size of 30X64 (if we found a size)
      // avoid collecting ad-choice logos
      if (iw > -1 && ih > -1 && (minDim < 31 || maxDim < 65)) {
        logP('[IMG-AD] FILTERED: Size too small (min=' + minDim + ', max=' + maxDim + '), minDim<31 or maxDim<65');
        return warnP('Ignoring Ad with size ' + iw + 'x' + ih + ': ', src, targetUrl);
      }

      if (isIgnorable(src)) {
        logP('[IMG-AD] FILTERED: Image in ignorable list (logo, transparent gif, etc)');
        return warnP('Ignorable image: ' + src);
      }

      if (isFacebookProfilePic(src, iw)) {
        logP('[IMG-AD] FILTERED: Facebook profile pic detected (fbcdn.net + scontent + width<150)');
        return warnP('Ignore fbProf: ' + src + ', w=' + iw);
      }

      logP('[IMG-AD] All filters passed, creating Ad object');
      let ad = createAd(document.domain, targetUrl, { src: src, width: iw, height: ih });

      if (ad) {
        logP('[PARSED] IMG-AD created successfully:', ad);
        notifyAddon(ad);
        return true;
      } else {
        logP('[IMG-AD] FAIL: createAd returned null/falsy');
        warnP("Fail: Unable to create Ad", document.domain, targetUrl, src);
      }
    }

    const processVideo = function (el) {

      logP('[VIDEO] Processing video element');

      if (!canProcess(el)) {
        logP('[VIDEO] SKIP: Recently processed (within REPROCESS_DELAY)');
        return false;
      }
      markProcessed(el);

      if (!el.hasAttribute('poster')) {
        logP('[VIDEO] FAIL: No poster attribute found', el);
        return;
      }

      logP('[VIDEO] Has poster attribute, processing as image');

      let src = el.getAttribute('poster');

      if (!src || src.length < 1 ) {
        logP('[VIDEO] FAIL: Empty poster src');
        return;
      }

      logP('[VIDEO] Poster src:', src.substring(0, 80));

      if (src.indexOf('http') === 0) {
        logP('[VIDEO] FILTERED: Internal poster URL (starts with http)');
        return; // do not internal ads for videos 
      }

      // do not collect video ads from same origin 
      var url = new URL(src)
      if (url && url.origin == window.location.origin) {
        logP('[VIDEO] FILTERED: Same-origin poster URL');
        return;
      }

      logP('[VIDEO] Poster from external domain, getting target URL');
      let targetUrl = getTargetUrl(el);

      if (!targetUrl) {
        logP('[VIDEO] FAIL: No target URL found');
        return;
      }

      logP('[VIDEO] Creating ad from video');
      return createImageAd(el, src, targetUrl);
    }

    const parseDomain = function (url, useLast) { // dup. in shared

      const domains = decodeURIComponent(url).match(/https?:\/\/[^?\/]+/g);
      return domains && domains.length ? new URL(
        useLast ? domains[domains.length - 1] : domains[0])
        .hostname : undefined;
    }

    const isValidDomain = function (v) { // dup in shared

      // from: https://github.com/miguelmota/is-valid-domain/blob/master/is-valid-domain.js
      const re = /^(?!:\/\/)([a-zA-Z0-9-]+\.){0,5}[a-zA-Z0-9-][a-zA-Z0-9-]+\.[a-zA-Z]{2,64}?$/gi;
      return v ? re.test(v) : false;
    };

    const injectAutoDiv = function (request) {
      // not used

      const count = pageCount(request.data, request.pageUrl);

      let adndiv = document.getElementById("adnauseam-count");

      if (!adndiv) {

        adndiv = document.createElement('div');
        $attr(adndiv, 'id', 'adnauseam-count');
        const body = document.getElementsByTagName("body");
        body.length && body[0].appendChild(adndiv);
        //console.log("Injected: #adnauseam-count");
      }

      $attr(adndiv, 'count', count);
    };

    const normalizeUrl = function (proto, host, url) {

      if (!url || url.indexOf('http') === 0) return url;
      if (url.indexOf('//') === 0) return proto + url;
      if (url.indexOf('/') !== 0) url = '/' + url;

      return proto + '//' + host + url;
    };

    const logP = function () {

      if (vAPI.prefs.logEvents) {
        const args = Array.prototype.slice.call(arguments);
        args.unshift('[PARSER]');
        console.log.apply(console, args);
      }
    }

    const warnP = function () {

      if (vAPI.prefs.logEvents) {
        const args = Array.prototype.slice.call(arguments);
        args.unshift('[PARSER]');
        console.warn.apply(console, args);
      }
      return false;
    }

    /******************************** API *********************************/

    const process = function (elem) {

      if (!canProcess(elem)) {
        logP(`[PROCESS] Element (${elem.tagName}) recently processed, skipping.`)
        return;
      }
      markProcessed(elem);
      logP('[PROCESS] Processing ' + elem.tagName + ' id=' + (elem.id || 'none') + ' class=' + (elem.className || 'none'));

      var tagName = elem.tagName

      switch (tagName) {
        case 'IFRAME':
          logP('[PROCESS] -> IFRAME: Adding load event listener, src=' + elem.getAttribute('src')?.substring(0, 80));
          elem.addEventListener('load', processIFrame, false);
        break;
        case 'AMP-IMG':
        case 'IMG':
          logP('[PROCESS] -> IMG/AMP-IMG: Calling findImageAds');
          findImageAds([elem]);
        break;

        case 'VIDEO':
          logP('[PROCESS] -> VIDEO: Calling findVideoAds');
          findVideoAds([elem]);
        break;
        case 'BODY':
        case 'HTML':
          logP('[PROCESS] -> BODY/HTML: Only checking background-image (not children)');
          // If element is body/html don't check children, it doens't make sense to check the whole document
          findBgImage(elem);
        break;
        default:
          logP('[PROCESS] -> DEFAULT: Checking children for images/videos/ads');
          
          var found = false
          const imgs = elem.querySelectorAll(imgSelectors.join(', '));
          logP('[PROCESS] -> Found ' + imgs.length + ' image elements matching selectors');
          if (imgs.length) {
            found = findImageAds(imgs);
            if (found) {
              logP('[PROCESS] -> Image ads found, returning');
              return;
            }
          }

          const videos = elem.querySelectorAll('video[poster]');
          logP('[PROCESS] -> Found ' + videos.length + ' video elements with poster');
          if (videos.length) {
            found = findVideoAds(videos);
            if (found) {
              logP('[PROCESS] -> Video ads found, returning');
              return;
            }
          }
        
          
          // Also try findBgImage directly on the element itself
          logP('[PROCESS] -> Checking element itself for background-image');
          if (findBgImage(elem)) {
            logP('[PROCESS] -> Background image ad found, returning');
            return;
          }

          // Check children with background-image (recursive, up to 3 levels deep)
          logP('[PROCESS] -> Checking children for background-image ads');
          const bgChildren = elem.querySelectorAll('[style*="background"]');
          if (bgChildren.length) {
            logP('[PROCESS] -> Found ' + bgChildren.length + ' children with background style');
            for (let i = 0; i < bgChildren.length; i++) {
              if (findBgImage(bgChildren[i])) {
                logP('[PROCESS] -> Background image ad found in child, returning');
                return;
              }
            }
          }

          logP('[PROCESS] -> No img/video found, checking other ad types');

          // if no img found within the element
          const googleResp = findGoogleResponsiveDisplayAd(elem);
          const googleActive = GoogleActiveViewElement(elem);
          const youtubeAd = findYoutubeTextAd(elem);
          
          if (!googleResp && !googleActive && !youtubeAd) {
            logP('[PROCESS] -> No Google/YouTube text ads found, checking vAPI.textAdParser');
          } else {
            logP('[PROCESS] -> Found special ad format (Google Responsive=' + !!googleResp + ', GoogleActive=' + !!googleActive + ', YouTube=' + !!youtubeAd + ')');
          }

          // and finally check for text ads
          logP('[PROCESS] -> Calling vAPI.textAdParser.process');
          vAPI.textAdParser.process(elem);

          // Check for child iframes and process them
          const iframes = elem.querySelectorAll('iframe');
          logP('[PROCESS] -> Found ' + iframes.length + ' child iframes to process');
          if (iframes.length) {
            for (let i = 0; i < iframes.length; i++) {
              if (canProcess(iframes[i])) {
                markProcessed(iframes[i]);
                iframes[i].addEventListener('load', processIFrame, false);
                // If iframe is already loaded, process it immediately
                if (iframes[i].contentDocument && iframes[i].contentDocument.readyState === 'complete') {
                  logP('[PROCESS] -> iframe[' + i + '] already loaded, processing immediately');
                  processIFrame.call(iframes[i]);
                } else {
                  logP('[PROCESS] -> iframe[' + i + '] not loaded yet, waiting for load event');
                }
              } else {
                logP('[PROCESS] -> iframe[' + i + '] was recently processed, skipping');
              }
            }
          }

        break;
      }
      
    };

    const GoogleActiveViewElement = function (elem) {
      // .GoogleActiveViewElement
      // -> .title a
      // -> .body a
      // -> .imageClk .image

      const googleDisplayAd = elem.querySelector('.GoogleActiveViewElement');
      if (!googleDisplayAd) return;

      let url, title, body, image

      title = elem.querySelector(".title a, [class*=title] a")
      body = elem.querySelector(".body a")
      image = elem.querySelector(".imageClk .image")
      
      if (title !== null) {
        url = title.getAttribute("href")
      } else {
        // invalid google ad
        warnP("invalid google ad, no title found.")
        return false
      }

      if ( title !== null && body !== null && url !== null) {
        if (!image) {
          // no image can be found, create text add
          const ad = vAPI.adParser.createAd('GoogleActiveViewElement', url, {
            title: $text(title),
            text: $text(body),
            title: $text(title)
          });
          
          if (ad) {
            logP("[PARSED] TEXT-AD" + ad);
            vAPI.adParser.notifyAddon(ad);
          }
        }
        return true
      } else {
        warnP("invalid google ad, element missing")
        // invalid google ad
        return false
      }
    } 

    const findYoutubeTextAd = function (elem) {
      if (!location.href.includes("youtube.com")){
        return // youtube specific ad banners 
      }
      const youtubeAd = document.querySelector('ytd-promoted-sparkles-web-renderer #sparkles-container');
      if (!youtubeAd) {
        // console.log("[PARSER] no youtubeAd", youtubeAd)
        return;
      }

      logP("[Parser] Youtube Banner Ad Detected")

      const img = youtubeAd.querySelector('yt-img-shadow img');
      const title = youtubeAd.querySelector('#title').innerText;
      const text = youtubeAd.querySelector('#description').innerText;
      const link = youtubeAd.querySelector('#website-text').innerText
      var targetURL = ""
      if (img) {
        var src = img.src
        targetURL = "http://" + link;
        if (img && src && targetURL) {
          createImageAd(img, src, targetURL);
        } else {
          logP("[Google Responsive Display Ad] Can't find element", img, src, targetURL);
        }
      }
      // vAPI.textAdParser.youtubeAds(youtubeAd)
    }

    const findGoogleResponsiveDisplayAd = function (elem) {
      
      // a#mys-content href
      //   div.GoogleActiveViewElement
      //   -> canvas.image background-Image
      //   -> div.title
      //   -> div.row-container > .body

      const googleDisplayAd = elem.querySelector('.GoogleActiveViewElement');
      if (!googleDisplayAd) return false;

      logP("[Parser] Google Responsive Display Ad")

      const img = googleDisplayAd.querySelector('canvas.image');
      const title = googleDisplayAd.querySelector('.title > a');
      const text = googleDisplayAd.querySelector('.body > a');
      
      let targetURL;

      if (img) {

        // img case
        let src, link;

        // check for link element
        if (elem.tagName == "A" && elem.id == "mys-content") {
          link = elem;
        } else {
          link = elem.querySelector('a#mys-content');
        }

        // try to get the targetURL
        if (link && link.hasAttribute("href")) {
          targetURL = link.getAttribute("href");          
        } else if (title && title.hasAttribute("href")) {
          // if cant get link element, try to get it from the title
          targetURL = title.getAttribute("href")
        } else {
          const clickableElement = img;
          // if no href, fake click event
          if (document.createEvent) {
            const ev = document.createEvent('HTMLEvents');
            ev.initEvent('mousedown', true, false);
            clickableElement.dispatchEvent(ev);
          }
        }

        const attribute = getComputedStyle(img).backgroundImage;
        src = extractUrlSrc(attribute);
        if (!targetURL) targetURL = getTargetUrl(img);

        if (img && src && targetURL) {
          createImageAd(img, src, targetURL);
        } else {
          logP("[Google Responsive Display Ad] Can't find element", img, src, targetURL);
        }

      } else {

        // No img, trying to collect as text ad
        if (title) targetURL = title.getAttribute("href")

        if (title && text && targetURL) {

          const ad = vAPI.adParser.createAd('Ads by google responsive display ad', targetURL, {
            title: title.innerText,
            text: text.innerText
          });

          if (ad) {

            if (vAPI.prefs && vAPI.prefs.logEvents) console.log('[PARSED] Responsive Text Ad', ad);
            notifyAddon(ad);
            return true;

          } else {

            warnP("Fail: Unable to create Ad", document.domain, targetUrl);
          }

        } else {

          logP("[Text Ad Parser] Google Responsive Display Ad")
          vAPI.textAdParser.findGoogleTextAd(elem)
        }
      }
    }

    const processIFrame = function () {

      // console.log('[PARSER] processIFrame', this.getAttribute('src'));

      let doc;
      try {
        doc = this.contentDocument || this.contentWindow.document || this.document;
      }
      catch (e) {
        logP('Ignored cross-domain iFrame', this.getAttribute('src'));
        return;
      }

      const imgs = doc.querySelectorAll(imgSelectors.join(', '));
      if (imgs.length) {
        findImageAds(imgs);
      }
      else {
        logP('No images in iFrame');
      }
    };

    const notifyAddon = function (ad) {

      vAPI.messaging.send('adnauseam', {
        what: 'registerAd',
        ad: ad
      });

      return true;
    };

    const createAd = function (network, target, data) {

      /* const domain = (parent !== window) ?
        parseDomain(document.referrer) : document.domain,
        proto = window.location.protocol || 'http'; */

      // logP('createAd:', target, isValidDomain(parseDomain(target)));

      if (target.indexOf('http') < 0) {// || !isValidDomain(parseDomain(target)) {

        // per https://github.com/dhowe/AdNauseam/issues/1536#issuecomment-835827690
        target = window.location.origin + target;  // changed 5/10/21

        //return warnP("Ignoring Ad with targetUrl=" + target, arguments);
      }

      let newAd = new Ad(network, target, data);
      
      if (newAd && chrome.extension.inIncognitoContext) { // private flag
        newAd.private = true;
      }

      return newAd;
    }

    const useShadowDOM = function () {

      return false; // for now
    };

    // parse the target link from a js onclick handler
    const parseOnClick = function (str, hostname, proto) {

      let result, matches = /(?:javascript)?window.open\(([^,]+)[,)]/gi.exec(str);

      if (!(matches && matches.length)) {

        // if failed try generic regex to extract any URLs
        matches = ocRegex.exec(str);
      }

      if (matches && matches.length > 0) {

        result = matches[1].replace(/('|"|&quot;)+/g, '');
        return normalizeUrl(proto, hostname, result);
      }
    }

    /*************************** JQUERY-SHIMS ****************************/


    const $attr = function (ele, attr, val) { // jquery shim

      return val ? (ele.length ? ele[0] : ele).setAttribute(attr, val) :
        (ele.length ? ele[0] : ele).getAttribute(attr);
    };

    const $text = function (ele) { // jquery shim

      if (typeof ele.length === 'undefined')
        return ele.innerText || ele.textContent;

      let text = '';
      for (let i = 0; i < ele.length; i++) {

        text += ele[i].innerText || ele[i].textContent;
      }

      return text;
    };
    
    return {
      process: process,
      createAd: createAd,
      notifyAddon: notifyAddon,
      useShadowDOM: useShadowDOM,
      parseOnClick: parseOnClick,
      normalizeUrl: normalizeUrl
    };

  };
})();
