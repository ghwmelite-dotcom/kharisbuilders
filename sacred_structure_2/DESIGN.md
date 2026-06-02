---
name: Sacred Structure
colors:
  surface: '#fff7fe'
  surface-dim: '#e0d7e1'
  surface-bright: '#fff7fe'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#faf1fb'
  surface-container: '#f4ebf5'
  surface-container-high: '#efe5f0'
  surface-container-highest: '#e9e0ea'
  on-surface: '#1e1a21'
  on-surface-variant: '#4a454d'
  inverse-surface: '#332f36'
  inverse-on-surface: '#f7eef8'
  outline: '#7b757d'
  outline-variant: '#ccc4cd'
  surface-tint: '#6a577a'
  primary: '#362545'
  on-primary: '#ffffff'
  primary-container: '#4d3b5c'
  on-primary-container: '#bda6ce'
  inverse-primary: '#d6bee6'
  secondary: '#6c5581'
  on-secondary: '#ffffff'
  secondary-container: '#e6cafd'
  on-secondary-container: '#69527e'
  tertiary: '#2d2c31'
  on-tertiary: '#ffffff'
  tertiary-container: '#434247'
  on-tertiary-container: '#b1aeb5'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#f1daff'
  primary-fixed-dim: '#d6bee6'
  on-primary-fixed: '#241433'
  on-primary-fixed-variant: '#523f61'
  secondary-fixed: '#f0dbff'
  secondary-fixed-dim: '#d8bcee'
  on-secondary-fixed: '#261239'
  on-secondary-fixed-variant: '#533e68'
  tertiary-fixed: '#e5e1e8'
  tertiary-fixed-dim: '#c8c5cc'
  on-tertiary-fixed: '#1c1b20'
  on-tertiary-fixed-variant: '#47464c'
  background: '#fff7fe'
  on-background: '#1e1a21'
  surface-variant: '#e9e0ea'
typography:
  display:
    fontFamily: Playfair Display
    fontSize: 64px
    fontWeight: '700'
    lineHeight: 72px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Playfair Display
    fontSize: 48px
    fontWeight: '600'
    lineHeight: 56px
  headline-lg-mobile:
    fontFamily: Playfair Display
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
  headline-md:
    fontFamily: Playfair Display
    fontSize: 32px
    fontWeight: '500'
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
  label-sm:
    fontFamily: Manrope
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.08em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 8px
  gutter: 24px
  margin-desktop: 64px
  margin-mobile: 20px
  container-max: 1280px
---

## Brand & Style

This design system embodies an architectural, sacred aesthetic that balances ancient wisdom with contemporary precision. The brand personality is serene, authoritative, and deeply intentional, targeting an audience that values mindfulness, legacy, and structured beauty. 

The visual style is **Minimalist with Architectural Depth**, utilizing expansive white space (or deep tonal washes) to create a sense of "digital cathedral" scaling. It draws inspiration from classical proportions, using high-contrast serif typography and a refined color palette to evoke an emotional response of calm, reverence, and clarity. The aesthetic avoids clutter, treating every UI element as a structural necessity rather than decoration.

## Colors

The palette is centered around a sophisticated purple core, transitioning from the deep, grounded tones of the brand's logo to ethereal tints.

- **Primary (Deep Royal):** `#4D3B5C`. A grounded, scholarly purple used for key brand moments, primary actions, and structural headers.
- **Secondary (Muted Lavender):** `#9D84B3`. Used for secondary actions, accents, and tonal differentiation.
- **Tertiary (Soft Mist):** `#F4F0F7`. A near-white purple tint used for background layering and subtle container fills.
- **Neutral (Obsidian Purple):** `#1A161D`. A high-contrast dark tone for body text and deep shadows, maintaining a hint of purple warmth to avoid the sterility of pure black.

The default mode is **Light**, emphasizing the "Sacred" aspect through luminosity and breathability.

## Typography

The typographic hierarchy relies on the tension between the classical elegance of **Playfair Display** and the modern, functional clarity of **Manrope**.

- **Headlines:** Use Playfair Display for all editorial and structural titles. It provides the "architectural" feel. Use tighter letter-spacing for large display sizes to create a bespoke, premium look.
- **Body & Interface:** Manrope provides a neutral, trustworthy counterpoint. Its geometric yet warm nature ensures legibility across dense information layouts.
- **Labels:** Always use Manrope in uppercase with increased letter-spacing to signify metadata, categories, or small navigational cues.

## Layout & Spacing

The layout follows a **Fixed Grid** philosophy to maintain the "Sacred Structure." Content is housed within a centered container with a maximum width of 1280px to ensure an editorial, book-like reading experience on large screens.

- **Desktop (12 Columns):** 24px gutters with 64px outer margins. Elements should favor symmetrical arrangements or intentional "golden ratio" offsets.
- **Tablet (8 Columns):** 20px gutters with 40px margins.
- **Mobile (4 Columns):** 16px gutters with 20px margins. 

The spacing rhythm is strictly based on an 8px base unit. Vertical rhythm is prioritized, with large gaps (64px+) used between major content sections to allow the design to "breathe."

## Elevation & Depth

This design system uses **Tonal Layers** and **Low-Contrast Outlines** rather than aggressive shadows. Depth is communicated through the stacking of surfaces.

- **Level 0 (Base):** Pure white or the Tertiary `#F4F0F7`.
- **Level 1 (Cards/Containers):** White background with a 1px solid border in a 10% opacity version of the Primary Purple.
- **Level 2 (Interaction):** When an element is raised (e.g., a hovered card), a very soft, diffused purple-tinted shadow is applied: `0px 12px 32px -4px rgba(77, 59, 92, 0.08)`.
- **Level 3 (Modals):** Large backdrop blurs (20px) are used behind modals to create a sense of focus and sanctuary.

## Shapes

The shape language is **Soft** and restrained. While the brand is architectural, it avoids "harsh" edges to maintain its approachable, sacred nature.

- **Standard Elements:** Buttons and input fields use a `0.25rem` (4px) corner radius.
- **Large Elements:** Cards and featured containers use `0.5rem` (8px).
- **Circular Accents:** Only the brand logo or specific iconography should utilize full circles; UI components remain structured and rectangular with soft corners.

## Components

- **Buttons:** Primary buttons are solid `#4D3B5C` with white Manrope text. Secondary buttons are outlined with 1px of the primary color. Both use the `label-sm` typographic style for a refined, intentional look.
- **Inputs:** Minimalist fields with only a bottom border (2px) in light purple, which transitions to the Primary Purple on focus. Labels sit above in the `label-sm` style.
- **Cards:** White backgrounds with subtle purple-tinted borders. Headers within cards should use Playfair Display (Headline-MD).
- **Chips:** Small, pill-shaped tags using the Secondary Lavender (`#9D84B3`) at 10% opacity with 100% opacity text.
- **Lists:** High-density lists are avoided. Instead, use "Divided Entries" with significant vertical padding (24px) and a thin 1px hairline separator in Tertiary purple.
- **Navigation:** The top-tier navigation uses Manrope Medium for clarity, with a subtle underline in Primary Purple for the active state.