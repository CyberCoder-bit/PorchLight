# PorchLight brand

PorchLight should look like a calm, trustworthy community service: a porch at night with the light left on. The colors are night navy and lantern yellow on cream paper. The type is large and plain, and the pages leave plenty of space. There are no photos. Every picture is a simple SVG we drew ourselves.

## Logo

The mark is a roofline over an arched doorway filled with warm light, with a lantern glow in the doorway and a porch step under it. It is drawn on a 48 x 48 grid with round line ends, and it still reads as "a lit doorway under a roof" at 16 px (see `docs/screenshots/v2-brand-sheet.png`).

| File | Use |
|---|---|
| `public/brand/porchlight-mark.svg` | The mark on light backgrounds (navy roof and step) |
| `public/brand/porchlight-mark-dark.svg` | The mark on dark backgrounds (cream roof and step) |
| `public/brand/porchlight-mark-mono.svg` | One color (black). The lantern is cut out of the doorway |
| `public/brand/porchlight-wordmark.svg`, `-dark.svg` | "PorchLight" alone: "Porch" in navy (cream on dark), "Light" in amber (yellow on dark) |
| `public/brand/porchlight-lockup.svg`, `-dark.svg`, `-mono.svg` | The mark and the wordmark side by side |
| `public/favicon.svg` | The dark mark on a navy rounded square |
| `public/apple-touch-icon.png` | 180 x 180, from `public/brand/app-icon.svg` |

The wordmark is Atkinson Hyperlegible Next Bold, turned into outlines so it looks the same on any computer. In the page header and footer the name is real text (so it grows with the text-size setting) next to an inline copy of the mark. The link is named "PorchLight home" and the mark is `aria-hidden`.

**Do**
- Leave space around the mark at least as wide as the doorway.
- Use the dark version on navy or dark photos, and the light version on cream or white.
- Use the one-color version for print, stamps, and embroidery.

**Don't**
- Don't recolor the doorway, add windows, or put a heart or a person in it.
- Don't stretch it, rotate it, add shadows, or put it on a busy background.
- Don't set "PorchLight" in another font, or split it into two words.

### Brand check

We searched the web on November 4, 2026 for organizations named Porchlight and their logos. Several unrelated groups use the name: PorchLight in Bellevue, Washington (homeless shelter, formerly Congregations for the Homeless), Porchlight, Inc. in Madison, Wisconsin (housing and shelter), PorchLight, A Family Justice Center in Lakewood, Colorado, Porchlight Music Theatre in Chicago, Project Porchlight in New Jersey (energy education), and PorchLight Entertainment, an animation studio whose logos showed a house with its lights coming on. To keep our mark clearly different from theirs, it has no house walls, windows, light bulb, or rays. It is an open arched doorway with a lantern in it, and the name is always written as one word with "Light" in amber. This was a web search, not a trademark search. A real launch would need a trademark search (USPTO) and probably a different name.

## Color

Colors are tokens on `:root` in `public/styles.css`. The dark theme, high contrast, and "match my device" swap the tokens; `test/accessibility/contrast.test.js` checks every text pair at 7:1 and every control line at 4.5:1 in all four themes. Ratios below are WCAG 2 contrast ratios, computed from the hex values.

| Pair | Ratio |
|---|---|
| White text on night navy `#1d2433` (header) | 15.53:1 |
| Lantern yellow `#ffd66b` on night navy (brand name, current page) | 11.15:1 |
| Ink `#111111` on lantern yellow (Get started, step numbers) | 13.56:1 |
| Text `#111111` on cream page `#fffdf8` | 18.58:1 |
| Secondary text `#3f3c36` on cream | 10.81:1 |
| Link and primary blue `#0b3d91` on cream | 9.88:1 |
| White on the primary button `#0b3d91` | 10.04:1 |
| Amber text `#6b4200` on cream (eyebrows) | 8.59:1 |
| Amber text `#6b4200` on `#f7f5ef` (footer "Light") | 8.01:1 |
| Wordmark "Light" `#a14f00` on white (logo file) | 5.78:1 |
| Wordmark "Porch" `#1d2433` on white (logo file) | 15.53:1 |
| Dark wordmark: cream `#fff6e5` on navy | 14.47:1 |
| Doorway amber `#f29f22` on navy (logo, decoration) | 7.22:1 |
| Dark theme: text `#f4f2ec` on `#121110` | 16.85:1 |
| Dark theme: link `#9ec5ff` on `#121110` | 10.67:1 |
| Dark theme: `#0a1730` on the primary button `#9ec5ff` | 10.09:1 |
| Dark theme: amber `#ffd27a` on `#121110` | 13.25:1 |
| Focus ring: `#111111` line on the `#ffd23f` halo | 13.08:1 |

Logo-only colors (not used for text): doorway `#f29f22`, glow `#ffd66b`, lantern `#fffbea`, cream `#fff6e5`.

## Type

- Atkinson Hyperlegible Next, self-hosted in `public/fonts/` as a variable woff2 (weights 200 to 800, Latin and Latin Extended subsets, 53 KB together) under the SIL Open Font License (`public/fonts/OFL.txt`). It was made by the Braille Institute so that letters that look alike (I, l, 1; O, 0) are easy to tell apart. `font-display: swap`, so text shows at once in a system font.
- Behind it, system fonts for the scripts it does not cover: `system-ui`, Segoe UI, Roboto, Noto Sans, Noto Sans Arabic, Geeza Pro, Tahoma, Noto Sans Myanmar, Myanmar Text, Padauk, PingFang SC, Microsoft YaHei, Noto Sans SC.
- Base size is 20 px (`html { font-size: 125% }`), 22 px with A+, 25 px with A++. Nothing is smaller than 1rem.
- Tracking changes with size: the home headline is `-0.025em`, h1 `-0.02em`, h2 `-0.015em`, h3 `-0.01em`, and body text `0`. Leading goes the other way: 1.08 for the home headline, 1.15 to 1.2 for headings, 1.6 for body text.
- Arabic and Burmese (`:lang(ar)`, `:lang(my)`): looser leading (1.85 for body, 1.45 for headings) and no letter-spacing at all, because spacing pulls joined Arabic letters apart.

## Spacing and shape

- A 4-step rem scale: `--space-1` 0.25rem through `--space-12` 3rem. Because it is in rem, A+ and A++ scale the whole layout, not just the letters.
- Cards: 1px border, `0.75rem` corners, one soft shadow. No blur and no see-through layers.
- Every button, link row, and menu item is at least 44 px tall, with a 4px dark focus ring and a yellow halo.
- Press feedback: buttons shrink to 98% for 100ms when pressed. With reduced motion, nothing moves.
- Text pages are at most 58rem wide, and lines of body text at most 40rem.

## Right to left

Every rule uses logical properties (`margin-inline-start`, `padding-inline-end`, `inset-inline-end`, `text-align: start`), so a page with `dir="rtl"` mirrors with no extra CSS. Arrows in the public pages flip too. `test/design/site.test.js` fails if a physical `left`/`right` property comes back.

## Screenshots

`docs/screenshots/v2-home-375.png`, `v2-home-1280.png`, `v2-for-families-375.png`, `v2-for-families-1280.png`, `v2-safety-375.png`, `v2-safety-1280.png`, `v2-admin-375.png`, `v2-admin-1280.png`, `v2-menu-375.png` (the phone Menu, open), and `v2-brand-sheet.png` (the logo at 16 to 128 px).

Lighthouse accessibility (Lighthouse 12, headless Chrome, November 4, 2026): 100 on `/` (desktop), 100 on `/for-families` (desktop), and 100 on `/safety` (mobile).
