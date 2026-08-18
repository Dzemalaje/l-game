import { useState } from "react";
import { View, type LayoutChangeEvent } from "react-native";
import type { GameController } from "../game/controller";
import type { GameView, SeatView } from "../game/types";
import { css, cssAlpha, PIECE_SKINS } from "../skins";
import { GameBoard } from "../components/GameBoard";
import { useChangeMotion, useEnterMotion, useReducedMotion } from "../game/motion";
import { UIAvatar, UIButton, UIChip, UIModal, UIText } from "../components/ui";

const MODE_LABEL = (view: GameView) =>
  view.mode === "online" ? (view.ranked ? "Ranked" : "Casual") : view.mode === "cpu" ? "vs CPU" : "Pass & Play";

/**
 * The match fills its frame and never scrolls: the versus bar and the one-line status sit above a
 * board that is measured to whatever height is left. Anything that would have pushed the board off
 * screen - the app title, the match heading, the standalone status card - is gone rather than
 * shrunk, because on a phone the board is the only part that has to be big.
 */
export function MatchScreen({ controller, view }: { controller: GameController; view: GameView }) {
  const reduced = useReducedMotion();
  const statusRef = useChangeMotion(view.status, reduced);
  const versusRef = useEnterMotion(reduced);

  return (
    <View style={{ flex: 1, width: "100%", gap: 8 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <UIButton size="sm" variant="ghost" onPress={() => controller.requestLeaveMatch()}>Leave</UIButton>
        <UIChip color={view.connection && view.connection.state !== "connected" ? "warning" : "default"}>
          {view.connection && view.connection.state !== "connected" ? view.connection.label : MODE_LABEL(view)}
        </UIChip>
        <UIButton size="sm" variant="ghost" onPress={() => controller.openRules()}>Rules</UIButton>
      </View>

      <View ref={versusRef}>
        <VersusBar view={view} />
      </View>

      <View ref={statusRef} style={{ minHeight: 22, justifyContent: "center" }}>
        <UIText type="body-sm" align="center" weight="semibold" accessibilityRole="alert" numberOfLines={2}>
          {view.status}
        </UIText>
      </View>

      <BoardFitter footer={<Actions controller={controller} view={view} />}>
        <GameBoard
          frame={view.board}
          enabled={view.canAct && !view.resultOpen}
          phase={view.phase}
          onCellPress={(cell) => controller.selectCell(cell)}
          onDrawTo={(cell) => controller.drawTo(cell)}
          onPickDisc={(index) => controller.pickDisc(index)}
          onDragDiscTo={(cell) => controller.dragDiscTo(cell)}
        />
      </BoardFitter>

      <UIModal open={view.resultOpen} onOpenChange={() => undefined} title={view.result?.title ?? "Match complete"} description={view.result?.detail} dismissable={false}>
        <View style={{ gap: 12, paddingTop: 18 }}>
          <UIButton fullWidth size="lg" onPress={() => controller.restart()}>{view.result?.action ?? "Play again"}</UIButton>
          <UIButton fullWidth variant="ghost" onPress={() => controller.leaveMatch()}>Return home</UIButton>
        </View>
      </UIModal>

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

/** Height reserved for the action row, so the board never sizes itself on top of it. */
const ACTIONS_HEIGHT = 54;

/**
 * Gives the board the largest square that fits the space left over, and keeps the controls tucked
 * directly beneath it.
 *
 * A percentage width with `aspectRatio: 1` overflows a short viewport, and `maxHeight` does not
 * constrain an aspect-ratio box the way it would in CSS, so the size is measured and applied. The
 * controls travel with the board rather than sitting at the bottom of the screen, where on a tall
 * phone they end up marooned a long way from the thing they act on.
 */
function BoardFitter({ children, footer }: { children: React.ReactNode; footer: React.ReactNode }) {
  const [size, setSize] = useState(0);
  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    const next = Math.floor(Math.max(0, Math.min(width, height - ACTIONS_HEIGHT)));
    if (next !== size) setSize(next);
  };
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", minHeight: 0 }} onLayout={onLayout}>
      {size > 0 ? (
        <View style={{ width: size, gap: 10 }}>
          <View style={{ width: size, height: size }}>{children}</View>
          {footer}
        </View>
      ) : null}
    </View>
  );
}

/** The two players, side by side, with the live clocks. Replaces the old stacked seat cards. */
function VersusBar({ view }: { view: GameView }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "stretch",
        backgroundColor: "#f8f5ed",
        borderRadius: 16,
        borderWidth: 1,
        borderColor: "#ddd6c6",
        overflow: "hidden",
      }}
      accessibilityLabel="Players and clocks"
    >
      <Seat seat={view.seats[0]} pieceSkin={view.pieceSkin} align="start" />
      <View style={{ justifyContent: "center", paddingHorizontal: 6 }}>
        <UIText type="body-xs" muted weight="bold">VS</UIText>
      </View>
      <Seat seat={view.seats[1]} pieceSkin={view.pieceSkin} align="end" />
    </View>
  );
}

function Seat({ seat, pieceSkin, align }: { seat: SeatView; pieceSkin: number; align: "start" | "end" }) {
  const side = PIECE_SKINS[pieceSkin].colors[seat.player];
  const sideColor = css(side);
  const minutes = Math.floor(seat.seconds / 60);
  const seconds = String(seat.seconds % 60).padStart(2, "0");
  const urgent = seat.active && seat.seconds <= 30;
  return (
    <View
      style={{
        flex: 1,
        flexDirection: align === "start" ? "row" : "row-reverse",
        alignItems: "center",
        gap: 8,
        paddingVertical: 8,
        paddingHorizontal: 10,
        // The active seat is tinted with its own piece colour, so whose turn it is reads at a
        // glance without a separate "your turn" line taking a row of its own.
        backgroundColor: seat.active ? cssAlpha(side, 0.16) : "transparent",
        borderBottomWidth: 3,
        borderBottomColor: seat.active ? sideColor : "transparent",
      }}
    >
      <UIAvatar uri={seat.avatarUrl} name={seat.name} size="sm" style={{ backgroundColor: sideColor }} />
      <View style={{ flex: 1, alignItems: align === "start" ? "flex-start" : "flex-end", gap: 1 }}>
        <UIText type="body-sm" weight="semibold" numberOfLines={1}>{seat.name}</UIText>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <UIText
            type="body"
            weight="bold"
            accessibilityRole="timer"
            style={urgent ? { color: "#b42318" } : undefined}
          >
            {minutes}:{seconds}
          </UIText>
          {!seat.connected ? <UIChip color="warning">Reconnecting</UIChip> : null}
        </View>
      </View>
    </View>
  );
}

/**
 * One row of controls, and only the ones that can do something right now.
 *
 * There is no Submit L any more - a fourth legal square completes the shape on its own - so the
 * decisions left are whether to take the shape back and whether the turn is over.
 */
function Actions({ controller, view }: { controller: GameController; view: GameView }) {
  if (!view.canAct) return <View style={{ height: 44 }} />;
  if (view.phase === "l") {
    return (
      <View style={{ flexDirection: "row", gap: 10, minHeight: 44 }}>
        <View style={{ flex: 1 }}>
          <UIButton fullWidth variant="ghost" disabled={!view.canClear} onPress={() => controller.clearDraw()}>
            Clear
          </UIButton>
        </View>
      </View>
    );
  }
  if (view.phase === "neutral") {
    return (
      <View style={{ flexDirection: "row", gap: 10, minHeight: 44 }}>
        <View style={{ flex: 1 }}>
          <UIButton fullWidth variant="ghost" disabled={!view.canUndoL} onPress={() => controller.backToDraw()}>
            Redraw L
          </UIButton>
        </View>
        <View style={{ flex: 2 }}>
          <UIButton fullWidth disabled={!view.canEndTurn} onPress={() => controller.endTurn()}>
            End turn
          </UIButton>
        </View>
      </View>
    );
  }
  return <View style={{ height: 44 }} />;
}
