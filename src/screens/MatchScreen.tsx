import { useState } from "react";
import { ActivityIndicator, Pressable, Text, View, type LayoutChangeEvent } from "react-native";
import type { GameController } from "../game/controller";
import type { DirectiveView, GameView, SeatView } from "../game/types";
import { css, cssAlpha, PIECE_SKINS, type Rgb } from "../skins";
import { COLOR, EYEBROW, FONT, RADIUS, alpha } from "../theme";
import { GameBoard } from "../components/GameBoard";
import { Action, Dot, Eyebrow, Icon, IconButton, Mono, Pips, Tag } from "../components/chrome";
import { useChangeMotion, useEnterMotion, useReducedMotion } from "../game/motion";
import { UIAvatar, UIButton, UIModal, UIText } from "../components/ui";

const MODE_LABEL = (view: GameView) =>
  view.mode === "online" ? (view.ranked ? "Ranked" : "Casual") : view.mode === "cpu" ? "vs Computer" : "Pass and play";

const clockText = (seconds: number) => {
  const safe = Math.max(0, seconds);
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
};

/**
 * The match fills its frame and never scrolls.
 *
 * Reading order down the screen is: who you are playing and how long they have, the board, who you
 * are, then what to do about it. The instruction sits directly above the controls that carry it out
 * so the sentence and the button that answers it are never more than a thumb apart, and the win
 * condition rides along the top for the whole match rather than living in a rules dialog.
 */
export function MatchScreen({ controller, view, wide }: {
  controller: GameController; view: GameView; wide?: boolean;
}) {
  const reduced = useReducedMotion();
  const directiveRef = useChangeMotion(view.directive.title, reduced);
  const seatsRef = useEnterMotion(reduced);
  const sides = PIECE_SKINS[view.pieceSkin].colors;
  const [top, bottom] = view.seats;

  const header = (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      <IconButton name="back" label="Leave this match" size={38} onPress={() => controller.requestLeaveMatch()} />
      <View style={{ flex: 1, alignItems: "center", gap: 2 }}>
        <Eyebrow color={COLOR.mint}>{MODE_LABEL(view)}</Eyebrow>
        <Text style={{ fontFamily: FONT.ui, fontSize: 12, fontWeight: "600", color: COLOR.textFaint }}>
          Turn {view.turnNumber}
        </Text>
      </View>
      <Connection view={view} />
      <IconButton name="help" label="How to play" size={38} onPress={() => controller.openRules()} />
    </View>
  );

  // The win condition, on screen for the whole match. Knowing what a good move is for is the part
  // a rules dialog cannot help with once it has been dismissed.
  const objective = (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingVertical: 7,
        paddingHorizontal: 12,
        borderRadius: 10,
        backgroundColor: alpha(COLOR.text, 0.04),
        borderWidth: 1,
        borderColor: COLOR.edge,
      }}
    >
      <Icon name="target" size={13} color={COLOR.textFaint} />
      <Text style={{ flex: 1, fontFamily: FONT.ui, fontSize: 11.5, lineHeight: 15, color: COLOR.textMuted }}>
        Goal — {view.objective}
      </Text>
    </View>
  );

  const board = (
    <GameBoard
      frame={view.board}
      enabled={view.canAct && !view.resultOpen}
      phase={view.phase}
      onCellPress={(cell) => controller.selectCell(cell)}
      onDrawTo={(cell) => controller.drawTo(cell)}
      onPickDisc={(index) => controller.pickDisc(index)}
      onDragDiscTo={(cell) => controller.dragDiscTo(cell)}
    />
  );

  const directive = (
    <View ref={directiveRef}>
      <Directive
        directive={view.directive}
        side={sides[view.board.mover]}
        canHint={view.actions.canHint}
        onHint={() => controller.showHint()}
      />
    </View>
  );

  const actions = <Actions controller={controller} view={view} />;

  return (
    <View style={{ flex: 1, width: "100%" }}>
      {header}

      {wide ? (
        // With room to spare, the board stops competing with the panel for vertical space and the
        // two sit side by side - the arrangement every desktop board game settles on, because the
        // board can then be as large as the window is tall.
        <View style={{ flex: 1, flexDirection: "row", gap: 24, marginTop: 14, minHeight: 0 }}>
          <SquareFitter>{board}</SquareFitter>
          <View style={{ width: 360, gap: 10 }}>
            <View ref={seatsRef} style={{ gap: 10 }}>
              <Seat seat={top} side={sides[top.player]} />
              <Seat seat={bottom} side={sides[bottom.player]} />
            </View>
            {/* Who is playing sits at the top; everything about the move in front of you is one
                block at the bottom, next to the controls that make it. One gap, not two. */}
            <View style={{ flex: 1, minHeight: 10 }} />
            {objective}
            {directive}
            {actions}
          </View>
        </View>
      ) : (
        <>
          <View style={{ marginTop: 10 }}>{objective}</View>
          <View ref={seatsRef} style={{ marginTop: 10 }}>
            <Seat seat={top} side={sides[top.player]} />
          </View>
          <BoardFitter
            footer={
              <View style={{ gap: 10 }}>
                <Seat seat={bottom} side={sides[bottom.player]} />
                {directive}
                {actions}
              </View>
            }
          >
            {board}
          </BoardFitter>
        </>
      )}

      {/* Read out to screen readers as the turn changes; the panel above is the visual form. */}
      <UIText type="body-sm" accessibilityRole="alert" style={{ height: 0, opacity: 0 }}>
        {view.status}
      </UIText>

      <UIModal
        open={view.leaveConfirmOpen}
        onOpenChange={(open) => open ? undefined : controller.cancelLeaveMatch()}
        title="Leave this match?"
        description="Leaving an active online match counts as a forfeit."
        dismissable
      >
        <View style={{ gap: 12, paddingTop: 18 }}>
          <UIButton fullWidth variant="danger" onPress={() => controller.confirmLeaveMatch()}>Leave and forfeit</UIButton>
          <UIButton fullWidth variant="ghost" onPress={() => controller.cancelLeaveMatch()}>Keep playing</UIButton>
        </View>
      </UIModal>
    </View>
  );
}

function Connection({ view }: { view: GameView }) {
  const state = view.connection?.state;
  const offline = state === "disconnected";
  const unsettled = state && state !== "connected";
  if (view.mode !== "online") return <View style={{ width: 4 }} />;
  return (
    <Tag
      tint={offline ? COLOR.danger : unsettled ? COLOR.amber : COLOR.mint}
      color={offline ? COLOR.danger : unsettled ? COLOR.amber : COLOR.mint}
    >
      {view.connection?.label ?? "Live"}
    </Tag>
  );
}

/**
 * The largest centred square that fits, for the side-by-side desktop layout where the board is
 * bounded by the window height rather than by the controls underneath it.
 */
function SquareFitter({ children }: { children: React.ReactNode }) {
  const [size, setSize] = useState(0);
  return (
    <View
      style={{ flex: 1, alignItems: "center", justifyContent: "center", minHeight: 0 }}
      onLayout={(event: LayoutChangeEvent) => {
        const { width, height } = event.nativeEvent.layout;
        const next = Math.floor(Math.max(0, Math.min(width, height)));
        if (next !== size) setSize(next);
      }}
    >
      {size > 0 ? <View style={{ width: size, height: size }}>{children}</View> : null}
    </View>
  );
}

/** Breathing room between the board and the panel under it. */
const BOARD_GAP = 12;

/**
 * Gives the board the largest square that fits whatever the controls did not use.
 *
 * A percentage width with `aspectRatio: 1` overflows a short viewport, and `maxHeight` does not
 * constrain an aspect-ratio box the way it would in CSS, so the size is measured and applied. The
 * footer is measured rather than assumed: its height moves with the instruction copy, and a
 * hard-coded guess is how the board ended up drawn over the seat above it.
 */
function BoardFitter({ children, footer }: { children: React.ReactNode; footer: React.ReactNode }) {
  const [area, setArea] = useState({ width: 0, height: 0 });
  const [footerHeight, setFooterHeight] = useState(0);

  const measureArea = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width !== area.width || height !== area.height) setArea({ width, height });
  };
  const measureFooter = (event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout.height;
    if (Math.abs(next - footerHeight) > 0.5) setFooterHeight(next);
  };

  const size = Math.floor(Math.max(0, Math.min(area.width, area.height - footerHeight - BOARD_GAP)));

  return (
    <View style={{ flex: 1, minHeight: 0 }} onLayout={measureArea}>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", minHeight: 0 }}>
        {size > 0 ? <View style={{ width: size, height: size }}>{children}</View> : null}
      </View>
      <View onLayout={measureFooter}>{footer}</View>
    </View>
  );
}

/**
 * One player, their clock, and whether anything is wrong with them.
 *
 * The active seat is tinted and underlined in its own piece colour, so whose turn it is reads from
 * the same colour the board is glowing in.
 */
function Seat({ seat, side }: { seat: SeatView; side: Rgb }) {
  const live = seat.active;
  const color = css(side);
  const wash = (value: number) => (seat.urgent ? alpha(COLOR.danger, value) : cssAlpha(side, value));
  const edge = seat.urgent ? COLOR.danger : color;
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingVertical: 9,
        paddingHorizontal: 11,
        borderRadius: RADIUS.control,
        backgroundColor: live ? wash(0.14) : alpha(COLOR.text, 0.03),
        borderWidth: 1,
        borderColor: live ? (seat.urgent ? edge : cssAlpha(side, 0.5)) : COLOR.edge,
      }}
      accessibilityLabel={`${seat.name}, ${clockText(seat.seconds)} remaining${live ? ", to move" : ""}`}
    >
      <UIAvatar uri={seat.avatarUrl} name={seat.name} size="sm" style={{ backgroundColor: color }} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ fontFamily: FONT.ui, fontSize: 14, fontWeight: "700", color: COLOR.text }}>
          {seat.name}
        </Text>
        {seat.role ? <Eyebrow color={COLOR.textFaint}>{seat.role}</Eyebrow> : null}
      </View>
      {!seat.connected ? <Tag tint={COLOR.amber} color={COLOR.amber}>Reconnecting</Tag> : null}
      {seat.urgent ? <Eyebrow color={COLOR.danger}>Low time</Eyebrow> : null}
      <Mono size={19} color={seat.urgent ? COLOR.danger : live ? COLOR.text : COLOR.textFaint}>
        {clockText(seat.seconds)}
      </Mono>
    </View>
  );
}

/**
 * Whose move it is, what that move is, and how far through it you are — the three questions the
 * old single status line had to answer all at once, in 14px, in the gap above the board.
 */
function Directive({ directive, side, canHint, onHint }: {
  directive: DirectiveView; side: Rgb; canHint: boolean; onHint: () => void;
}) {
  const color = css(side);
  const accent = directive.tone === "you" || directive.tone === "them" ? color
    : directive.tone === "alert" ? COLOR.danger : COLOR.amber;
  const live = directive.tone === "you";
  return (
    <View
      style={{
        padding: 12,
        borderRadius: RADIUS.card,
        backgroundColor: live ? alpha(COLOR.mint, 0.05) : alpha(COLOR.text, 0.03),
        borderWidth: 1,
        borderColor: live ? alpha(COLOR.mint, 0.22) : COLOR.edge,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
        {/* Waiting on somebody else looks the same as waiting on nothing unless something moves. */}
        {directive.busy
          ? <ActivityIndicator size="small" color={accent} style={{ width: 12, height: 12 }} />
          : <Dot color={accent} />}
        <Eyebrow color={accent}>{directive.badge}</Eyebrow>
        <View style={{ flex: 1 }} />
        {directive.step ? <Eyebrow>{directive.step}</Eyebrow> : null}
      </View>
      <Text style={{ fontFamily: FONT.ui, fontSize: 18, fontWeight: "700", lineHeight: 22, color: COLOR.text }}>
        {directive.title}
      </Text>
      <Text style={{ fontFamily: FONT.ui, fontSize: 12.5, lineHeight: 17, color: COLOR.textDim, marginTop: 3 }}>
        {directive.body}
      </Text>
      {directive.showProgress ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 9 }}>
          <Pips filled={directive.filled} color={color} />
          <Text style={{ fontFamily: FONT.ui, fontSize: 11, fontWeight: "600", color: COLOR.textFaint }}>
            {directive.progress}
          </Text>
          <View style={{ flex: 1 }} />
          {canHint ? (
            <Pressable onPress={onHint} accessibilityRole="button" accessibilityLabel="Show me a legal move">
              <Text style={[EYEBROW, { color: COLOR.mint, letterSpacing: 0.4, fontSize: 12 }]}>Show me a move</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/**
 * Three slots, every turn, in the same places.
 *
 * Undo takes back the last thing you did whatever that was; the middle slot relabels between
 * clearing a trace and redrawing a placed L; the primary is always the commit, and says why it
 * cannot be pressed when it cannot.
 */
function Actions({ controller, view }: { controller: GameController; view: GameView }) {
  const { actions } = view;
  return (
    <View style={{ flexDirection: "row", gap: 8 }}>
      <IconButton
        name="undo"
        label={actions.undoLabel}
        disabled={!actions.canUndo}
        size={48}
        onPress={() => controller.undoStep()}
      />
      <Action
        label={actions.secondaryLabel}
        disabled={!actions.canSecondary}
        onPress={() => (view.phase === "neutral" ? controller.backToDraw() : controller.clearDraw())}
        style={{ flex: 1 }}
        testID="match-secondary"
      />
      <Action
        label={actions.primaryLabel}
        variant="primary"
        disabled={!actions.canPrimary}
        onPress={() => controller.endTurn()}
        style={{ flex: 1.6 }}
        testID="match-end-turn"
      />
    </View>
  );
}
