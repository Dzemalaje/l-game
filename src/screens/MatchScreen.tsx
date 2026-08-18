import { View, useWindowDimensions } from "react-native";
import type { GameController } from "../game/controller";
import type { GameView, SeatView } from "../game/types";
import { css, PIECE_SKINS } from "../skins";
import { GameBoard } from "../components/GameBoard";
import { UIAvatar, UIButton, UICard, UIChip, UIModal, UIText } from "../components/ui";

export function MatchScreen({ controller, view }: { controller: GameController; view: GameView }) {
  const { width } = useWindowDimensions();
  const desktop = width >= 900;
  return (
    <View style={{ gap: 14, width: "100%", maxWidth: desktop ? 1100 : 620, alignSelf: "center" }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <UIButton size="sm" variant="ghost" onPress={() => controller.requestLeaveMatch()}>Leave</UIButton>
        <View style={{ flex: 1, alignItems: "center", gap: 2 }}>
          <UIText type="h3" align="center">{view.mode === "online" ? view.ranked ? "RANKED MATCH" : "CASUAL MATCH" : view.mode === "cpu" ? "VS CPU" : "PASS & PLAY"}</UIText>
          {view.connection ? <UIChip color={view.connection.state === "connected" ? "success" : view.connection.state === "disconnected" ? "danger" : "warning"}>{view.connection.label}</UIChip> : null}
        </View>
        <UIButton size="sm" variant="ghost" onPress={() => controller.openRules()}>Rules</UIButton>
      </View>

      {view.connection && view.connection.state !== "connected" ? (
        <UICard variant="secondary">
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={{ flex: 1, gap: 2 }}><UIText weight="bold">{view.connection.title}</UIText><UIText muted type="body-sm">{view.connection.detail}</UIText></View>
            <UIText type="h3">{view.connection.time}</UIText>
          </View>
        </UICard>
      ) : null}

      <View style={{ flexDirection: desktop ? "row" : "column", gap: 18, alignItems: "center" }}>
        <View style={{ flex: desktop ? 1 : undefined, width: "100%", maxWidth: 600 }}>
          <GameBoard frame={view.board} enabled={view.canAct && !view.resultOpen} onCellPress={(cell) => controller.selectCell(cell)} />
        </View>
        <View style={{ gap: 12, width: "100%", maxWidth: desktop ? 390 : 600 }}>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}><SeatCard seat={view.seats[0]} pieceSkin={view.pieceSkin} /></View>
            <View style={{ flex: 1 }}><SeatCard seat={view.seats[1]} pieceSkin={view.pieceSkin} /></View>
          </View>
          <UICard variant="secondary">
            <View style={{ minHeight: 54, justifyContent: "center" }}><UIText align="center" weight="semibold" accessibilityRole="alert">{view.status}</UIText></View>
          </UICard>
          {view.phase === "l" ? (
            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1 }}><UIButton fullWidth variant="ghost" disabled={!view.canClear} onPress={() => controller.clearDraw()}>Clear</UIButton></View>
              <View style={{ flex: 2 }}><UIButton fullWidth disabled={!view.canSubmitL} onPress={() => controller.submitL()}>Submit L</UIButton></View>
            </View>
          ) : view.phase === "neutral" ? (
            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1 }}><UIButton fullWidth variant="ghost" disabled={!view.canAct} onPress={() => controller.skipDisc()}>Skip disc</UIButton></View>
              <View style={{ flex: 2 }}><UIButton fullWidth disabled={!view.canConfirmDisc} onPress={() => controller.confirmDisc()}>Confirm move</UIButton></View>
            </View>
          ) : null}
        </View>
      </View>

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

function SeatCard({ seat, pieceSkin }: { seat: SeatView; pieceSkin: number }) {
  const sideColor = css(PIECE_SKINS[pieceSkin].colors[seat.player]);
  const minutes = Math.floor(seat.seconds / 60);
  const seconds = String(seat.seconds % 60).padStart(2, "0");
  return (
    <UICard variant={seat.active ? "secondary" : "default"} style={{ borderWidth: seat.active ? 2 : 0, borderColor: sideColor }}>
      <View style={{ gap: 6, alignItems: "center" }}>
        <UIAvatar uri={seat.avatarUrl} name={seat.name} size="sm" style={{ backgroundColor: sideColor }} />
        <UIText weight="semibold" numberOfLines={1} align="center">{seat.name}</UIText>
        {seat.role ? <UIText type="body-xs" muted align="center">{seat.role}</UIText> : null}
        <UIText type="h2" align="center" accessibilityRole="timer" style={seat.active && seat.seconds <= 30 ? { color: "#b42318" } : undefined}>{minutes}:{seconds}</UIText>
        {!seat.connected ? <UIChip color="warning">Reconnecting</UIChip> : null}
      </View>
    </UICard>
  );
}
