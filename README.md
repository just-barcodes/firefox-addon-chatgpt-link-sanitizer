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
