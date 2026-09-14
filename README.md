# ChatGPT Link Sanitizer

A tiny Firefox / Zen addon that removes the `utm_source=chatgpt.com` tracking parameter
ChatGPT appends to outbound links.

## How it works

- A static `declarativeNetRequest` rule rewrites any top-level navigation whose URL carries
  `utm_source=chatgpt.com`, before the request leaves the browser. Other query parameters and
  the fragment are preserved.
- A content script that runs only on `chatgpt.com` rewrites link `href`s in the page, so hovering,
  copying or dragging a link also yields a clean URL. It scans the page once and then watches for
  added nodes.

No background script, no runtime dependencies, no data collection.

## Permissions

- **Access your data for all websites** (`<all_urls>`): required by Firefox for any
  `declarativeNetRequest` redirect rule. The addon only ever removes one query parameter.
- **chatgpt.com**: where the content script runs.

## Development

```sh
npm ci
npm run ci          # lint, format check, tests, addon lint, build
npm run ext:run     # launch Firefox with the addon loaded
npm run ext:run:zen # same, using Zen
```

End-to-end tests install the addon into a headless Firefox and exercise both layers against a
local server. They need a Firefox-based binary and geckodriver:

```sh
FIREFOX_BIN=/usr/bin/firefox GECKODRIVER=/path/to/geckodriver npm run test:e2e
FIREFOX_BIN=/opt/zen-browser-bin/zen-bin GECKODRIVER=/path/to/geckodriver npm run test:e2e
```

Without `GECKODRIVER`, Selenium looks for geckodriver on `PATH` and otherwise downloads one into
`~/.cache/selenium`. CI runs these on every push using the Firefox that ships with the GitHub
runner image.

## Releasing

1. Bump `version` in `src/manifest.json` and `package.json`, move the `Unreleased` entries in
   `CHANGELOG.md` under a `## [X.Y.Z] - YYYY-MM-DD` heading, commit.
2. Tag and push: `git tag vX.Y.Z && git push origin vX.Y.Z`.

The release workflow verifies the tag matches the manifest version, runs the full check suite,
signs the package through addons.mozilla.org (unlisted channel) and publishes a GitHub release
with the signed `.xpi`. It needs the repository secrets `AMO_JWT_ISSUER` and `AMO_JWT_SECRET`
from the [AMO API keys page](https://addons.mozilla.org/developers/addon/api/key/). Running the
workflow manually performs a dry run without signing or publishing.

## Installing

Download the `.xpi` from the latest GitHub release and open it in Firefox or Zen.
