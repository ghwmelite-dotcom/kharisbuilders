---
name: Sacred Structure
colors:
  surface: '#fbf9f4'
  surface-dim: '#dbdad5'
  surface-bright: '#fbf9f4'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f5f3ee'
  surface-container: '#f0eee9'
  surface-container-high: '#eae8e3'
  surface-container-highest: '#e4e2dd'
  on-surface: '#1b1c19'
  on-surface-variant: '#44474d'
  inverse-surface: '#30312e'
  inverse-on-surface: '#f2f1ec'
  outline: '#74777e'
  outline-variant: '#c4c6cd'
  surface-tint: '#4f5f79'
  primary: '#04162c'
  on-primary: '#ffffff'
  primary-container: '#1a2b42'
  on-primary-container: '#8292ae'
  inverse-primary: '#b6c7e5'
  secondary: '#725b35'
  on-secondary: '#ffffff'
  secondary-container: '#fedeae'
  on-secondary-container: '#78613a'
  tertiary: '#350103'
  on-tertiary: '#ffffff'
  tertiary-container: '#521413'
  on-tertiary-container: '#d37872'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d4e3ff'
  primary-fixed-dim: '#b6c7e5'
  on-primary-fixed: '#0a1c32'
  on-primary-fixed-variant: '#374860'
  secondary-fixed: '#fedeae'
  secondary-fixed-dim: '#e1c294'
  on-secondary-fixed: '#281900'
  on-secondary-fixed-variant: '#584320'
  tertiary-fixed: '#ffdad7'
  tertiary-fixed-dim: '#ffb3ad'
  on-tertiary-fixed: '#3d0506'
  on-tertiary-fixed-variant: '#77302d'
  background: '#fbf9f4'
  on-background: '#1b1c19'
  surface-variant: '#e4e2dd'
  midnight-blue: '#1A2B42'
  heritage-gold: '#8C734B'
  sacred-burgundy: '#4A0E0E'
  champagne-light: '#E5DCC5'
  stone-gray: '#4D4D4D'
typography:
  display-lg:
    fontFamily: Playfair Display
    fontSize: 64px
    fontWeight: '700'
    lineHeight: 72px
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Playfair Display
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 48px
    letterSpacing: -0.01em
  headline-lg:
    fontFamily: Playfair Display
    fontSize: 40px
    fontWeight: '600'
    lineHeight: 48px
  headline-md:
    fontFamily: Playfair Display
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
  body-lg:
    fontFamily: Manrope
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Manrope
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-md:
    fontFamily: Manrope
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.05em
  label-sm:
    fontFamily: Manrope
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.03em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 8px
  container-max: 1280px
  gutter: 24px
  margin-desktop: 64px
  margin-mobile: 20px
---

## Brand & Style

The design system is built upon the concept of "Architectural Spirit"—a synthesis of physical presence and spiritual growth. It serves a community that values the weight of tradition but moves with the momentum of modern life. The target audience seeks a sanctuary that feels both established (professional/authoritative) and evolving (modern/welcoming).

The chosen style is **Modern Minimalist with Tonal Layering**. It prioritizes heavy whitespace to represent "breathing room for the soul," utilizing high-quality cinematic photography and precision-engineered typography. While the core is clean and professional, it incorporates "liturgical accents"—subtle metallic textures and deep saturation—to evoke the solemnity of a physical cathedral within a digital space.

## Colors

The palette is anchored by **Midnight Blue**, providing a foundation of stability and depth. **Heritage Gold** serves as the primary metallic accent, used sparingly to highlight sacred or significant actions. **Sacred Burgundy** is reserved for tertiary accents, such as deep emotional call-outs or traditional motifs.

The background is not a pure white but a warm **Champagne-tinted Off-White** (`#F9F7F2`), which reduces digital glare and mimics the texture of high-end paper or limestone. Text should primarily use the Midnight Blue for high contrast, while Stone Gray is used for secondary information to maintain a soft, sophisticated hierarchy.

## Typography

This system employs a high-contrast typographic pairing to bridge the gap between the ancient and the contemporary. 

**Playfair Display** is used for all headlines. Its sharp serifs and variable stroke weights convey a sense of literary authority and elegance. Large display titles should use a slight negative letter spacing to feel "locked" and architectural.

**Manrope** is the workhorse sans-serif for body and UI elements. Its geometric but slightly softened terminals offer excellent legibility and a friendly, modern tone. Labels and small navigational elements should use Manrope in Uppercase with expanded letter-spacing to create a clean, organized look reminiscent of architectural blueprints.

## Layout & Spacing

The layout follows a **12-column Fixed Grid** on desktop, centered to create a sense of focus and reverence. On mobile, it transitions to a single-column fluid flow with generous 20px side margins.

Spacing follows an 8px base unit, but emphasizes large vertical gaps (80px, 120px, or 160px) between major sections to ensure the "Architectural" feel. This whitespace is intentional; it prevents the UI from feeling cluttered or "noisy," allowing photography and typography to take center stage. Avoid dense clusters of information; if content is heavy, use progressive disclosure or tabbed interfaces to maintain visual calm.

## Elevation & Depth

Visual hierarchy is achieved through **Tonal Layering** and **Ambient Shadows**.

1.  **Surfaces:** The primary background is the off-white base. Secondary surfaces (cards, sidebars) use a subtle shift to a slightly lighter or darker champagne tone.
2.  **Shadows:** Shadows are highly diffused and "warm." Instead of pure black, they use a low-opacity Midnight Blue tint (`rgba(26, 43, 66, 0.08)`). This keeps the design feeling integrated rather than floating.
3.  **Glassmorphism:** Use sparingly for navigation bars or overlays. A light backdrop-blur (12px) with a semi-transparent off-white fill creates a sophisticated "frosted vellum" effect.
4.  **Dividers:** Use very thin (1px) lines in Heritage Gold at low opacity (20%) to separate sections without creating hard visual breaks.

## Shapes

The shape language is **Soft and Precise**. 

A small corner radius (4px to 8px) is applied to buttons and cards. This subtly "takes the edge off" the professional aesthetic without making it feel overly casual or bubbly. 

Interactive elements like primary buttons or "Join Us" chips should remain slightly more rectangular to maintain the architectural metaphor. Photography should always have sharp corners or extremely subtle 4px radii to retain its "framed art" quality. Circular shapes are reserved strictly for avatars or status indicators.

## Components

### Buttons
- **Primary:** Solid Midnight Blue with white Manrope text (Uppercase). Subtle gold bottom-border (2px) on hover.
- **Secondary:** Outlined in Heritage Gold with a "ghost" fill.
- **Tertiary:** Text-only with a Heritage Gold underline that expands on hover.

### Cards
Cards should feature a "Flat Elevation" style—no heavy shadows by default, but a thin, 1px champagne-darker border. Use high-quality imagery that takes up the top 50% of the card, with typography centered or left-aligned with generous padding (32px).

### Input Fields
Inputs should use a "Minimalist Ledger" style: no full box, just a bottom border in Stone Gray that turns Midnight Blue on focus. Labels should float above in Uppercase `label-sm`.

### Navigation
The header is clean and transparent, becoming "Vellum Glass" (blurred off-white) on scroll. Use Playfair Display for the logo and Manrope for nav links.

### Call-to-Action (CTA)
Large "Sermon" or "Donation" banners should use cinematic background imagery with a dark Midnight Blue overlay (40% opacity) to ensure white Playfair Display headlines remain legible.