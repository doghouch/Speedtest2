# Speedtest2
Open-source speedtest written in pure HTML/CSS/JS.

# Changelog

- 3/27/2024: Initial Release

# Known Bugs

- There is an issue in Safari/WebKit-based browsers where SVG scaling does not work properly alongside `transform-origin`.
  - Given that it has been broken for so long, a workaround will need to be found (TBD)

# Configuration

The only thing you need to configure is the following line:

```
const TEST_URL = "https://cachefly.cachefly.net/100mb.test";
```

Change this to a local URL or another test file URL. Valid URLs include:

- `/TestFiles/100mb.test`
- `https://example.com/100mb.test`

Do not add a trailing `/`. The size of each test file is determined by the `Content-Length` header. In certain cases, this may not be sent.

You will have to modify the following lines in `speedtest.js`:

```
const contentLength = response.headers.get('content-length'); <--
const total = parseInt(contentLength, 10);
let loaded = 0;
```

Set `contentLength` to your test file's size in **bytes**.
