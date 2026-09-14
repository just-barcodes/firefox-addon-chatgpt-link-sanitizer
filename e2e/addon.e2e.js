// Real-browser test: installs the addon into a headless Firefox and checks
// both layers against a local HTTP server.
//
// Environment:
//   FIREFOX_BIN  path to a Firefox-based binary (default: `firefox` on PATH)
//   GECKODRIVER  path to geckodriver (default: PATH, else Selenium Manager
//                downloads one into ~/.cache/selenium)
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Builder } from "selenium-webdriver";
import firefox from "selenium-webdriver/firefox.js";
import { CLEAN_CASES, UNCHANGED } from "../test/fixtures.js";

const SRC = fileURLToPath(new URL("../src/", import.meta.url));
const PAGE = `<!doctype html><title>e2e</title>
<a data-t="1" href="https://a.com/?utm_source=chatgpt.com">1</a>
<a data-t="2" href="https://a.com/p?x=1&amp;utm_source=chatgpt.com&amp;y=2">2</a>
<a data-t="3" href="https://a.com/?utm_source=other">3</a>`;
const INJECT = `for (const [i, href] of arguments[0].entries()) {
  const a = document.createElement("a");
  a.dataset.t = "added" + i; a.href = href; a.textContent = "x";
  document.body.append(a);
}`;

let server, base, driver, addonDir;

before(async () => {
  server = http.createServer((req, res) => {
    res.setHeader("content-type", "text/html; charset=utf-8");
    res.end(PAGE);
  });
  await new Promise((resolve) => server.listen(0, resolve));
  base = `http://localhost:${server.address().port}`;

  // Test-only copy of the addon whose content script also runs on localhost.
  addonDir = mkdtempSync(join(tmpdir(), "chatgpt-link-sanitizer-e2e-"));
  cpSync(SRC, addonDir, { recursive: true });
  const manifestPath = join(addonDir, "manifest.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  manifest.content_scripts[0].matches.push("http://localhost/*");
  writeFileSync(manifestPath, JSON.stringify(manifest));

  const options = new firefox.Options().addArguments("-headless");
  if (process.env.FIREFOX_BIN) options.setBinary(process.env.FIREFOX_BIN);
  const builder = new Builder().forBrowser("firefox").setFirefoxOptions(options);
  if (process.env.GECKODRIVER && existsSync(process.env.GECKODRIVER)) {
    builder.setFirefoxService(new firefox.ServiceBuilder(process.env.GECKODRIVER));
  }
  driver = await builder.build();
  await driver.installAddon(addonDir, true);
});

after(async () => {
  await driver?.quit();
  server?.close();
  if (addonDir) rmSync(addonDir, { recursive: true, force: true });
});

const local = (url) => url.replace("https://a.com", base);
const hrefs = () =>
  driver.executeScript(
    "return [...document.querySelectorAll('a[data-t]')].map((a) => a.getAttribute('href'))",
  );
const settle = () => new Promise((resolve) => setTimeout(resolve, 300));

for (const [input, expected] of CLEAN_CASES) {
  test(`network rule redirects ${input}`, async () => {
    await driver.get(local(input));
    assert.equal(await driver.getCurrentUrl(), local(expected));
  });
}

for (const url of UNCHANGED.filter((u) => u.startsWith("https://a.com"))) {
  test(`network rule ignores ${url}`, async () => {
    await driver.get(local(url));
    assert.equal(await driver.getCurrentUrl(), local(url));
  });
}

test("content script cleans links present at load", async () => {
  await driver.get(`${base}/page`);
  await settle();
  assert.deepEqual(await hrefs(), [
    "https://a.com/",
    "https://a.com/p?x=1&y=2",
    "https://a.com/?utm_source=other",
  ]);
});

test("content script cleans links added after load", async () => {
  await driver.executeScript(INJECT, [
    "https://b.com/?utm_source=chatgpt.com#h",
    "https://b.com/?q=1&utm_source=chatgpt.com",
    "https://b.com/?utm_source=chatgpt.com.evil",
  ]);
  await settle();
  assert.deepEqual((await hrefs()).slice(3), [
    "https://b.com/#h",
    "https://b.com/?q=1",
    "https://b.com/?utm_source=chatgpt.com.evil",
  ]);
});
