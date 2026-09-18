---
name: Artisan-Ai
colors:
  surface: '#fcf9f8'
  surface-dim: '#dcd9d9'
  surface-bright: '#fcf9f8'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f6f3f2'
  surface-container: '#f0eded'
  surface-container-high: '#eae7e7'
  surface-container-highest: '#e4e2e1'
  on-surface: '#1b1c1c'
  on-surface-variant: '#57423b'
  inverse-surface: '#303030'
  inverse-on-surface: '#f3f0f0'
  outline: '#8a726a'
  outline-variant: '#dec0b7'
  surface-tint: '#a23e18'
  primary: '#9f3c16'
  on-primary: '#ffffff'
  primary-container: '#bf542c'
  on-primary-container: '#fffbff'
  inverse-primary: '#ffb59c'
  secondary: '#835500'
  on-secondary: '#ffffff'
  secondary-container: '#feb956'
  on-secondary-container: '#734a00'
  tertiary: '#5d5c57'
  on-tertiary: '#ffffff'
  tertiary-container: '#76756f'
  on-tertiary-container: '#fdffdd'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffdbcf'
  primary-fixed-dim: '#ffb59c'
  on-primary-fixed: '#390c00'
  on-primary-fixed-variant: '#822801'
  secondary-fixed: '#ffddb4'
  secondary-fixed-dim: '#feb956'
  on-secondary-fixed: '#291800'
  on-secondary-fixed-variant: '#633f00'
  tertiary-fixed: '#e5e2db'
  tertiary-fixed-dim: '#c9c6c0'
  on-tertiary-fixed: '#1c1c18'
  on-tertiary-fixed-variant: '#474742'
  background: '#fcf9f8'
  on-background: '#1b1c1c'
  surface-variant: '#e4e2e1'
typography:
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  label-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
  label-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 16px
  margin: 20px
  space-xs: 4px
  space-sm: 8px
  space-md: 16px
  space-lg: 24px
  space-xl: 32px
---

## Brand & Style

Artisan-Ai bridges the gap between handmade craft and advanced intelligence. The brand personality is grounded, tactile, warm, and thoughtfully modern. It appeals to creators, curators, and mindful consumers who value authenticity in a digital space. 

The visual language draws from **Minimalism** blended with **Tactile / Skeuomorphic** warmth—heavy emphasis on generous whitespace, high-quality typography, organic color harmonies, and subtle surface depth that mimics crafted paper and ceramics. The UI evokes a sense of calm, focused creation, avoiding sterile tech aesthetics in favor of a human-centric, welcoming atmosphere.

## Colors

The palette is derived from natural earth pigments. 
- **Primary (Terracotta `#C85A32`):** Anchors the brand, used for key interactive elements, active states, and primary calls to action.
- **Secondary (Warm Amber `#E09F3E`):** Provides inviting highlights, secondary indicators, and creative accents.
- **Tertiary / Background (Creamy Warm Beige `#F4F1EA`):** Forms the expansive canvas, offering a soft, paper-like surface that reduces eye strain and feels organic.
- **Neutral / Text (Dark Charcoal `#2B2B2B`):** Delivers high contrast for readability without the harshness of pure black, grounding the warm palette.

## Typography

The typography system relies on **Plus Jakarta Sans**, chosen for its soft, rounded geometry that perfectly complements the artisanal narrative while retaining modern legibility. 

Hierarchy is strictly maintained through size, weight, and subtle tracking adjustments on large headings. For mobile interfaces, display sizes above 32px are intentionally avoided to maintain proportional harmony on smaller screens, utilizing scaled-down mobile variants for optimal hierarchy.

## Layout & Spacing

The mobile layout utilizes a fluid grid system with 16px gutters and 20px outer margins to ensure safe touch zones and breathing room. 

Spacing follows a consistent 4px/8px baseline rhythm. Padding and component gaps favor generous whitespace (`space-md` to `space-lg`) to reinforce the uncluttered, calm aesthetic. Content reflows vertically with flexible card containers adapting to varying screen widths.

## Elevation & Depth

Depth is communicated through **tonal layering and ambient shadows** rather than harsh outlines. Surfaces use subtle tints lifted off the creamy beige background to create tactile separation. 

Shadows are diffused, low-opacity, and tinted with warm undertones (e.g., soft terracotta or deep charcoal undertones) to mimic natural light falling on crafted materials. Interactive elements elevate smoothly on press, giving a responsive, physical feel.

## Shapes

The shape language is consistently **Rounded**, utilizing a 0.5rem base radius (`rounded-md`), 1rem for prominent containers (`rounded-lg`), and 1.5rem for immersive cards (`rounded-xl`). 

This soft geometry avoids sharp industrial edges, aligning with the handcrafted, organic motif of the brand. Fully rounded pill shapes are reserved for interactive chips and primary action badges.

## Components

- **Buttons:** Solid terracotta primary buttons with generous padding and subtle ambient shadow. Secondary actions use outlined or tonal warm beige variants. Text is set in medium weight with comfortable touch targets (minimum 48px height).
- **Chips:** Pill-shaped filter and tag elements featuring soft background fills that shift to active terracotta states when selected.
- **Lists:** Clean, spacious rows divided by delicate, low-contrast warm grey separators. Icons are housed in soft tonal containers.
- **Checkboxes & Radio Buttons:** Custom-styled with rounded edges, using terracotta fills and smooth check/dot transitions.
- **Input Fields:** Soft cream-filled containers with gentle low-contrast borders. Focus states elevate with a primary terracotta outline and subtle warm shadow.
- **Cards:** Refined surfaces featuring elevated tonal backgrounds, generous internal padding, and soft ambient shadows to showcase AI-generated artwork and curated prompts.
- **Bottom Navigation:** Floating bar style with pill-shaped active state indicators, blending seamlessly into the creamy backdrop.