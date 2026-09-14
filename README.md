# ChatGPT Link Sanitizer

A tiny Firefox / Zen addon that removes the `utm_source=chatgpt.com` tracking parameter
ChatGPT appends to outbound links.

## How it works

- A static `declarativeNetRequest` rule rewrites any top-level navigation whose URL carries
  `utm_source=chatgpt.com`, before the request leaves the browser. Other query parameters and
  the fragment are preserved.

No background script, no runtime dependencies, no data collection.

## Permissions

- **Access your data for all websites** (`<all_urls>`): required by Firefox for any
  `declarativeNetRequest` redirect rule. The addon only ever removes one query parameter.

## Development

```sh
npm ci
npm run ci          # lint, format check, tests, addon lint, build
npm run ext:run     # launch Firefox with the addon loaded
npm run ext:run:zen # same, using Zen
```
