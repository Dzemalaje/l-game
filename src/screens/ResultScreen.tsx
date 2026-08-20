import { Text, View } from "react-native";
import type { GameController } from "../game/controller";
import type { GameView } from "../game/types";
import { PIECE_SKINS } from "../skins";
import { COLOR, FONT } from "../theme";
import { Action, Eyebrow, Mono } from "../components/chrome";
import { GameBoard } from "../components/GameBoard";
import { useEnterMotion, useReducedMotion } from "../game/motion";

const noop = () => undefined;

/**
 * The end of a match, as a screen rather than a dialog.
 *
 * A one-line modal could say who won but not why, and a player who has just lost their first game
 * mostly wants to see the position that did it. So the board stays on screen with the trapped
 * piece still on it, the sentence names the actual ending, and the rating change the server has
 * always calculated is finally shown.
 */
export function ResultScreen({ controller, view }: { controller: GameController; view: GameView }) {
  const reduced = useReducedMotion();
  const enterRef = useEnterMotion(reduced);
  const result = view.result;
  if (!result) return null;

  const accent = result.won ? COLOR.mint : COLOR.danger;
  const delta = result.ratingAfter !== undefined && result.ratingBefore !== undefined
    ? result.ratingAfter - result.ratingBefore
    : undefined;

  return (
    <View style={{ flex: 1, width: "100%" }}>
      <View ref={enterRef} style={{ paddingTop: 20 }}>
        <Eyebrow color={accent}>
          {result.ranked ? "Ranked match" : view.mode === "cpu" ? "Practice match" : "Match complete"}
        </Eyebrow>
        <Text
          accessibilityRole="header"
          style={{
            fontFamily: FONT.ui,
            fontSize: 40,
            fontWeight: "800",
            letterSpacing: -1.4,
            lineHeight: 42,
            color: accent,
            marginTop: 8,
          }}
        >
          {result.title}
        </Text>
        <Text style={{ fontFamily: FONT.ui, fontSize: 14.5, lineHeight: 21, color: COLOR.textDim, marginTop: 10 }}>
          {result.reason}
        </Text>
      </View>

      {/* The finishing position, left exactly as it ended. */}
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 16 }}>
        <View style={{ width: "100%", maxWidth: 260 }}>
          <GameBoard
            frame={view.board}
            enabled={false}
            phase="gameover"
            onCellPress={noop}
            onDrawTo={noop}
            onPickDisc={noop}
            onDragDiscTo={noop}
          />
        </View>
      </View>

      <View
        style={{
          flexDirection: "row",
          paddingVertical: 14,
          borderTopWidth: 1,
          borderBottomWidth: 1,
          borderColor: COLOR.edge,
        }}
      >
        <Stat value={String(result.turns)} label="Turns" />
        <Divider />
        <Stat value={losingSide(view)} label="Trapped" />
        {delta !== undefined ? (
          <>
            <Divider />
            <Stat
              value={`${delta >= 0 ? "+" : ""}${delta}`}
              label={`Rating ${result.ratingAfter}`}
              color={delta >= 0 ? COLOR.mint : COLOR.danger}
            />
          </>
        ) : null}
      </View>

      <View style={{ gap: 10, paddingTop: 18, paddingBottom: 6 }}>
        <Action label={result.action} variant="primary" onPress={() => controller.restart()} testID="result-again" />
        <Action label="Back to menu" onPress={() => controller.leaveMatch()} testID="result-home" />
      </View>
    </View>
  );
}

/** The side name of whoever ran out of moves, so the stat row never repeats a username. */
function losingSide(view: GameView) {
  const winner = view.state.winner;
  if (winner < 0) return "—";
  return PIECE_SKINS[view.pieceSkin].sides[(1 - winner) as 0 | 1];
}

function Stat({ value, label, color = COLOR.text }: { value: string; label: string; color?: string }) {
  return (
    <View style={{ flex: 1, alignItems: "center", gap: 3 }}>
      <Mono size={19} color={color}>{value}</Mono>
      <Eyebrow>{label}</Eyebrow>
    </View>
  );
}

function Divider() {
  return <View style={{ width: 1, backgroundColor: COLOR.edge }} />;
}
