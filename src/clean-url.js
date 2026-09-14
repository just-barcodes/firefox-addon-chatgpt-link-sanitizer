// Removes the utm_source=chatgpt.com parameter from a URL string.
//
// Pure string manipulation on purpose: a URL/URLSearchParams round trip would
// re-encode every other parameter (e.g. "%20" becomes "+"). Exposed as a
// global because Firefox content scripts share one scope and cannot use ES
// modules. Matches lowercase only, which is what ChatGPT emits; the network
// rule in rules.json is the case-insensitive safety net.
(function () {
  "use strict";

  const PARAM = /([?&])utm_source=chatgpt\.com(?=[&#]|$)/;

  function cleanChatGptUrl(url) {
    if (typeof url !== "string") return url;
    const match = PARAM.exec(url);
    if (!match) return url;

    const before = url.slice(0, match.index);
    let after = url.slice(match.index + match[0].length);
    // "?utm_source=...&x=1" -> the next parameter must become the first one.
    if (match[1] === "?" && after.startsWith("&")) after = "?" + after.slice(1);
    return before + after;
  }

  globalThis.cleanChatGptUrl = cleanChatGptUrl;
})();
