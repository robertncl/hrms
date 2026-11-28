# Fonts

Self-hosted because the page CSP is `font-src 'self'` (see `src/index.html`):
no Google Fonts link will load, so every face the app sets must be a file here
and must be declared with `@font-face` against `/assets/fonts/…`.

| Family | Files | Used by | Licence |
|---|---|---|---|
| Archivo | `Archivo-Variable-latin.woff2`, `Archivo-Variable-latin-ext.woff2` | `--font-sans` / `--font-display`, the whole UI | OFL-1.1 — `OFL.txt` |
| Inter | `Inter-{Regular,Medium,SemiBold,Bold}.woff2` | the ACME layer's own stack, now overridden | OFL-1.1 |
| JetBrains Mono | `JetBrainsMono-{Regular,SemiBold}.woff2` | `--font-mono`: token names, codes, hex values | OFL-1.1 |

## Archivo

One variable file per subset carries weights 400–800, so Modernist's five
weights cost two files rather than five statics. Taken from Google Fonts
(Archivo v25), `wght` axis only, `font-stretch` pinned at 100% — the width
axis is not part of the design system. The vietnamese subset is deliberately
left out: no screen in this app sets Vietnamese. The `@font-face` rules and
their unicode-ranges live in `src/styles/modernist.css`.

To update: take the current files from
https://fonts.googleapis.com/css2?family=Archivo:wght@400..800 and copy the
unicode-ranges across with them.

Inter and JetBrains Mono are also OFL-1.1 and shipped before this; their
`@font-face` rules are in the vendored `src/styles/acme.css`.
