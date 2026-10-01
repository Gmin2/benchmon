# brand

the benchmon logo, icons and share image, all generated from code so a colour or pixel change is a one line edit.

- `src/logo.mjs` the wordmark (bowlby one sc letterforms, celeste style: dark outline, lime face, monad purple depth) and the pixel mon peeking over it. `node src/logo.mjs`
- `src/icons.mjs` the 16px favicon head and the app icons (mon peeking over a lime slab). `node src/icons.mjs`
- `src/png.mjs` renders an svg to a png at an exact size
- `og/og.html` the 1200x630 share image, rendered to `og/og.png`
- `logo/` the outputs; the web app uses copies in `web/public` (`brand/logo.svg`, `brand/mon.svg`, favicons, icons, `og.png`)

`references/` and `concepts/` hold the research images and are not in git.
