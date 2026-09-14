import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { CLEAN_CASES, UNCHANGED } from "./fixtures.js";

const manifest = JSON.parse(readFileSync(new URL("../src/manifest.json", import.meta.url)));
const rules = JSON.parse(readFileSync(new URL("../src/rules.json", import.meta.url)));
const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url)));

test("manifest version matches package.json version", () => {
  assert.equal(manifest.version, pkg.version);
});

test("manifest declares the ruleset file and it exists", () => {
  const resources = manifest.declarative_net_request.rule_resources;
  assert.equal(resources.length, 1);
  assert.equal(resources[0].enabled, true);
  assert.ok(existsSync(new URL(`../src/${resources[0].path}`, import.meta.url)));
});

test("rules have unique integer ids and explicit resource types", () => {
  const ids = rules.map((r) => r.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const rule of rules) {
    assert.ok(Number.isInteger(rule.id) && rule.id > 0);
    assert.ok(rule.condition.resourceTypes.includes("main_frame"));
  }
});

test("redirect rule strips utm_source only when the value is chatgpt.com", () => {
  const [rule] = rules;
  assert.equal(rule.action.type, "redirect");
  assert.deepEqual(rule.action.redirect.transform.queryTransform.removeParams, ["utm_source"]);

  const re = new RegExp(rule.condition.regexFilter);
  for (const [url] of CLEAN_CASES) assert.match(url, re);
  for (const url of UNCHANGED.filter((u) => u.startsWith("http"))) assert.doesNotMatch(url, re);
});
