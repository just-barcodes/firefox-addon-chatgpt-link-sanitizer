// Runs on chatgpt.com only. Rewrites link hrefs in the page so that hovering,
// copying or dragging a link yields a URL without utm_source=chatgpt.com.
// Clicks are additionally covered by the network rule in rules.json.
(function () {
  "use strict";

  const SELECTOR = 'a[href*="utm_source=chatgpt.com"]';
  const clean = globalThis.cleanChatGptUrl;

  function cleanAnchor(anchor) {
    const href = anchor.getAttribute("href");
    const cleaned = clean(href);
    if (cleaned !== href) anchor.setAttribute("href", cleaned);
  }

  function cleanTree(root) {
    if (root.matches(SELECTOR)) cleanAnchor(root);
    for (const anchor of root.querySelectorAll(SELECTOR)) cleanAnchor(anchor);
  }

  cleanTree(document.documentElement);

  // ChatGPT streams responses, so only look at nodes that were added.
  new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) cleanTree(node);
      }
    }
  }).observe(document.documentElement, { childList: true, subtree: true });
})();
