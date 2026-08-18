---
name: The L Game
description: A quiet, board-first adaptive interface for fast abstract-strategy matches.
colors:
  white: "#ffffff"
  paper: "#f4f0e6"
  paper-raised: "#f8f5ed"
  surface: "#fffdf7"
  ink: "#252b29"
  ink-muted: "#626a65"
  placeholder: "#7b817d"
  line: "#d8d1c2"
  field-line: "#b9b2a3"
  progress-dot: "#c8c1b2"
  sage: "#879c88"
  sage-dark: "#556b59"
  sage-pressed: "#435648"
  sage-soft: "#dfe7dc"
  sage-soft-hover: "#d2ddcf"
  sage-wash: "#e8eee5"
  sage-border: "#c7d3c4"
  sage-outline: "#6c7c6e"
  brand-red: "#c4473f"
  brand-blue: "#386c8f"
  danger: "#a43f38"
  danger-pressed: "#8d342f"
  timer-danger: "#b42318"
  status-success-bg: "#dcebdd"
  status-success-fg: "#2d6038"
  status-warning-bg: "#f3e5bd"
  status-warning-fg: "#725619"
  status-danger-bg: "#f2d7d4"
  status-danger-fg: "#8d342f"
  status-default-bg: "#e5e1d7"
  status-default-fg: "#3f4742"
  board-light: "#e8dfc9"
  board-dark: "#91a878"
  board-outline: "#38563c"
  board-frame: "#435c49"
  classic-player-red: "#cf5c4f"
  classic-player-blue: "#4778ad"
  neutral-disc: "#f8f5ec"
typography:
  display:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 600
    lineHeight: 1.111
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  title:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.333
    letterSpacing: "-0.025em"
  body:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.75
  supporting:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.714
  caption:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.667
  label:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 500
    lineHeight: 1.5
rounded:
  dot: "4px"
  base: "8px"
  field-web: "12px"
  field-native: "14px"
  ghost-cell: "16px"
  skin-preview: "18px"
  piece: "19px"
  board: "20px"
  card: "24px"
  pill: "24px"
  pill-lg: "32px"
spacing:
  "1": "4px"
  "1-5": "6px"
  "2": "8px"
  "2-5": "10px"
  "3": "12px"
  "3-5": "14px"
  "4": "16px"
  "4-5": "18px"
  "5": "20px"
  "6": "24px"
components:
  button-primary-web:
    backgroundColor: "{colors.sage-dark}"
    textColor: "{colors.white}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "0 16px"
    height: "40px"
  button-primary-web-hover:
    backgroundColor: "{colors.sage-pressed}"
    textColor: "{colors.white}"
  button-primary-native:
    backgroundColor: "{colors.sage-dark}"
    textColor: "{colors.white}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "0 16px"
    height: "48px"
  button-secondary:
    backgroundColor: "{colors.sage-soft}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
  card-default:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "16px"
  card-secondary:
    backgroundColor: "{colors.sage-wash}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "16px"
  input-web:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.field-web}"
    padding: "8px 12px"
  input-native:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.field-native}"
    padding: "0 12px"
    height: "48px"
  game-board:
    backgroundColor: "{colors.board-light}"
    rounded: "{rounded.board}"
    width: "min(100%, 560px)"
---

# Design System: The L Game

## Overview

**Creative North Star: "The Quiet Strategy Table"**

The interface should feel like a well-kept tabletop game: warm paper around a compact field of play, sage structure, and a small number of decisive marks. It is calm rather than decorative. The board, the active side, the clock, and the next legal action form the visual hierarchy; account, social, cosmetic, and legal surfaces remain supportive.

The system is adaptive, not visually identical across platforms. Shared React components preserve meaning and brand, while HeroUI React supplies web interaction conventions and HeroUI Native supplies iOS and Android controls, scaling, gestures, and surfaces. The web and native wrappers must expose the same product-level variants without erasing platform behavior.

The voice is direct and instructional. Short labels such as “Submit L,” “Skip disc,” “Reconnecting,” and “Return home” explain the next action or current state without game-themed flourish.

**Key Characteristics:**

- Warm, light-only paper foundation with cream surfaces and sage hierarchy.
- Board-first composition with limited chrome and generous breathing room.
- Warm-versus-cool player identity, reinforced by names and status copy.
- Rounded, tactile controls from HeroUI; no bespoke web controls on native.
- Visible connection, clock, and result authority at every match stage.

## Colors

The palette is a restrained mix of paper neutrals and botanical greens; red and blue carry player identity, while semantic tints communicate service state.

### Primary

- **Table Sage** (`sage-dark`): the main action color, selected cosmetic state, active rules progress, and core brand accent.
- **Pressed Sage** (`sage-pressed`): web hover/pressed feedback and the darker board-frame edge.
- **Soft Sage** (`sage-soft`, `sage-wash`): secondary actions, selected cards, explanatory panels, current-player surfaces, and empty states.

### Secondary

- **Player Red** (`brand-red`): the durable identity token for the warm side.
- **Player Blue** (`brand-blue`): the durable identity token for the cool side.
- **Classic Piece Red / Blue** (`classic-player-red`, `classic-player-blue`): the rendered Classic skin. These gameplay colors are intentionally brighter than the root identity tokens.

Alternative piece skins may change the hues, but every pair keeps one warm side and one cool side and supplies readable side names. The implemented pairs are Classic Red/Blue, Orchard Plum/Teal, Ember Amber/Indigo, Foundry Rust/Steel, Orchid Rose/Violet, and Signal Coral/Slate.

### Tertiary

- **Connected Green** (`status-success-bg`, `status-success-fg`): online and connected states.
- **Attention Amber** (`status-warning-bg`, `status-warning-fg`): queueing, waiting, and reconnecting states.
- **Authority Red** (`status-danger-bg`, `status-danger-fg`): disconnected or failed states; solid `danger` is reserved for destructive controls.
- **Clock Red** (`timer-danger`): an active player clock at 30 seconds or less.

### Neutral

- **Game Paper** (`paper`): the app background and browser theme color.
- **Raised Paper** (`paper-raised`): header and fixed navigation surfaces.
- **Porcelain Surface** (`surface`): cards and fields.
- **Charcoal Ink** (`ink`): primary text.
- **Quiet Ink** (`ink-muted`): supporting copy and non-critical messages.
- **Hairline** (`line`): header, navigation, and card separation.
- **Field Hairline** (`field-line`): input boundaries.
- **Sage Board** (`board-light`, `board-dark`, `board-outline`): the default checkerboard and its structural outline.
- **Neutral Disc** (`neutral-disc`): movable neutral pieces; selection is shown by size and a player-colored ring.

**The Gameplay Color Rule.** Never use color alone to identify a player or a network state. Pair it with side names, player names, status text, selection geometry, and accessible labels.

**The Red Reserve Rule.** Player red may fill game pieces; destructive red belongs to destructive actions and error states; timer red appears only under immediate clock pressure.

## Typography

**Display and Body Font:** the platform system sans through HeroUI and Uniwind. Web resolves to a system UI stack; native retains the iOS or Android system face. No custom font is loaded.

**Character:** compact, contemporary, and highly legible. Weight and size establish hierarchy; the system does not rely on decorative type, italics, or dramatic tracking.

### Hierarchy

- **Display** (`display`, HeroUI `h1`): page titles and the current rules-slide title.
- **Headline** (`headline`, HeroUI `h2`): section headings, player ratings, major empty-state messages, and active clocks.
- **Title** (`title`, HeroUI `h3`): app wordmark, match type, card subheads, ranks, and compact numeric emphasis.
- **Body** (`body`, HeroUI `body`): instructions, legal copy, form content, and ordinary state messages.
- **Supporting** (`supporting`, HeroUI `body-sm`): role, connection detail, records, and subordinate metadata.
- **Caption** (`caption`, HeroUI `body-xs`): compact player roles and similarly secondary labels.
- **Label** (`label`): button, tab, field, and chip labels. Medium, semibold, and bold are intentional emphasis variants, not new scale steps.

Match-type labels, the wordmark, rule eyebrows, and selected cosmetic descriptions use short uppercase strings. Sentence copy stays in sentence case. Numeric ranks, ratings, scores, and clocks should remain tabular-looking and scannable even though the current system font is proportional.

Native text continues to allow system font scaling. Web headings render as semantic HeroUI typography elements; alerts use polite live-region behavior. Do not replace system typography with fixed-pixel text that disables Dynamic Type or Android font scaling.

**The One Scale Rule.** Use `UIText` roles rather than selecting a new font size inside a screen. A one-off color or alignment override is acceptable; a one-off type scale is not.

## Layout

The underlying rhythm is four pixels. Most component gaps use `spacing.2` through `spacing.4`; screen groups use `spacing.4` or `spacing.4-5`; desktop padding uses `spacing.6`. Dense rows may use the smaller six- and eight-pixel steps, but unrelated sections need a full 16–18 pixels.

The global header spans the viewport but keeps its contents inside an 1180px rail. Non-match screens form a single centered reading column with a 680px maximum width. They receive 16px padding below 600px and 24px at wider sizes, plus 110px of bottom clearance for the fixed primary tabs. The header and fixed navigation sit on Raised Paper with one-pixel Hairlines.

Match layout is board-first. Below 900px, the board and match controls stack in a column within a 620px rail. At 900px and above, they become a row within an 1100px rail: the square board flexes up to 600px and the status/action panel stays at or below 390px. The board itself is square, fills available width, and stops at 560px.

The app shell uses a safe-area view on every platform. Native content must continue respecting status bar, display cutout, home indicator, navigation bar, and keyboard insets. Android system Back closes rules, closes legal content, requests confirmation before forfeiting an active online match, or returns to Play in that order; it falls through to the operating system from the Play root. iOS navigation must preserve native dismissal and edge-back expectations where navigation stacks are introduced.

Rows use flex wrapping when labels or translated copy can grow: account actions, social actions, legal links, and friend rows are already designed this way. Do not preserve a desktop row if it causes clipped labels on small screens or at larger text sizes.

**The Board-First Rule.** On every match viewport, the board and current-turn status appear before secondary controls and must never be visually outscaled by navigation or account chrome.

## Elevation & Depth

Depth is restrained and structural. Paper, Porcelain, and Soft Sage establish most hierarchy through tonal layering and one-pixel borders. Standard cards use HeroUI’s low surface shadow on web/native, with the web wrapper additionally applying its small shadow treatment. Transparent cards remove both border and shadow.

The game board is the one strongly lifted object: a deep green frame, 12px vertical offset, 24px blur, and 16% dark-green shadow, with Android elevation 8. This makes the physical play surface feel primary without turning the rest of the interface into a stack of floating panels. HeroUI owns dialog/overlay elevation and backdrop behavior on each platform.

**The One Lifted Object Rule.** In a match, reserve pronounced elevation for the board. Status cards and controls use tonal contrast, borders, and the library’s low surface depth.

## Shapes

The form language is gently rounded and tactile. HeroUI’s eight-pixel base radius expands to platform field radii, 24px card surfaces, and pill-shaped buttons and segmented tabs. Large buttons use the larger pill radius. The game board uses a 20px clipped frame; skin previews use 18px.

Board geometry is more expressive but still systematic: placed pieces use 19px corners, ghost cells use 16px corners, legal targets are circles, and neutral pieces are discs. The recurring square, rounded-square, and circle silhouettes make legal state readable without extra decoration.

Borders are functional. Use them to separate paper surfaces, define fields, show an active seat in that player’s color, or preserve board edges. Avoid ornamental divider grids inside content.

## Components

The application owns a small adaptive wrapper API: `UIProvider`, `UIButton`, `UIText`, `UITextField`, `UICard`, `UIChip`, `UIAvatar`, `UIModal`, and `UITabs`. Screens use these wrappers instead of importing either HeroUI package directly.

### Platform implementation

| Concern | Web | iOS / Android |
| --- | --- | --- |
| Library | HeroUI React with `@heroui/styles` | HeroUI Native with Uniwind-generated styles |
| Provider | No extra HeroUI provider in the wrapper | Gesture-handler root, safe-area provider, then HeroUI Native provider |
| Modal | Centered HeroUI `Modal`, contained scrolling, close trigger when dismissable | HeroUI Native `Dialog` portal/overlay, 88% max height, four-side margin, contained scrolling, close control when dismissable |
| Tabs | HeroUI `Tabs` with ARIA label and selected key | HeroUI Native `Tabs` with indicator, trigger, and label compounds |
| Input | DOM input with correct email, URL, password, autocomplete, disabled, ARIA, and test attributes | Native input with keyboard type, secure entry, autocomplete, disabled state, accessibility label, and test ID |
| Avatar | DOM image with alternate text and initials fallback | Native remote image with accessibility label and initials fallback |
| Interaction | Hover, focus-visible ring, pressed scaling, pointer and keyboard behavior from HeroUI | Press feedback, gestures, platform accessibility, and sizing from HeroUI Native |

The wrapper is the contract. A variant added to one platform must have a meaningfully equivalent implementation on the other, even when visual metrics or motion differ.

### Buttons

- **Primary:** solid Table Sage with a light label; used for the next decisive action.
- **Secondary:** Soft Sage with dark ink; used for an alternate game mode or secondary commitment.
- **Outline:** clear surface, Sage Outline border, dark-sage label; used for equivalent choices such as Casual and Ranked.
- **Ghost:** transparent until interaction; used for navigation, cancellation, rules, and low-priority utilities.
- **Danger:** solid destructive red; reserved for irreversible or harmful actions, not ordinary “Leave” navigation.
- **Sizes:** web follows HeroUI’s compact responsive heights; native enforces a 48dp minimum height at every size and retains HeroUI’s larger treatment for large controls. All standalone native targets satisfy at least 44pt on iOS and 48dp on Android.
- **States:** web uses the darker or softer brand hover tokens and HeroUI’s focus-visible ring/pressed scale. Disabled controls retain their label but use HeroUI’s reduced opacity and reject input. Honor reduced-motion settings.

### Cards / Containers

Cards are warm, rounded grouping surfaces with 16px internal padding. Default cards are Porcelain with a warm Hairline; secondary cards use Soft Sage with a sage border; transparent cards remove surface, border, and shadow. Use secondary cards for current rank, current player, connection detail, instructions, initialization, and empty states—not as generic decoration.

### Inputs / Fields

Fields use a Porcelain background, Charcoal Ink, muted placeholder text, and a warm neutral border. They are full-width inside their field group and always have a visible text label or explicit accessibility label. Web preserves semantic type and autocomplete attributes; native preserves keyboard type, secure entry, and platform autocomplete. HeroUI owns focus, invalid, and disabled mechanics.

### Chips and status

Chips are compact, rounded state labels rather than action buttons. Default is neutral; success means online/connected; warning means queueing/waiting/reconnecting; danger means disconnected or failed. A chip’s text must name the state. Connection problems also receive a secondary card with title, detail, and countdown/time when available.

Transient auth, friends, leaderboard, locker, and general game messages are supporting text with alert semantics. Use a modal only for a focused rules task or a match result that requires an explicit next action.

### Navigation

The four top-level destinations are Play, Leaders, Friends, and Locker. They live in a fixed bottom segmented tab surface when no match or legal page is active. The active tab uses the HeroUI indicator; the control stays within the same 680px content rail as screens. In-match navigation becomes two quiet actions—Leave and Rules—around a centered match label and connection chip.

### Avatars

DiceBear avatars are circular identity aids with uppercase initials as the fallback. They do not replace the visible player name. Active seat avatars may receive the player’s side color as their background, while the seat border and text still carry active/role information.

### Game board

The same React Native SVG board renders on web, iOS, and Android. It uses a 400-unit view box split into sixteen 100-unit cells. Alternating skin colors and two-unit outlines create the grid.

- Placed L pieces sit eight units inside each cell, with a translucent white edge.
- The pending L is a 66-unit rounded ghost at 20% opacity with a dashed player-color stroke.
- Legal targets are centered 15-unit circles in the board outline at 62% opacity.
- Cells drawn during the current move gain increasing opacity and a stronger white edge.
- Neutral discs are 24-unit circles; selection grows them to 28 units and changes the ring from board outline to the acting player color.
- Sixteen transparent `Pressable` regions sit above the SVG, one per 25% cell. They keep touch, pointer, keyboard, test, and screen-reader interaction independent from drawing.
- Each cell exposes a coordinate (`A1`–`D4`), occupancy or legal-target description, disabled state, and a build-move hint when actionable. Drawn L squares, the selected neutral disc, and its pending destination expose selected state and explicit progress descriptions; legal targets are described without being misreported as selected.

The board accepts input only while the player can act and the result modal is closed. The action panel mirrors the two phases: build and submit the L, then optionally move or skip a neutral disc. Clear, Submit L, Skip disc, and Confirm move remain adjacent to the board and reflect legal availability through disabled state.

### Rules and results

Rules use a five-slide modal with a Soft Sage teaching card, short uppercase eyebrow, display title, body instruction, and progress marks. The active mark stretches from a dot to a capsule and uses Table Sage. Match results use a non-dismissable modal with one large replay/rematch action and one ghost return action, ensuring every completed match has a safe exit.

## Do's and Don'ts

### Do:

- **Do** keep the board, current turn, active clock, and next legal action as the match hierarchy.
- **Do** use the shared UI wrappers so HeroUI React and HeroUI Native remain behaviorally aligned.
- **Do** pair every player color and connection color with a name, label, geometry change, or accessible state.
- **Do** retain safe areas, Android Back behavior, scalable native text, reduced-motion handling, keyboard navigation, and visible web focus.
- **Do** keep touch targets at least 44pt on iOS and 48dp on Android; enlarge the hit area when a visually small control is necessary.
- **Do** preserve cell-level board labels and one independent interactive target for each of the sixteen squares.
- **Do** wrap dense action rows and test them at narrow widths and increased text sizes.

### Don't:

- **Don't** import HeroUI React into shared/native screens or HeroUI Native into web-specific wrappers.
- **Don't** recolor a player skin without retaining a named warm/cool distinction and adequate contrast against every supported board skin.
- **Don't** hide queueing, reconnecting, disconnected, clock pressure, or server-authoritative results behind color or animation alone.
- **Don't** add ornamental gradients, glass effects, heavy shadows, or extra accent colors to routine cards and settings.
- **Don't** invent custom native navigation, back gestures, dialogs, switches, or web-shaped controls when the platform or HeroUI already supplies the convention.
- **Don't** place fixed bottom navigation over scroll content; retain the shell’s bottom clearance and safe-area padding.
- **Don't** disable focus, font scaling, screen-reader labels, or reduced-motion behavior to preserve a fixed composition.
