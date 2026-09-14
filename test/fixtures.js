// Shared fixtures so the network rule (rules.test.js) and the DOM cleaner
// (clean-url.test.js) are always tested against the same URLs.

// [input, expected after cleaning]
export const CLEAN_CASES = [
  ["https://a.com/?utm_source=chatgpt.com", "https://a.com/"],
  ["https://a.com/p?x=1&utm_source=chatgpt.com", "https://a.com/p?x=1"],
  ["https://a.com/p?utm_source=chatgpt.com&x=1", "https://a.com/p?x=1"],
  ["https://a.com/p?x=1&utm_source=chatgpt.com&y=2", "https://a.com/p?x=1&y=2"],
  ["https://a.com/?utm_source=chatgpt.com#sec", "https://a.com/#sec"],
  ["https://a.com/?a=b%20c&utm_source=chatgpt.com", "https://a.com/?a=b%20c"],
  ["https://a.com/?utm_source=chatgpt.com&q=a+b%26c", "https://a.com/?q=a+b%26c"],
];

// URLs that must be left exactly as they are.
export const UNCHANGED = [
  "https://a.com/",
  "https://a.com/?x=1",
  "https://a.com/?utm_source=other",
  "https://a.com/?utm_source=chatgpt.com.evil",
  "https://a.com/?xutm_source=chatgpt.com",
  "https://a.com/?utm_medium=chatgpt.com",
  "https://chatgpt.com/",
  "mailto:someone@example.com",
  "/relative/path?x=1",
  "",
];
