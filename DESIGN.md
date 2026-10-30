---
name: SkillSwap
description: A clear, calm learning product for focused peer help.
colors:
  primary: "#1d5fd1"
  primary-hover: "#174aa6"
  primary-tint: "#eaf1ff"
  primary-tint-ink: "#174aa6"
  primary-text: "#ffffff"
  background: "#f1f3f6"
  surface: "#ffffff"
  surface-subtle: "#f8f9fb"
  ink: "#1f2937"
  ink-muted: "#5d6675"
  line: "#e1e5eb"
  line-strong: "#737f90"
  success: "#087443"
  success-tint: "#e8f6ee"
  success-border: "#b5e2c6"
  warning: "#875900"
  warning-tint: "#fff4d6"
  warning-border: "#f1d78c"
  danger: "#b42318"
  danger-tint: "#feeceb"
  danger-border: "#f4c6c3"
typography:
  display:
    fontFamily: "Source Sans 3, Arial, sans-serif"
    fontSize: "30px"
    fontWeight: 700
    lineHeight: "36px"
    letterSpacing: "-0.03em"
  title:
    fontFamily: "Source Sans 3, Arial, sans-serif"
    fontSize: "19px"
    fontWeight: 700
    lineHeight: "26px"
  body:
    fontFamily: "Source Sans 3, Arial, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: "24px"
  label:
    fontFamily: "Source Sans 3, Arial, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: "20px"
  meta:
    fontFamily: "Source Sans 3, Arial, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: "20px"
rounded:
  control: "8px"
  card: "14px"
spacing:
  1: "4px"
  2: "8px"
  3: "12px"
  4: "16px"
  6: "24px"
  8: "32px"
  12: "48px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-text}"
    rounded: "{rounded.control}"
    height: "48px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
    textColor: "{colors.primary-text}"
    rounded: "{rounded.control}"
    height: "48px"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.card}"
    padding: "16px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    height: "48px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    height: "48px"
  time-slot:
    backgroundColor: "{colors.primary-tint}"
    textColor: "{colors.primary-tint-ink}"
    rounded: "{rounded.control}"
    height: "48px"
---

# Design System: SkillSwap

## Overview

**Creative North Star: "Familiar Learning Clarity"**

SkillSwap uses the visual clarity of familiar learning products with the careful interaction craft associated with Scrimba and Duolingo, while keeping the experience focused on one specific peer-help task. Neutral, cool-gray surfaces and a clear blue action color make forms, choices, and next steps easy to scan. The interface feels polished and approachable through type hierarchy, compact facts, and consistent Lucide icons rather than decorative effects.

The product's private link pages stay focused on the individual request or offer. They have no global navigation and no social mechanics. Cards and controls use restrained borders and flat surfaces; selected and notice states use subtle tinted fills.

**Key Characteristics:**
- Cool gray surfaces, dark slate text, and accessible blue actions.
- Sans-serif typography with clear size and weight hierarchy.
- Bordered, rounded containers and restrained state tints.
- Consistent Lucide icons paired with meaningful text.

## Colors

The palette pairs cool, low-chroma gray surfaces with a readable blue primary and separate semantic colors for success, warning, and errors.

### Primary
- **Clear Action Blue** (`colors.primary`): The primary action, links, focus treatment, and selected controls.
- **Deep Action Blue** (`colors.primary-hover`): Hover state for primary buttons.
- **Blue Selection Tint** (`colors.primary-tint`): Selected choice and informational emphasis background.
- **Blue Selection Ink** (`colors.primary-tint-ink`): Text on selected blue-tint surfaces.

### Neutral
- **Cool Gray Canvas** (`colors.background`): Page background.
- **White Surface** (`colors.surface`): Cards, fields, and top bars.
- **Subtle Gray Surface** (`colors.surface-subtle`): Quiet and disabled surfaces.
- **Slate Ink** (`colors.ink`): Primary text.
- **Muted Slate** (`colors.ink-muted`): Supporting text and labels.
- **Light Divider** (`colors.line`): Card outlines and dividers; contrast against white is 1.25:1, so it is a structural separator, not a text color.
- **Strong Slate Border** (`colors.line-strong`): Input boundaries; contrast against the page background is 3.61:1.
- **Success Green** (`colors.success`) and **Success Tint** (`colors.success-tint`): Success state text and surface; 5.25:1 text contrast.
- **Warning Brown** (`colors.warning`) and **Warning Tint** (`colors.warning-tint`): Warning state text and surface; 5.54:1 text contrast.
- **Error Red** (`colors.danger`) and **Error Tint** (`colors.danger-tint`): Error text and surface; 5.76:1 text contrast.

### Contrast
Ratios use WCAG relative luminance calculations on the CSS token values. Body text requires 4.5:1; large text requires 3:1. The ratios include primary combinations used in the UI:

| Text / surface | Contrast |
|---|---:|
| Slate ink / page background | 13.21:1 |
| Muted slate / page background | 5.21:1 |
| Slate ink / white surface | 14.68:1 |
| Muted slate / white surface | 5.80:1 |
| Primary blue / page background | 5.23:1 |
| White text / primary blue | 5.82:1 |
| White text / deep action blue | 8.18:1 |
| Blue selection ink / blue tint | 7.22:1 |
| Strong slate border / page background | 3.61:1 |

The subtle card border is intentionally low contrast and should not be relied on as the only indication of an interactive control. Color never carries meaning alone.

**The Meaning-With-Text Rule.** Pair semantic colors and icons with clear labels or messages; never make color the only cue.

## Typography

**Display Font:** Source Sans 3 (with Arial, sans-serif fallback)
**Body Font:** Source Sans 3 (with Arial, sans-serif fallback)
**Label/Mono Font:** No distinct label or monospace family is used.

**Character:** A single clean sans-serif family keeps headings, brief details, and form controls visually connected. Weight and size establish hierarchy without switching to a display face.

### Hierarchy
- **Display** (700, 30px, 36px; 34px / 42px from 720px): Page headings.
- **Title** (700, 19px, 26px): Section headings; task copy may use 18px / 27px at weight 600.
- **Body** (400, 16px, 24px): Main reading and form text.
- **Label** (600, 15px, 20px): Field and choice labels.
- **Meta** (400, 14px, 20px): Secondary labels and supporting information.
- **Time** (500, 16px, 24px): Time-slot day and time content.

**The One-Family Rule.** Use the same sans-serif family for headings and body; use size and weight to distinguish roles.

## Layout

Private brief pages use a centered content column up to 640px wide, with 16px side padding on narrow screens and 24px from 640px. The brief starts with a task card, followed by fact rows, a notice, and the response area. At narrow widths facts stack in a compact two-column label/value arrangement; the available width is used for readable wrapping. A fixed spacing rhythm is defined at 4, 8, 12, 16, 24, 32, and 48px. The design kit uses a wider 1120px frame and shifts its component collection to two columns from 720px; that layout belongs to the kit surface, not private link pages.

**The Private-Link Focus Rule.** Private link pages have no global navigation, dashboard, people search, or social mechanics; each page serves its own request or offer.

## Elevation & Depth

Cards and containers are flat at rest. Depth and grouping come from white against the cool gray canvas, fine borders, spacing, and state tint. The CSS includes a subtle 1px-by-2px primary-button shadow; it is limited to that button treatment and is not a card elevation rule. Focus is shown with a visible two-stage ring: a 2px white separation and a 2px blue outer ring.

## Shapes

Controls use gently rounded 8px corners; cards and notices use 14px corners. Cards and controls use 1px borders. The radio control alone is circular, and the checkbox has the control corner radius. Rows and cards remain plainly rectangular rather than pill-shaped.

## Components

### Buttons
- **Shape:** Rounded control corners (8px), at least 48px tall.
- **Primary:** Blue fill, white semibold text, 12px vertical and 16px horizontal padding; hover uses deep blue.
- **Hover / Focus:** 140ms ease-out background transition; keyboard focus uses the shared visible ring.
- **Secondary / Text:** Secondary uses a white surface and light border; text buttons use blue underlined text.
- **Disabled:** Muted text, light divider fill, and strong slate boundary.

### Cards / Containers
- **Corner Style:** 14px.
- **Background:** White, with subtle gray used for quieter previews and surfaces.
- **Shadow Strategy:** Flat; grouped by spacing and a 1px light border.
- **Border:** Light gray, 1px.
- **Internal Padding:** Commonly 16px; fact containers use 8px vertical and 16px horizontal padding.

### Inputs / Fields
- **Style:** White fill, 1px strong slate border, 8px corners, 48px minimum height, 12px by 16px padding.
- **Focus:** Visible two-stage blue focus ring.
- **Error / Disabled:** Invalid field boundary and error message use the danger color; disabled select uses subtle gray and muted text.

### Choices
- Rows are at least 48px high with a 1px light border and 8px corners. A selected row uses blue text, a blue border and a pale blue fill, with the native selected control retained as a visible cue.

### Notices
- Notices use 14px corners, a 1px border and a tinted surface; warning, error, and success each have their own text, border, and fill tokens. The no-show notice uses the blue selection tint.

### Navigation
- The development-only design kit uses a compact white brand bar with a fine bottom border. Private link pages do not use global navigation.

### Mentor Brief Facts
- Task, attempted work, deadline, time box, and give-back details appear as labeled facts in a bordered white card. Muted labels and blue Lucide icons support scanning; thin dividers separate rows. The no-show rule is a distinct blue-tinted notice.

## Do's and Don'ts

### Do:
- **Do** use the CSS palette and type scale documented above.
- **Do** use Lucide icons consistently and pair them with text where meaning needs explanation.
- **Do** keep card and control outlines to restrained 1px borders and use 14px card corners.
- **Do** show a clear visible focus ring for keyboard users.
- **Do** keep private link pages free of global navigation and social mechanics.

### Don't:
- **Don't** add gradients, decorative animation, or card shadows.
- **Don't** introduce social feeds, follows, likes, or other social mechanics. Public student profiles and search are approved product surfaces; keep them grounded in verified facts and specified privacy rules.
- **Don't** use color as the only signal for state or meaning.
- **Don't** place global navigation on private link pages.
