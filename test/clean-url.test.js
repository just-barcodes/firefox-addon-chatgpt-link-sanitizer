import { test } from "node:test";
import assert from "node:assert/strict";
import { CLEAN_CASES, UNCHANGED } from "./fixtures.js";

// clean-url.js is a classic (non-module) content script that installs a global.
await import("../src/clean-url.js");
const cleanUrl = globalThis.cleanChatGptUrl;

test("installs cleanChatGptUrl as a global function", () => {
  assert.equal(typeof cleanUrl, "function");
});

for (const [input, expected] of CLEAN_CASES) {
  test(`strips utm_source=chatgpt.com: ${input}`, () => {
    assert.equal(cleanUrl(input), expected);
  });
}

for (const input of UNCHANGED) {
  test(`leaves untouched: ${JSON.stringify(input)}`, () => {
    assert.equal(cleanUrl(input), input);
  });
}

test("returns non-string input as is", () => {
  assert.equal(cleanUrl(null), null);
  assert.equal(cleanUrl(undefined), undefined);
});
