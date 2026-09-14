# Plan: ChatGPT Link Sanitizer (Firefox / Zen addon)

## Goal

A tiny Manifest V3 extension for Firefox and Zen that removes the tracking
parameter ChatGPT appends to outbound links (`?utm_source=chatgpt.com`), with a
CI pipeline that lints, tests, validates the addon package, and signs releases.

Success criteria:

1. Clicking a link in ChatGPT lands on the URL without `utm_source=chatgpt.com`.
   Other query parameters and the fragment are untouched.
2. Opening any URL carrying `utm_source=chatgpt.com` (pasted, bookmarked, from
   another app) is rewritten before the request leaves the browser.
3. Copying a link address from the ChatGPT UI yields a clean URL.
4. No background script, no runtime JS outside `chatgpt.com`, no third-party
   runtime dependencies, no build step.
5. `npm run ci` is green locally and in GitHub Actions; a tag `vX.Y.Z` produces
   a signed `.xpi` attached to a GitHub release.

## Decisions (with recommendations)

These are the choices that materially change the work. The plan below assumes
the recommended option unless you say otherwise.

| #   | Decision             | Options                                                                                                                                                                 | Recommendation                                                                                                                                                                                                                                                |
| --- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Sanitizing mechanism | (a) declarativeNetRequest (DNR) redirect rule only; (b) content script on chatgpt.com only; (c) both                                                                    | **(c)**. DNR covers criterion 2 and is zero-cost at runtime. The content script (~40 lines, only on chatgpt.com) covers criterion 3 (copy / hover / drag). (a) alone leaves copied links dirty; (b) alone misses links arriving from outside the ChatGPT tab. |
| 2   | What to strip        | (a) only `utm_source=chatgpt.com`; (b) every `utm_*` param whenever `utm_source=chatgpt.com` is present                                                                 | **(a)**. It is what was asked and cannot break sites that legitimately use `utm_*`. (b) is a one-line change later if ChatGPT starts adding more.                                                                                                             |
| 3   | Permission footprint | DNR redirects require host permissions for the target URL, so `<all_urls>` is unavoidable for criterion 2. Install prompt will say "Access your data for all websites". | Accept it. If the prompt is unacceptable, fall back to option 1(b) with `chatgpt.com` as the only host.                                                                                                                                                       |
| 4   | Distribution         | (a) AMO unlisted (self-distributed signed `.xpi`, signing is immediate and automatic); (b) AMO listed (public listing, human review, delays)                            | **(a)** to start. Switching to listed later is a `--channel` flag change. Both require an AMO account and API key/secret stored as GitHub secrets.                                                                                                            |
| 5   | Test runner          | (a) Node built-in `node:test` + `node:assert`; (b) vitest                                                                                                               | **(a)**. Zero dependencies, Node 22 is already installed.                                                                                                                                                                                                     |
| 6   | License              | MIT / Apache-2.0 / other                                                                                                                                                | **MIT** (needed for AMO submission metadata).                                                                                                                                                                                                                 |

## Architecture

```
src/
  manifest.json      MV3 manifest
  rules.json         DNR static ruleset (1 rule)
  clean-url.js       pure function: cleanUrl(string) -> string  (shared, unit tested)
  content.js         chatgpt.com only: rewrites <a href> in the DOM using cleanUrl
  icons/icon.svg     single SVG icon (Firefox accepts SVG for all sizes)
test/
  clean-url.test.js  unit tests (node:test)
  rules.test.js      structural checks on rules.json + regex sanity checks
  e2e/               optional real-Firefox test (see Phase 4)
.github/workflows/
  ci.yml             lint, format, test, addon lint, build (every push / PR)
  release.yml        on tag v*: verify version, build, sign, GitHub release
```

### Layer 1: DNR redirect rule (network level, all sites)

`rules.json`:

```json
[
  {
    "id": 1,
    "priority": 1,
    "action": {
      "type": "redirect",
      "redirect": { "transform": { "queryTransform": { "removeParams": ["utm_source"] } } }
    },
    "condition": {
      "regexFilter": "[?&]utm_source=chatgpt\\.com(&|#|$)",
      "resourceTypes": ["main_frame", "sub_frame"]
    }
  }
]
```

Notes:

- `resourceTypes` must be explicit; the DNR default excludes `main_frame`.
- The condition only matches when the value is exactly `chatgpt.com`, so
  `removeParams` never touches a `utm_source` with another value.
- After the redirect the URL no longer matches, so there is no loop.
- `regexFilter` and `queryTransform` are both in the Firefox DNR API. Firefox
  does not surface an error for an unsupported static rule in an installed
  addon (it silently ignores it), so Phase 1 verifies the rule in a real
  browser via `web-ext run` before anything else is built on top of it. If
  `queryTransform` turns out unsupported, the fallback is `regexSubstitution`.

Manifest keys involved:

```json
"permissions": ["declarativeNetRequestWithHostAccess"],
"host_permissions": ["<all_urls>"],
"declarative_net_request": {
  "rule_resources": [{ "id": "strip_chatgpt_utm", "enabled": true, "path": "rules.json" }]
}
```

`declarativeNetRequestWithHostAccess` is chosen over `declarativeNetRequest`
because redirects need host permissions anyway and the former does not add an
extra "Block content on any page" warning.

### Layer 2: content script (DOM level, chatgpt.com only)

- `matches: ["https://chatgpt.com/*"]`, `run_at: document_idle`.
- `js: ["clean-url.js", "content.js"]`. Both files share one content-script
  scope, so `clean-url.js` defines `globalThis.cleanChatGptUrl` and
  `content.js` uses it. No bundler.
- On load: rewrite every `a[href*="utm_source=chatgpt.com"]`.
- Then a single `MutationObserver` on `document.body` (`childList`, `subtree`)
  that runs the same selector on added element nodes only. ChatGPT streams
  responses, so the callback must do nothing else. No attribute observation.
- Rewrite is `a.href = cleaned` only when the result differs, so React does
  not see spurious churn.

### `cleanUrl` semantics

String-based removal, not a `URL`/`URLSearchParams` round trip, so other
parameters keep their original encoding (`%20` must not become `+`).

| Input                                           | Output                                        |
| ----------------------------------------------- | --------------------------------------------- |
| `https://a.com/?utm_source=chatgpt.com`         | `https://a.com/`                              |
| `https://a.com/p?x=1&utm_source=chatgpt.com`    | `https://a.com/p?x=1`                         |
| `https://a.com/p?utm_source=chatgpt.com&x=1`    | `https://a.com/p?x=1`                         |
| `https://a.com/?utm_source=chatgpt.com#sec`     | `https://a.com/#sec`                          |
| `https://a.com/?a=b%20c&utm_source=chatgpt.com` | `https://a.com/?a=b%20c` (encoding preserved) |
| `https://a.com/?utm_source=other`               | unchanged                                     |
| `https://a.com/?utm_source=chatgpt.com.evil`    | unchanged (exact value match)                 |
| `mailto:x@y.z`, relative paths, empty string    | unchanged                                     |

Case: match the parameter name and value case-insensitively? Recommendation:
exact lowercase only, matching what ChatGPT emits and what the DNR rule does
(`isUrlFilterCaseSensitive` defaults to false in DNR, so the two layers are
consistent enough; document the difference in a comment).

### Manifest (full)

```json
{
  "manifest_version": 3,
  "name": "ChatGPT Link Sanitizer",
  "version": "0.1.0",
  "description": "Removes the utm_source=chatgpt.com tracking parameter ChatGPT adds to links.",
  "homepage_url": "https://github.com/<owner>/firefox-addon-chatgpt-link-sanitizer",
  "icons": { "48": "icons/icon.svg", "96": "icons/icon.svg" },
  "permissions": ["declarativeNetRequestWithHostAccess"],
  "host_permissions": ["<all_urls>"],
  "declarative_net_request": {
    "rule_resources": [{ "id": "strip_chatgpt_utm", "enabled": true, "path": "rules.json" }]
  },
  "content_scripts": [
    {
      "matches": ["https://chatgpt.com/*"],
      "js": ["clean-url.js", "content.js"],
      "run_at": "document_idle"
    }
  ],
  "browser_specific_settings": {
    "gecko": {
      "id": "chatgpt-link-sanitizer@<your-domain-or-handle>",
      "strict_min_version": "140.0",
      "data_collection_permissions": { "required": ["none"] }
    }
  }
}
```

- `gecko.id` is mandatory for signing MV3 addons. Pick it once; it is permanent.
- `strict_min_version: 140.0` (ESR) is the first release with
  `data_collection_permissions` support; Android needs 142 (`gecko_android`). It is
  comfortably after DNR (113) and MV3 host permission prompts (127). Zen is on
  Firefox 15x, so this is not a constraint for Zen.
- `data_collection_permissions` has been mandatory for new AMO submissions
  since 3 November 2025. `["none"]` is correct: the addon transmits nothing.
- No `background`, no `action`, no `options_ui`, no `storage`.

## Tooling (dev dependencies only)

| Tool                                | Purpose                                                                         |
| ----------------------------------- | ------------------------------------------------------------------------------- |
| `web-ext`                           | `lint` (runs addons-linter, the same checks AMO runs), `build`, `run`, `sign`   |
| `eslint` + `@eslint/js` + `globals` | flat config, `browser` + `webextensions` globals for `src/`, `node` for `test/` |
| `prettier`                          | formatting for JS, JSON, YAML, MD                                               |
| `node:test`                         | unit tests, no dependency                                                       |

npm scripts (`package.json` is `"private": true`, `"type": "module"` for tests only):

```
lint          eslint .
format        prettier --write .
format:check  prettier --check .
test          node --test test/
ext:lint      web-ext lint --source-dir src
ext:build     web-ext build --source-dir src --artifacts-dir dist --overwrite-dest
ext:run       web-ext run --source-dir src
ext:run:zen   web-ext run --source-dir src --firefox <path to zen binary>
ci            npm run lint && npm run format:check && npm test && npm run ext:lint && npm run ext:build
```

Other repo files: `.editorconfig`, `.gitignore` (`node_modules/`, `dist/`,
`web-ext-artifacts/`), `.nvmrc` (`22`), `LICENSE`, `README.md` (what it does,
permissions rationale, install instructions for Firefox and Zen, dev
workflow), `CHANGELOG.md` (Keep a Changelog format).

## CI pipeline

### `ci.yml` (push to main, pull requests)

Best-practice defaults baked in:

- `permissions: contents: read` at the top level (least privilege).
- `concurrency` group per ref with `cancel-in-progress: true`.
- Actions pinned to full commit SHAs with a version comment; Dependabot keeps
  them current (`.github/dependabot.yml` for `github-actions` and `npm`, weekly).
- `actions/setup-node` with `node-version-file: .nvmrc` and `cache: npm`.
- `npm ci`, never `npm install`.
- `timeout-minutes` on every job.

Jobs:

1. **check** (ubuntu-latest)
   - `npm run lint`
   - `npm run format:check`
   - `npm test`
   - `npm run ext:lint` (fails on addons-linter errors; warnings are printed)
   - `npm run ext:build` and upload the `.zip` as a workflow artifact
     (7-day retention) so any PR can be side-loaded for manual testing.
   - `test/rules.test.js` also asserts: `rules.json` parses, every rule has a
     unique integer `id`, `resourceTypes` includes `main_frame`, the manifest
     `rule_resources.path` exists, and the `regexFilter` compiles as a JS
     RegExp and matches / rejects the same fixture URLs `cleanUrl` is tested
     with (keeps the two layers from drifting).
   - Assert `manifest.json` `version` equals `package.json` `version`.
2. **e2e** (see Phase 4, optional, can be `continue-on-error` initially)

### `release.yml` (on tag `v*`)

- `permissions: contents: write` (only this workflow, only to create the release).
- Steps: checkout, setup-node, `npm ci`, `npm run ci`, assert tag equals
  `v` + manifest version (fail otherwise), `web-ext sign --channel unlisted`
  with `WEB_EXT_API_KEY` / `WEB_EXT_API_SECRET` from repository secrets, then
  create a GitHub release with the signed `.xpi` and the CHANGELOG section for
  that version as the body.
- Unlisted signing is synchronous (minutes), so the workflow can wait for it.
  If you later switch to listed, the sign step becomes an upload and the
  release body should say "pending AMO review".
- A `dry-run` input via `workflow_dispatch` that runs everything except sign
  and release, for testing the workflow itself.

### Local guard

A `pre-commit`-free approach to stay light: document `npm run ci` in the
README and rely on CI. Optionally add a `prepare`-less `simple-git-hooks`
later if you want it; not included by default.

## Phases

Each phase ends with a verifiable check.

### Phase 0: scaffold

1. `package.json`, `.nvmrc`, `.editorconfig`, `.gitignore`, `LICENSE`,
   `eslint.config.js`, `.prettierrc`, `README.md` stub, `CHANGELOG.md`.
2. `npm install -D web-ext eslint @eslint/js globals prettier` (project-local
   only, never global).
3. Verify: `npm run lint`, `npm run format:check` pass on the empty tree.

### Phase 1: DNR rule (criterion 2)

1. `src/manifest.json` (without `content_scripts` yet), `src/rules.json`,
   `src/icons/icon.svg`.
2. `test/rules.test.js`.
3. Verify: `npm run ext:lint` clean. `npm run ext:run`, open
   `https://example.com/?utm_source=chatgpt.com&x=1` in the address bar,
   confirm it lands on `https://example.com/?x=1`. Repeat with `ext:run:zen`.
   Also confirm `https://example.com/?utm_source=other` is untouched.
   This step is where the "does Firefox honor `queryTransform` in a static
   rule" question gets answered for real; do not proceed until it passes.

### Phase 2: `cleanUrl` (pure function, TDD)

1. Write `test/clean-url.test.js` with the table above first, run it, watch it fail.
2. Implement `src/clean-url.js`.
3. Verify: `npm test` green.

### Phase 3: content script (criterion 1 and 3)

1. Add `content_scripts` to the manifest, write `src/content.js`.
2. Verify manually in `ext:run`: in a ChatGPT conversation with web results,
   hover a citation (status bar shows a clean URL), right-click, "Copy Link",
   paste, confirm clean. Ask ChatGPT for a new answer and confirm links in the
   streamed response are clean once rendering settles.
3. Verify: `npm run ext:lint` still clean, no console errors on chatgpt.com.

### Phase 4: CI

1. `.github/workflows/ci.yml`, `.github/dependabot.yml`.
2. Push a branch, open a PR, confirm all checks green and the build artifact
   is downloadable and installable via `about:debugging`.
3. Optional real-browser e2e (recommended, because it is the only automated
   check that proves the DNR rule works in Firefox): `selenium-webdriver` +
   geckodriver on `ubuntu-latest` (Firefox is preinstalled), install the built
   `.zip` as a temporary addon, navigate to a URL with the parameter, assert
   `driver.getCurrentUrl()` is clean. Roughly 40 lines plus one dev dependency.
   Skip it if you want to stay strictly minimal; the manual check in Phase 1
   then remains the gate.

### Phase 5: release

1. Create AMO API credentials, add `WEB_EXT_API_KEY` and `WEB_EXT_API_SECRET`
   as repository secrets.
2. `.github/workflows/release.yml`.
3. Verify: run the `workflow_dispatch` dry run, then tag `v0.1.0`, confirm a
   release with a signed `.xpi` appears and installs permanently in Firefox and Zen.

## Out of scope (deliberately)

- Options page, toggles, per-site allowlists, statistics.
- Stripping any other tracking parameters or handling other AI chat sites.
- Chrome / Chromium support (Zen and Firefox only). The manifest is
  Chrome-compatible in spirit, but nothing is tested there.
- Bundler, TypeScript, framework of any kind.

## Open questions for you

1. Confirm decisions 1 to 6 above, or pick different options.
2. Which `gecko.id` and GitHub owner/repo should go in the manifest.
3. Do you already have an AMO account / API key for signing, or should
   Phase 5 include creating one.
