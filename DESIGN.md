# DESIGN.md — Universal SaaS Dashboard Design System

> **Purpose:** Define a reusable visual design system based on the supplied dashboard reference. This document specifies the appearance, layout, design tokens, component styling, and responsive behavior that should remain consistent across different products and industries.
>
> **Design identity:** Soft mint surfaces, deep teal accents, muted pastel colors, rounded geometry, subtle borders, clean typography, and spacious data visualization.
>
> **Scope:** Visual design and UI behavior only. Product-specific features, terminology, business logic, and data models must be defined separately for each application.

---

## 1. Design Philosophy

The interface follows a calm, modern SaaS aesthetic that balances information density with visual simplicity.

### Core principles

1. **Soft, low-contrast surfaces:** Use cool mint backgrounds and lighter foreground panels.
2. **Strong visual hierarchy:** Use deep teal for primary text, navigation, and important actions.
3. **Pastel differentiation:** Use muted colors to distinguish cards, categories, chart series, and statuses.
4. **Generous rounded geometry:** Apply consistent, large corner radii to panels, cards, inputs, and navigation items.
5. **Minimal decoration:** Prefer subtle borders and restrained shadows over heavy outlines and elevation.
6. **Consistent spacing:** Use a defined spacing scale instead of arbitrary margins and padding.
7. **Data-first presentation:** Charts, metrics, tables, and controls must remain readable and organized.
8. **Reusable components:** Build a consistent component system that can accommodate different content and workflows.
9. **Responsive by default:** Preserve the visual identity across desktop, tablet, and mobile.
10. **Accessible interaction:** Maintain readable contrast, visible focus states, semantic structure, and keyboard support.

### Visual keywords

`Minimal SaaS` · `Soft Mint` · `Deep Teal` · `Pastel Analytics` · `Rounded UI` · `Clean Typography` · `Subtle Borders` · `Modern Dashboard`

---

## 2. Color System

### 2.1 Foundation palette

The following palette approximates the supplied screenshot. Values are reconstructed design tokens rather than original source-design values.

| Token | Hex | Purpose |
|---|---|---|
| `canvas` | `#E4E6E5` | Outer page background |
| `background` | `#E9F6F6` | Main application background |
| `surface-primary` | `#EFF9F9` | Primary content panels |
| `surface-secondary` | `#E5F4F3` | Secondary surfaces |
| `surface-muted` | `#E2F0EF` | Icon containers and subtle controls |
| `border` | `#D7E6E5` | Input outlines and subtle dividers |
| `text-primary` | `#062C2F` | Headings and important text |
| `text-secondary` | `#506867` | Supporting text and descriptions |
| `text-muted` | `#819493` | Placeholder text and secondary metadata |
| `accent-primary` | `#062C2F` | Primary actions and active navigation |
| `accent-hover` | `#104447` | Hover state for primary actions |
| `focus-ring` | `#397F7C` | Accessible focus indication |

### 2.2 Pastel palette

Use these colors as interchangeable semantic accents. Their meaning must depend on the application, not on a fixed business category.

| Token | Hex | Visual character |
|---|---|---|
| `pastel-lime` | `#D6EDB3` | Soft yellow-green |
| `pastel-mint` | `#9CD4D2` | Muted aqua |
| `pastel-coral` | `#EDB2B7` | Soft coral-pink |
| `pastel-lavender` | `#B2BCEE` | Muted lavender-blue |
| `pastel-pink` | `#E5B1DB` | Soft pink-purple |
| `pastel-neutral` | `#D9E7E6` | Cool gray-green |

### 2.3 Color usage rules

- Keep the application background pale and cool.
- Use deep teal as the primary contrast color.
- Use pastel backgrounds selectively for visual differentiation.
- Keep large content surfaces close to white with a mint tint.
- Avoid excessive saturated colors, heavy gradients, and pure-black text.
- Do not assign business meaning to a color without defining its semantic purpose.
- Never communicate status through color alone.
- Maintain sufficient contrast for text, controls, and important data.

### 2.4 CSS design tokens

```css
:root {
  color-scheme: light;

  /* Foundation */
  --color-canvas: #E4E6E5;
  --color-background: #E9F6F6;
  --color-surface: #EFF9F9;
  --color-surface-secondary: #E5F4F3;
  --color-surface-muted: #E2F0EF;

  /* Typography */
  --color-text-primary: #062C2F;
  --color-text-secondary: #506867;
  --color-text-muted: #819493;

  /* Interactive */
  --color-accent: #062C2F;
  --color-accent-hover: #104447;
  --color-focus: #397F7C;

  /* Borders */
  --color-border: #D7E6E5;
  --color-border-strong: #C4D9D7;

  /* Pastels */
  --color-pastel-lime: #D6EDB3;
  --color-pastel-mint: #9CD4D2;
  --color-pastel-coral: #EDB2B7;
  --color-pastel-lavender: #B2BCEE;
  --color-pastel-pink: #E5B1DB;
  --color-pastel-neutral: #D9E7E6;

  /* Typography */
  --font-sans: "Plus Jakarta Sans", Inter, sans-serif;

  /* Radius */
  --radius-sm: 12px;
  --radius-md: 18px;
  --radius-lg: 24px;
  --radius-card: 32px;
  --radius-panel: 36px;
  --radius-pill: 999px;

  /* Spacing */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;

  /* Borders and shadows */
  --border-width: 1px;
  --shadow-soft: 0 4px 20px rgba(6, 44, 47, 0.035);

  /* Motion */
  --transition-fast: 140ms ease;
  --transition-standard: 200ms ease;
}
```

---

## 3. Typography

### 3.1 Font family

Preferred: **Plus Jakarta Sans**

Fallback: `Inter`, followed by a suitable system sans-serif.

Use a modern sans-serif with clean geometric shapes and readable letterforms.

```css
:root {
  font-family: var(--font-sans);
  font-synthesis: none;
  text-rendering: optimizeLegibility;
}
```

Load the font through an appropriate font provider or self-host it. Do not depend on an external font request if the application's deployment requirements prohibit it.

### 3.2 Type scale

| Role | Size | Weight |
|---|---:|---:|
| Page heading | 27–30 px | 600 |
| Section heading | 19–21 px | 600 |
| Card heading | 15–17 px | 500–600 |
| Primary metric | 25–28 px | 600 |
| Body text | 14 px | 400 |
| Navigation label | 13–14 px | 400–500 |
| Supporting text | 12–13 px | 400 |
| Metadata | 11–12 px | 400 |
| Small section label | 10–11 px | 500–600 |

These sizes are starting points. Adapt them to the component and content hierarchy without changing the overall visual character.

### 3.3 Typography rules

- Use deep teal for page titles and primary information.
- Use muted gray-green for secondary text.
- Keep headings moderately weighted rather than excessively bold.
- Use consistent line heights and text baselines.
- Apply tabular numerals to numerical data when appropriate.
- Truncate long labels gracefully.
- Never sacrifice readability to force text into a fixed-width component.

---

## 4. Application Layout

### 4.1 Overall composition

The reference uses a large, rounded application surface placed inside a neutral outer canvas.

The desktop composition consists of:

- An outer canvas with generous margins.
- A persistent left navigation region.
- A main content region.
- A horizontal header.
- A page heading.
- One or more full-width content sections.
- A multi-column content grid.
- Additional content below the initial viewport.

### 4.2 Desktop shell

At the reference viewport of approximately 1200 × 900 px, the application starts about 60 px from the left and top edges. The application frame and main content are clipped by the screenshot boundaries on the right and bottom.

Use this as a reference composition, not as a requirement to clip the actual application.

```css
.app-shell {
  display: grid;
  grid-template-columns: 230px minmax(0, 1fr);

  min-height: 100vh;
  overflow: hidden;

  background: var(--color-background);
  border-radius: 36px;
}

.app-sidebar {
  min-width: 0;
}

.app-main {
  min-width: 0;
  display: flex;
  flex-direction: column;
}
```

For applications that use an outer canvas, add the desktop margin at the page-wrapper level. Remove it on smaller screens.

### 4.3 Main content

```css
.main-content {
  display: flex;
  flex-direction: column;
  gap: 14px;

  min-width: 0;
  padding: 20px 24px 32px 20px;
}
```

The content should feel open but not sparse. Related elements should be grouped closely, with larger spacing between major sections.

### 4.4 Spacing system

| Token | Value | Usage |
|---|---:|---|
| `space-1` | 4 px | Small icon gaps |
| `space-2` | 8 px | Compact internal spacing |
| `space-3` | 12 px | Control and card gaps |
| `space-4` | 16 px | Standard padding |
| `space-5` | 20 px | Panel padding |
| `space-6` | 24 px | Section spacing |
| `space-8` | 32 px | Major spacing |
| `space-10` | 40 px | Large section separation |
| `space-12` | 48 px | Large layout margins |

Use these tokens throughout the interface. Avoid unrelated one-off values unless the design requires a precise adjustment.

---

## 5. Sidebar Navigation

### 5.1 Structure

The sidebar consists of:

1. Brand mark and brand name.
2. One or more navigation groups.
3. Navigation items with icons.
4. Active and inactive states.
5. Optional expandable groups.
6. Optional bottom-aligned account or settings controls.

The number and names of navigation groups must be determined by the application.

### 5.2 Brand

- Position at the upper-left of the sidebar.
- Icon or logo size: approximately 28–32 px.
- Brand typography: approximately 22–24 px.
- Gap between icon and text: approximately 10 px.
- Brand color: deep teal.
- Keep the logo simple and visually balanced.

### 5.3 Navigation groups

Section labels should be small, uppercase, and restrained.

- Font size: 10–11 px.
- Weight: 500–600.
- Color: muted gray-green or deep teal with reduced emphasis.
- Spacing: sufficient separation between groups.

Group names and item labels must be application-specific.

### 5.4 Navigation items

| Property | Specification |
|---|---|
| Height | 42–44 px |
| Corner radius | Pill-shaped |
| Icon size | 16–18 px |
| Icon container | 34–36 px |
| Horizontal gap | 10–12 px |
| Vertical gap | 5–7 px |
| Label size | 13–14 px |

### 5.5 Active state

The active item uses a deep teal pill with white text.

```css
.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;

  min-height: 43px;
  padding: 5px 10px;

  border-radius: var(--radius-pill);
  color: var(--color-text-primary);
  background: transparent;

  transition:
    background var(--transition-fast),
    color var(--transition-fast);
}

.nav-item[aria-current="page"] {
  color: #FFFFFF;
  background: var(--color-accent);
}
```

Inactive items use a transparent background and muted dark teal text. Their icons may sit inside pale circular containers.

### 5.6 Responsive behavior

- Desktop: full sidebar.
- Tablet: collapsible sidebar or compact navigation rail.
- Mobile: accessible drawer or dedicated navigation pattern.
- Preserve the active-state treatment at every breakpoint.

---

## 6. Header and Page Introduction

### 6.1 Header composition

The header may contain:

- A search control.
- Optional voice or quick-action control.
- Notification control.
- Language or workspace selector.
- Profile avatar and identity.
- Contextual actions.

These elements are optional. Include only those appropriate for the product.

### 6.2 Layout

```css
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;

  min-height: 48px;
  min-width: 0;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}
```

Keep the header compact and aligned. Do not use absolute positioning for ordinary header controls.

### 6.3 Search input

- Height: approximately 42 px.
- Width: approximately 315 px on a desktop reference layout.
- Border: 1 px solid the subtle border color.
- Corner radius: pill-shaped.
- Background: transparent or slightly lighter than the surrounding surface.
- Search icon on the left.
- Optional action icon on the right.
- Placeholder: muted gray-green.

```css
.search-input {
  display: flex;
  align-items: center;
  gap: 10px;

  width: min(315px, 100%);
  min-height: 42px;
  padding: 0 14px;

  border: 1px solid var(--color-border);
  border-radius: var(--radius-pill);
  background: transparent;
}
```

### 6.4 Profile controls

- Circular avatar: approximately 40–44 px.
- Name: 13–15 px, medium weight.
- Secondary identity text: 11–12 px.
- Text aligned vertically.
- Truncate long text without breaking the layout.

### 6.5 Page heading

- Font size: approximately 27–30 px.
- Weight: 600.
- Color: deep teal.
- Spacing after the header: approximately 20–24 px.

The heading text must be supplied by the application. Do not hardcode example user names, product names, or business terminology into shared components.

---

## 7. Content Panels

### 7.1 Panel appearance

Panels form the main visual building blocks of the interface.

- Background: light mint-white.
- Corner radius: approximately 32–38 px.
- Padding: approximately 20–24 px.
- Border: extremely subtle or absent.
- Shadow: minimal.
- Internal content aligned consistently.

```css
.content-panel {
  min-width: 0;
  padding: 20px;
  border-radius: var(--radius-panel);

  background: var(--color-surface);
  border: 1px solid rgba(255, 255, 255, 0.7);
}
```

### 7.2 Panel headers

A panel header may contain:

- A title.
- Optional supporting description.
- An optional date or context selector.
- An optional overflow menu.

Use a horizontal flex layout where space permits.

```css
.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 18px;
}
```

Allow headers to wrap on narrow screens.

### 7.3 Panel hierarchy

Panels should be distinguishable from the page background through subtle surface contrast and rounded geometry—not through heavy shadows or dark borders.

---

## 8. Metric Cards

Metric cards are generic components that can display any important numerical or categorical value.

### 8.1 Layout

The reference uses a horizontal row of four pastel cards.

Recommended desktop dimensions:

- Width: approximately 220–225 px per card when space allows.
- Height: approximately 145–150 px.
- Radius: approximately 30–32 px.
- Padding: approximately 16–18 px.
- Gap: approximately 8–12 px.

Use a responsive grid rather than fixed positioning.

### 8.2 Card hierarchy

A card may contain:

1. An icon inside a circular container.
2. An optional overflow menu.
3. A short label.
4. A prominent value.
5. Supporting text or trend information.
6. An optional decorative visualization.

Each element is optional according to the content.

### 8.3 Card colors

Use a consistent pastel sequence or assign accents through a reusable semantic palette.

```css
.metric-card {
  position: relative;
  min-width: 0;
  min-height: 146px;
  padding: 17px;

  overflow: hidden;
  border-radius: 31px;
}

.metric-card--lime {
  background: var(--color-pastel-lime);
}

.metric-card--mint {
  background: var(--color-pastel-mint);
}

.metric-card--coral {
  background: var(--color-pastel-coral);
}

.metric-card--lavender {
  background: var(--color-pastel-lavender);
}
```

### 8.4 Typography

- Label: 12–13 px.
- Value: 25–28 px, semibold.
- Supporting text: 11–12 px.
- Primary text: deep teal.
- Supporting text: muted gray-green.

### 8.5 Decorative visualization

When appropriate, place a small abstract bar visualization in the lower-right corner.

- Use rounded vertical bars.
- Vary the heights.
- Use translucent versions of the card's accent color.
- Keep the decoration behind the information hierarchy.
- Hide the decoration if it reduces readability.

Decorative visualizations must not be mistaken for actual data.

---

## 9. Data Visualization

The design system supports different chart types without assigning any chart to a particular industry.

### 9.1 Chart containers

- Use the same panel surfaces and rounded corners as the rest of the dashboard.
- Place the title in the upper-left corner.
- Place optional actions in the upper-right corner.
- Keep chart padding consistent.
- Use flexible dimensions.
- Avoid unnecessary legends and visual clutter.

### 9.2 Doughnut and pie charts

Recommended styling:

- Pastel segments.
- A substantial center hole for doughnut charts.
- A center label or total when appropriate.
- Small external labels or percentage indicators.
- Compact legends using colored circular markers.
- Minimal borders between segments.

Use actual values to calculate segment sizes and percentages.

### 9.3 Bar charts

Recommended styling:

- Rounded bars.
- Muted grid lines.
- Minimal axis decoration.
- Muted axis labels.
- Pastel accent colors.
- Optional neutral background bars.
- Optional subtle diagonal patterns where they improve visual consistency.

Do not apply decorative textures if they interfere with reading the data.

### 9.4 Tooltips

Use a deep teal tooltip with white text.

- Rounded corners: approximately 20–24 px.
- Padding: approximately 12–16 px.
- Supporting label: 10–11 px.
- Main value: 20–22 px.
- Position relative to the active data point.

Tooltips must reflect actual chart data and remain accessible where possible.

### 9.5 Chart colors

Use the pastel palette as a starting point:

```css
.chart-series-1 { color: var(--color-pastel-lime); }
.chart-series-2 { color: var(--color-pastel-mint); }
.chart-series-3 { color: var(--color-pastel-coral); }
.chart-series-4 { color: var(--color-pastel-lavender); }
.chart-series-5 { color: var(--color-pastel-pink); }
```

Actual chart components may require fill properties rather than text color. Adapt the implementation to the chosen charting library.

### 9.6 Chart implementation

Choose a charting library appropriate to the application's framework and data requirements.

The library must support responsive sizing, tooltips, labels, and accessible presentation where applicable.

Never hardcode sample chart values into a reusable component.

---

## 10. Tables and Data Lists

### 10.1 Table container

Use the same surface, radius, and spacing conventions as other content panels.

The header region may include:

- A title.
- Search.
- Filters.
- Sorting controls.
- Optional contextual actions.

### 10.2 Table styling

- Headers: approximately 12–13 px, medium or semibold.
- Body text: approximately 13–14 px.
- Muted metadata: approximately 11–12 px.
- Row dividers: subtle gray-green.
- Cell padding: consistent and comfortable.
- Column alignment: appropriate to each data type.
- Interactive rows: subtle hover state.

### 10.3 Search and filters

Controls should use:

- Pill-shaped borders.
- Compact icons.
- Light backgrounds.
- Muted labels.
- Clear selected states.
- Visible keyboard focus.

### 10.4 Responsive tables

At smaller widths:

- Allow horizontal scrolling within the table container.
- Keep the page itself free of unintended horizontal overflow.
- Preserve readable column labels.
- Consider an accessible card-based layout when appropriate.

All column names, row data, and filtering behavior must be determined by the application.

---

## 11. Iconography

### 11.1 Icon style

Use one consistent icon family. Lucide is a suitable default.

- Prefer simple outline icons.
- Maintain consistent stroke weight.
- Avoid emoji as UI icons.
- Avoid mixing unrelated icon families.
- Use circular pale containers selectively.
- Keep icons secondary to text and content.

### 11.2 Dimensions

| Context | Size |
|---|---:|
| Sidebar icon | 16–18 px |
| Header icon | 16–18 px |
| Small control icon | 14–16 px |
| Card icon | 14–16 px |
| Brand mark | 28–32 px |

Use approximately 1.8–2 px stroke width where supported.

Icon selection must follow the component's actual purpose rather than the example dashboard's original business domain.

---

## 12. Border Radius and Elevation

### 12.1 Radius scale

| Component | Radius |
|---|---:|
| Outer application | 34–40 px |
| Main content panel | 32–38 px |
| Metric card | 28–32 px |
| Standard card | 20–24 px |
| Search and dropdown | 999 px |
| Active navigation | 999 px |
| Icon container | 50% |
| Tooltip | 20–24 px |

Use shared tokens and avoid inconsistent corner radii.

### 12.2 Borders

- Default border width: 1 px.
- Use subtle gray-green borders.
- Avoid dark outlines around large surfaces.
- Give form controls slightly clearer outlines than content panels.

### 12.3 Shadows

The visual language is predominantly flat.

```css
:root {
  --shadow-soft: 0 4px 20px rgba(6, 44, 47, 0.035);
}
```

Use shadows sparingly. Avoid strong elevation, excessive blur, glassmorphism, and glossy effects.

---

## 13. Interaction and Motion

### 13.1 Hover states

- Slightly adjust the background or opacity.
- Preserve the pastel aesthetic.
- Keep the interaction subtle.
- Do not introduce unnecessary movement.

### 13.2 Buttons

Primary buttons should use deep teal with white text. Secondary controls should use light surfaces, subtle borders, and dark teal text.

Pill-shaped buttons are preferred where the layout supports them.

### 13.3 Dropdowns

- Clear open and closed states.
- Consistent radius and spacing.
- Keyboard navigation.
- Appropriate focus management.
- Subtle transition effects.

### 13.4 Motion tokens

```css
:root {
  --transition-fast: 140ms ease;
  --transition-standard: 200ms ease;
}
```

Respect reduced-motion preferences. Animation must never be required to understand the interface.

---

## 14. Responsive Design

The desktop screenshot establishes the visual direction, but responsive behavior must be implemented separately.

### Desktop — 1200 px and above

- Full navigation sidebar.
- Header in one horizontal row.
- Four-column metric grid when space permits.
- Multi-column content panels.
- Full table layout.

### Tablet — 768–1199 px

- Collapsible or compact sidebar.
- Two-column metric grid.
- Flexible content columns.
- Header controls adapt to available width.
- Tables remain usable without clipping.

### Mobile — below 768 px

- Navigation drawer or mobile navigation.
- Full-width content.
- Single-column panels where necessary.
- Compact header actions.
- Responsive metric cards.
- Charts sized to their containers.
- Scrollable tables or accessible card layouts.
- Adequate touch targets.

### Responsive implementation

```css
.metric-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.content-grid {
  display: grid;
  grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.4fr);
  gap: 12px;
}

@media (max-width: 1199px) {
  .metric-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .content-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 767px) {
  .app-shell {
    display: block;
    min-height: 100vh;
    border-radius: 0;
  }

  .main-content {
    padding: 16px;
  }

  .metric-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
```

Breakpoints may be adjusted to the application, but the visual system must remain consistent.

---

## 15. Reusable Component Architecture

Implement the visual system through reusable components.

```text
components/
  layout/
    AppShell
    Sidebar
    Header
    MainContent

  navigation/
    NavigationGroup
    NavigationItem
    ProfileMenu

  ui/
    Button
    IconButton
    SearchInput
    Dropdown
    Avatar
    Badge
    Tooltip

  cards/
    ContentPanel
    MetricCard
    CardHeader

  charts/
    ChartContainer
    DoughnutChart
    BarChart
    ChartTooltip
    ChartLegend

  data/
    DataTable
    TableToolbar
    FilterControl
    SortControl
```

This is a suggested organization, not a mandatory folder structure.

### Component requirements

- Shared colors, radii, typography, and spacing must come from design tokens.
- Components must accept application-specific content through props or their normal data interfaces.
- Repeated UI patterns should not be independently restyled.
- Components must support loading, empty, error, and disabled states where relevant.
- Layouts must not depend on hardcoded text lengths or specific data values.
- Avoid unnecessary abstractions for components used only once unless they improve consistency.

---

## 16. Accessibility

The visual design must support:

- Semantic HTML.
- Logical heading order.
- Accessible names for icon-only controls.
- Visible keyboard focus.
- Keyboard-operable navigation and dropdowns.
- Sufficient contrast.
- Accessible chart descriptions.
- Semantic table markup.
- Reduced-motion preferences.
- Clear validation and error states.
- Proper labels for inputs.
- Touch-friendly controls.

Do not remove accessibility features to make the interface appear closer to the reference.

---

## 17. Design Implementation Rules

When applying this document to a new application:

1. Preserve the color system, spacing scale, rounded geometry, typography hierarchy, and visual restraint.
2. Reuse the same component styling across all application pages.
3. Replace example content with the target product's actual terminology and information architecture.
4. Select navigation items based on the target product's workflows.
5. Select charts, tables, and cards based on actual content requirements.
6. Do not include a chart or metric card simply because it appears in the reference.
7. Keep the layout flexible when content differs from the reference.
8. Do not force every application into a dashboard layout if its information architecture requires a different page structure.
9. Avoid adding gradients, shadows, colors, or decorative elements that change the reference's visual identity.
10. Keep responsive behavior, accessibility, and functional interactions as first-class requirements.

---

## 18. Visual Quality Checklist

### Visual system

- [ ] Cool mint background and neutral outer canvas.
- [ ] Deep teal primary text and actions.
- [ ] Consistent muted pastel accents.
- [ ] Modern geometric sans-serif typography.
- [ ] Consistent spacing and radius tokens.
- [ ] Minimal borders and shadows.

### Layout

- [ ] Rounded application shell where appropriate.
- [ ] Consistent sidebar and header alignment.
- [ ] Clear separation between sections.
- [ ] Flexible content grids.
- [ ] No unintended clipping or horizontal overflow.

### Components

- [ ] Consistent navigation states.
- [ ] Rounded search and filter controls.
- [ ] Reusable card and panel styles.
- [ ] Consistent chart styling.
- [ ] Clean table hierarchy.
- [ ] Appropriate hover, focus, and disabled states.

### Production readiness

- [ ] Real application data replaces placeholders.
- [ ] No industry-specific content is hardcoded into shared components.
- [ ] Responsive layouts are tested.
- [ ] Accessibility is verified.
- [ ] Loading, empty, and error states are handled.
- [ ] Visual consistency is maintained across pages.

---

## 19. Final Design Principle

**Preserve the visual identity; adapt the content and information architecture.**

This document defines a universal visual language, not a specific product. The mint surfaces, deep teal accents, pastel palette, rounded panels, clean typography, compact navigation, and restrained analytics styling should remain recognizable regardless of the application.

Every application should reuse these design foundations while choosing its own terminology, workflows, content, data structures, and components.

The goal is to create a cohesive product that feels like it belongs to the same design family as the reference—not to reproduce its original business domain or force every project into the same dashboard structure.
