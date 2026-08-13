# Codex Dev Flow Brand Kit

The Codex Dev Flow mark is ASCII-native: `[`, `/`, and `]` form a checkpoint crossed by
a guided path. Its detailed master adds exactly three down-right echo outlines, giving
the mark depth without shadows or gradients. Use the color symbol by default and a
monochrome variant when production constraints require one color.

## Palette

| Role      | Hex       | Use                                      |
| --------- | --------- | ---------------------------------------- |
| Primary   | `#5B5CF6` | Path, dominant surfaces, digital accent. |
| Secondary | `#F6F65B` | Checkpoint and high-visibility accent.   |
| Ink       | `#18181B` | Color-lockup wordmark.                   |

Use solid fills only. Do not add gradients, shadows, outlines, glows, textures, or 3D
effects.

## Asset inventory

- `svg/symbol-color.svg`: preferred detailed standalone symbol at 48 px and above.
- `svg/symbol-black.svg` and `svg/symbol-white.svg`: detailed one-color masters.
- `svg/symbol-simple-{color,black,white}.svg`: simplified symbols below 48 px and for
  constrained production.
- `svg/lockup-color.svg`: preferred horizontal symbol and wordmark.
- `svg/lockup-black.svg` and `svg/lockup-white.svg`: one-color horizontal lockups.
- `png/symbol-color-{16,32,48,64,128,256,512,1024}.png`: transparent responsive
  raster exports. The 16 px and 32 px files use simplified artwork; larger files use the
  three-echo master.
- `logo-ascii.txt`: portable terminal and plain-text form.

## Usage

- Keep clear space around the symbol equal to the width of one bracket stem.
- Use the standalone symbol at 16 px or larger. Use detailed artwork from 48 px upward
  and simplified artwork below 48 px. Use the lockup at 120 px wide or larger.
- Prefer the color symbol on white, near-black, or indigo surfaces. When yellow loses
  contrast against a light background, use black or place the color symbol on indigo.
- Use the white variant on dark photographs or surfaces; use black for one-color light
  surfaces, engraving, stamps, and constrained printing.
- Keep the glyph order, proportions, echo count, echo spacing, colors, and diagonal
  direction unchanged.
- Do not rotate, skew, crop, rearrange, animate independently, or place effects on the
  glyphs.

## Portability

Symbol SVGs use fixed paths, so installed fonts cannot change their geometry. Horizontal
lockups keep the wordmark as accessible live text using a portable system sans-serif
stack; convert only the wordmark to outlines when a production vendor requires fully
outlined artwork. For embroidery, engraving, stamps, or any process unable to preserve
the echo strokes, use a simple monochrome symbol.

The text fallback is strict ASCII and contains no ANSI color escapes. Plain text cannot
reproduce the three vector echo outlines, so it is a fallback rather than the visual
master:

```text
[/]
```
