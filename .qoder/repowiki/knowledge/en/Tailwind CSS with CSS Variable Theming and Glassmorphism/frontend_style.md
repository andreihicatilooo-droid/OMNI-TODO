## Overview
The frontend styling system is built on **Tailwind CSS v3** integrated with **PostCSS** and **Autoprefixer**. It employs a hybrid approach: utility-first classes for layout and spacing, combined with CSS custom properties (variables) for theming and design tokens. The visual aesthetic is defined by a "glassmorphism" design language (translucent panels, backdrop blurs) and serif/sans-serif typography pairing.

## Styling Architecture

### 1. Core Stack
- **Framework**: Tailwind CSS (`tailwind.config.js`)
- **Processor**: PostCSS (`postcss.config.js`)
- **Animation**: Framer Motion (used in components for transitions)
- **Icons**: Lucide React

### 2. Theming System (CSS Variables)
The application uses a robust theme engine driven by CSS variables defined in `src/index.css`. Themes are switched by changing the `data-theme` attribute on the root element.

**Available Themes:**
- `liwood` (Default): Warm cream/paper aesthetic (`#FDFBF7` bg, `#B89B72` accent).
- `dark`: Deep charcoal/black aesthetic (`#121110` bg, `#CBA57A` accent).
- `cyberpunk`: High-contrast dark blue/cyan aesthetic (`#0D1117` bg, `#06B6D4` accent).

**Design Tokens:**
Variables are mapped in `tailwind.config.js` under the `theme` namespace:
- `--bg-primary`, `--bg-secondary`
- `--text-primary`, `--text-secondary` (mapped to `theme-muted`)
- `--accent-color`, `--accent-hover`
- `--border-color`
- `--glass-bg`, `--glass-border`, `--glass-blur`

### 3. Component Classes (@layer components)
Reusable UI patterns are defined in `src/index.css` using Tailwind's `@layer` directive:
- `.glass-card`: Translucent background with blur, rounded corners, and subtle border.
- `.glass-panel`: Similar to card but with less blur, used for sidebars/containers.
- `.btn-primary`, `.btn-gold`: Standard button styles with hover/active states.
- `.input-field`: Styled form inputs with focus rings.
- `.nav-item`: Navigation links with active/inactive states.
- `.custom-scrollbar`: Thin, themed scrollbars.

### 4. Typography
- **Sans-serif**: 'Montserrat' (Body text, UI elements)
- **Serif**: 'Playfair Display' (Headings, elegant titles)
- Fonts are imported via Google Fonts in `src/index.css`.

## Key Conventions for Developers

1. **Use Theme Variables**: Never hardcode colors. Use Tailwind classes like `bg-theme-bg`, `text-theme-text`, `border-theme-accent`, or `hover:bg-theme-accent-hover`.
2. **Glassmorphism**: Use `.glass-card` or `.glass-panel` for containers to maintain visual consistency with the translucent aesthetic.
3. **Theme Switching**: To support themes, ensure the root container has `data-theme={currentTheme}`. The app currently defaults to `dark` or `liwood` depending on the version of `App.jsx` being referenced (note: there appears to be duplicate code in `App.jsx`, but the pattern remains `data-theme`).
4. **Responsive Design**: Standard Tailwind breakpoints apply. Mobile-first approach is encouraged.
5. **Animations**: Use `framer-motion` for complex layout transitions (e.g., sidebar toggling) and CSS keyframes (e.g., `.animate-float`) for simple effects.

## Key Files
- `tailwind.config.js`: Maps CSS variables to Tailwind utility classes.
- `src/index.css`: Defines CSS variables, themes, global styles, and component classes.
- `postcss.config.js`: Configures Tailwind and Autoprefixer plugins.
- `src/App.jsx`: Applies the `data-theme` attribute to the root div.