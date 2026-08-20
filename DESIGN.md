---
name: The L Game
description: A dark, board-first interface where the lit play surface is the only bright object and every screen states the next legal action.
colors:
  stage: "#0d1411"
  stage-deep: "#080d0b"
  panel: "#16211c"
  panel-raised: "#1f2d27"
  panel-sunken: "#101a15"
  edge: "#22302a"
  edge-mid: "#2c3b34"
  edge-strong: "#33443e"
  text: "#f2efe4"
  text-dim: "#9fb0a6"
  text-muted: "#8b9d93"
  text-faint: "#71847a"
  text-ghost: "#5d6f66"
  mint: "#7fd6a6"
  mint-press: "#6ac492"
  mint-ink: "#08150e"
  amber: "#e8b562"
  danger: "#e5695c"
  danger-press: "#c9564a"
  board-frame: "#3f5a48"
  board-frame-edge: "#55755c"
  board-light: "#e8dfc9"
  board-dark: "#91a878"
  board-outline: "#38563c"
  classic-player-red: "#cf5c4f"
  classic-player-blue: "#4778ad"
  neutral-disc: "#f8f5ec"
typography:
  display:
    fontFamily: "Archivo, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "40px"
    fontWeight: 800
    lineHeight: 1.05
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "Archivo, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "26px"
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: "-0.03em"
  hero:
    fontFamily: "Archivo, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "23px"
    fontWeight: 800
    lineHeight: 1.17
    letterSpacing: "-0.03em"
  title:
    fontFamily: "Archivo, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "18px"
    fontWeight: 700
    lineHeight: 1.22
    letterSpacing: "-0.015em"
  body:
    fontFamily: "Archivo, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "14.5px"
    fontWeight: 400
    lineHeight: 1.45
  supporting:
    fontFamily: "Archivo, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "12.5px"
    fontWeight: 400
    lineHeight: 1.4
  caption:
    fontFamily: "Archivo, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "11.5px"
    fontWeight: 400
    lineHeight: 1.35
  eyebrow:
    fontFamily: "Archivo, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "10px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.16em"
    textTransform: "uppercase"
  numeric:
    fontFamily: "'Azeret Mono', ui-monospace, 'SF Mono', Menlo, monospace"
    fontSize: "19px"
    fontWeight: 700
    letterSpacing: "-0.02em"
rounded:
  pip: "3px"
  ribbon: "10px"
  glyph: "12px"
  control: "14px"
  card: "16px"
  panel: "18px"
  hero: "20px"
  board: "20px"
  piece: "19%"
  chip: "999px"
spacing:
  "1": "4px"
  "1-5": "6px"
  "2": "8px"
  "2-5": "10px"
  "3": "12px"
  "3-5": "14px"
  "4": "16px"
  "5": "20px"
  "6": "24px"
components:
  action-primary:
    backgroundColor: "{colors.mint}"
    textColor: "{colors.mint-ink}"
    fontWeight: 700
    rounded: "{rounded.control}"
    minHeight: "48px"
  action-primary-disabled:
    backgroundColor: "{colors.panel-raised}"
    borderColor: "{colors.edge-strong}"
    textColor: "{colors.text-faint}"
  action-secondary:
    backgroundColor: "{colors.panel}"
    borderColor: "{colors.edge-strong}"
    textColor: "{colors.text-dim}"
    rounded: "{rounded.control}"
    minHeight: "48px"
  panel-default:
    backgroundColor: "{colors.panel}"
    borderColor: "{colors.edge}"
    rounded: "{rounded.card}"
    padding: "13px"
  directive-live:
    backgroundColor: "rgba(127, 214, 166, 0.05)"
    borderColor: "rgba(127, 214, 166, 0.22)"
    rounded: "{rounded.card}"
  seat-active:
    backgroundColor: "the acting side's piece colour at 14%"
    borderColor: "the acting side's piece colour at 50%"
    rounded: "{rounded.control}"
  game-board:
    frameColor: "{colors.board-frame}"
    rounded: "{rounded.board}"
    padding: "5px"
    shadow: "the acting side's piece colour, 0 14px 28px, 45% opacity"
---

# Design System: The L Game

## Overview

**Creative North Star: "One Lit Board in a Dark Room"**

The interface is a darkened room with a single illuminated object in it. Everything that is not the
play surface — chrome, seats, panels, navigation — sits in near-black greens and recedes. The board
keeps the warm cream-and-sage palette of a physical board, so it is the brightest thing on any
screen by construction rather than by emphasis, and it carries a coloured lift tinted with whichever
side is on the move.

Around that board, the interface has one job: say what the player is meant to do next, and which of
their options can do anything right now. Every match state produces a single structured directive —
whose move it is, which half of the turn it is, one instruction, and how far through it you are —
and a fixed row of three action slots that never move or disappear.

**Key Characteristics:**

- Dark, desaturated green-black ground with the untouched board palette as the only bright surface.
- The board's shadow is tinted with the acting side's colour: whose turn it is reads before any text.
- One instruction panel per state, sized to be read at a glance rather than squeezed into a status line.
- Three action slots, always all three; an unavailable control greys out and says why.
- One mint action colour, used for exactly one primary per screen.
- A first run that teaches by playing rather than by reading.

## Colors

The palette is a dark botanical neutral with one luminous accent, plus the warm board colours it
exists to frame.

### Primary

- **Mint** (`mint`): the one action colour. It carries the single primary control on any screen and
  nothing else. Dark ink sits on it, never white.
- **Pressed Mint** (`mint-press`): the pressed and hovered state.
- **Mint Ink** (`mint-ink`): the near-black used for text on mint.

### Secondary

- **Player Red / Player Blue** (`classic-player-red`, `classic-player-blue`): the default side
  identities, and the source of every tint that means "this side". Alternative skins in `skins.ts`
  change the hues but always keep one warm and one cool side with readable names.
- The acting side's colour tints three things at once: the board's lift, the active seat's fill and
  border, and the directive's badge. They are always the same colour at the same moment.

### Tertiary

- **Amber** (`amber`): queueing, waiting, reconnecting, and any requirement standing between the
  player and a mode they wanted.
- **Danger** (`danger`): clock pressure at 30 seconds or less, disconnection, and destructive
  controls.

### Neutral

- **Stage** (`stage`, `stage-deep`): the app ground and the deeper letterbox behind the playfield.
- **Panel / Raised / Sunken** (`panel`, `panel-raised`, `panel-sunken`): cards and rows, their
  pressed state, and surfaces that sit below the page such as fields and the tab bar.
- **Edges** (`edge`, `edge-mid`, `edge-strong`): hairlines in rising strength.
- **Text** (`text` → `text-ghost`): a warm paper white and four steps down from it. The white is warm
  on purpose; a neutral grey reads blue against these greens.
- **Board** (`board-light`, `board-dark`, `board-outline`, `board-frame`): carried over unchanged
  from the printed board. Do not darken them to "match" the interface — the contrast is the design.

**The Gameplay Color Rule.** Never use colour alone to identify a player or a network state. Pair it
with side names, player names, status text, selection geometry, and accessible labels. The match
screen names both sides in every seat; the tutorial carries an explicit legend.

**The Two Rings Rule.** The board draws several dashed rings and they must stay tellable apart by
size and weight, not only by colour: the trail where an L was is small and finely dashed, the halo
saying a disc is live is large and boldly dashed, and a ring that lands on top of a piece is drawn
in paper white, because a ring in the piece's own colour is invisible.

## Typography

**Display and body:** Archivo on web, loaded from Google Fonts in `app/+html.tsx`. Native keeps the
platform system face: loading webfonts there would add a dependency and give up the platform's own
text scaling, which the board-first layout depends on.

**Numerals:** Azeret Mono for clocks, ratings, ranks, turn counts, and the numbers drawn on traced
squares. Anything whose digits change while being watched is monospaced so the row does not shift.

### Hierarchy

- **Display** (40/800): the welcome headline and the match result.
- **Headline** (26/800): screen titles — Leaderboard, Friends, Locker.
- **Hero** (23/800): the lobby's single primary offer.
- **Title** (18/700): the directive instruction and the tutorial's coaching line.
- **Body** (14.5): result reasons, empty states, explanatory copy.
- **Supporting** (12.5): the directive's second line, row descriptions.
- **Caption** (11.5): the objective ribbon, seat metadata, records.
- **Eyebrow** (10/700, uppercase, 0.16em): match type, turn badge, step counter, column headings,
  stat labels. Short strings only — an eyebrow is never a sentence.

**The One Scale Rule.** Use the roles above rather than choosing a new size inside a screen. Weight
and colour are the tools for emphasis within a role.

## Layout

The rhythm is four pixels; most gaps are 8–16px and screen padding is 16px below 600px, 24px above.

**Match layout** is a fixed frame that never scrolls, because scrolling a board somebody is dragging
on is the worst of both worlds. Below 900px it is the tallest 9:16 box that fits, stacked: header,
objective ribbon, opponent seat, board, your seat, directive, actions. At 900px and above the match
frame widens to 1120px and becomes two panes — the board takes the whole height on the left, and a
360px column on the right holds the seats at the top and the objective, directive and actions as one
block at the bottom, next to the controls they describe.

The board is measured, never assumed: the panel beneath it reports its own height and the board
takes the largest square that fits what is left. A hard-coded footer height is how the board ends up
drawn over the seat above it.

**Other screens** are a single 680px reading column above a fixed icon tab bar, and they may scroll.
Their content container grows to the viewport so a short screen can push its own footer to the
bottom rather than stranding it mid-page.

**The Board-First Rule.** On every match viewport the board and the current directive come before
secondary controls, and nothing is allowed to outscale the board.

## Elevation & Depth

Depth is almost entirely tonal: panels are lighter greens with one-pixel edges, and there are no
drop shadows on ordinary cards.

The board is the exception and the point. It carries a coloured lift — the acting side's piece
colour at 45% opacity, 28px blur, 14px down — drawn on an outer view while an inner view clips the
squares, because `overflow: hidden` and a shadow on the same element cancel out on Android.

**The One Lifted Object Rule.** In a match, only the board is lifted. Everything else earns its
separation from tone and hairlines.

## Shapes

Controls are 14px rounded rectangles at a 48px minimum height; cards are 16px; hero surfaces and the
board are 20px; chips and pips are fully round. Board geometry is unchanged from the physical game:
pieces sit 7% inside their square with 19% corners, discs are circles, legal squares are circles.

Borders are functional — separating a surface, defining a field, marking an active seat in its own
colour, or ringing a piece the copy is talking about. There is no ornamental rule anywhere.

## Components

Two families, deliberately.

**HeroUI wrappers** (`components/ui`) — `UIProvider`, `UIButton`, `UIText`, `UITextField`, `UICard`,
`UIChip`, `UIAvatar`, `UIModal`, `UITabs` — keep the platform's own behaviour for forms, dialogs,
avatars and the legal pages. Their brand colours are mapped to the dark palette; the wrapper is
still the contract, and a variant added to one platform needs a real equivalent on the other.

**Match chrome** (`components/chrome.tsx`) — `Action`, `IconButton`, `Icon`, `Eyebrow`, `Mono`,
`Panel`, `Pips`, `Dot`, `Tag` — covers the shapes HeroUI has no equivalent for. Icons are inline
stroke SVG on a 24px grid; there are no emoji anywhere in the product.

### The directive

One panel, produced by the controller for every match state, carrying: a colour-coded badge naming
who is on the move, a step counter ("Step 1 of 2", "Step 2 of 2 · optional"), the instruction in
18px, one supporting sentence, four progress pips, and — only while a turn has not been started — a
"Show me a move" affordance that outlines one legal L.

No screen composes this text itself. That is what stops a turn, a connection problem and a clock all
trying to speak through the same line at once.

### The action bar

Three slots, in the same places, every turn:

1. **Undo** (icon) — takes back the last thing you did, whatever that was: the last square while
   tracing, the disc while placing it, the whole L once the disc is home.
2. **Secondary** — "Clear" while tracing, "Redraw L" once placed.
3. **Primary** — the commit. When it cannot be pressed it says why: "Place your L first",
   "Their turn".

**The Standing Controls Rule.** A control the player has learned never disappears; it greys out, and
the reason is written on it or directly above it.

### Navigation

Four destinations — Play, Leaders, Friends, Locker — in a fixed bottom bar with an icon and a word
each. A bare icon row is a memory test and a bare word row is hard to hit, so neither is dropped.
In a match the navigation becomes two icon controls, Leave and Rules, around the match type, turn
number, and connection state.

Android system Back closes rules, closes legal content, leaves the tutorial, confirms before
forfeiting a live online match, or returns to Play, in that order.

### The board

One React Native SVG board on every platform. Sixteen transparent `Pressable` regions sit above the
drawing, one per square, keeping touch, pointer, keyboard, test and screen-reader interaction
independent of how the board is painted. A drag handler on the frame claims the gesture only once
the pointer actually travels, so dragging never costs the board its keyboard behaviour.

Every square exposes a coordinate (`A1`–`D4`) and its state. Traced squares carry their position in
the trace as a drawn numeral, which is what makes "tap a numbered square to step back to it" a
visible offer rather than a hidden one.

### First run

A new player gets a welcome screen that says what the game is, then a five-step tutorial where two
of the steps are the real board wired to the real rules engine. Only legal squares are lit, so a
beginner cannot make an illegal move — not because it is rejected, but because there is nothing
illegal to tap. The coaching sits under the board, in the same place the match screen puts its
directive, so the lesson teaches where to look as well as what to do.

The tutorial's closing position is asserted in `rules.test.ts` against the real move generator. A
lesson that claims a win must be showing one.

### Results

A screen, not a dialog. It names how the match ended in a sentence written about whoever lost it,
shows the finishing position with the trapped piece ringed in paper white, and reports the turn count
and — once the server's new rating has actually replicated — the rating change. A delta is never
guessed: if the new rating has not arrived, the line is left out.

## Do's and Don'ts

### Do:

- **Do** keep the board the brightest and largest object in any match viewport.
- **Do** put every match state through the controller's directive, so one state cannot produce two
  competing messages.
- **Do** keep all three action slots rendered, and say why a disabled one is disabled.
- **Do** pair every colour with a name, label, geometry change, or accessible state.
- **Do** measure the board against the space its controls actually took.
- **Do** keep touch targets at 48px and up, and retain safe areas, Android Back, native text
  scaling, reduced-motion handling and visible web focus.
- **Do** state a requirement on the row it applies to — "Claim a name" on the ranked row — rather
  than disabling a control silently.

### Don't:

- **Don't** darken the board palette to match the interface; the contrast is the whole idea.
- **Don't** add a second accent colour, or use mint for anything that is not the single primary.
- **Don't** put two dashed rings of the same size and weight on the board at the same time.
- **Don't** ring a piece in its own colour — use the paper-white outline.
- **Don't** hide queueing, reconnecting, disconnection, clock pressure or a server result behind
  colour or animation alone.
- **Don't** import HeroUI React into shared or native screens, or HeroUI Native into web wrappers.
- **Don't** put a control in the match chrome that only appears sometimes.
- **Don't** invent numbers the server does not produce — no rating deltas, percentiles or histories
  that are not computed from replicated state.
