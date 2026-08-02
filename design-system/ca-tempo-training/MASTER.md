# CA Tempo Training — Design System

## Palette (maintain)

| Name | Hex | Usage |
|------|-----|-------|
| ink-950 | `#0a0a0a` | Pitch background |
| ink-900 | `#141414` | Cards |
| accent-500 | `#c8a24a` | Gold — CTAs, borders, active nav |
| accent-600 | `#a8853a` | Hover |
| paper | `#ffffff` | Light mode / contrast text |

## Typography

- **Display:** Bebas Neue — headings, uppercase, tracking-wide
- **Body:** Inter — 16px base, line-height 1.5
- **Eyebrow:** 12px, letter-spacing 0.3em, uppercase

## Signature element

Skewed parallelogram image frames with gold top/left border + diagonal speed-line SVG accents (from "Meet Our Team" collateral).

## Motion (CSS-only)

- Hero background: subtle zoom (20s), disabled with `prefers-reduced-motion`
- Cards: translateY -2px + gold glow on hover (200ms)
- Sections: fade-up on load
- Nav active: gold underline

## Assets map

| File | Path |
|------|------|
| Logo | `/icons/logo.jpg` |
| PWA icons | `/icons/icon-192.png`, `/icons/icon-512.png` |
| Team poster | `/images/team-poster.png` |
| Hero action 1 | `/images/hero-action-1.png` |
| Hero action 2 | `/images/hero-action-2.png` |
| Coaches field | `/images/coaches-field.png` |
| Founders | `/images/founders.png` |
| Gallery | `/images/gallery-1.png` … `gallery-4.png` |

## Components

- `BrandLogo`, `PublicHeader`, `PublicFooter`
- `SkewImageFrame`, `SpeedLines`, `SectionHeader`
- `AthleticCard`, `PageHero`
