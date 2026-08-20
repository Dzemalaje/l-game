import { Text, View } from "react-native";
import type { GameController } from "../game/controller";
import type { GameView } from "../game/types";
import { COLOR, FONT } from "../theme";
import { Action, Eyebrow, Mono } from "../components/chrome";
import { MiniBoard, startingPosition } from "../components/MiniBoard";
import { useEnterMotion, useReducedMotion } from "../game/motion";

/**
 * The first screen of a first run.
 *
 * The L Game is not a game most people arrive already knowing, and the old first screen opened on a
 * profile card and four unlabelled match types with "How to play" as the quietest control on it.
 * This says what the game is in one sentence and makes learning it the obvious thing to do next.
 */
export function WelcomeScreen({ controller, view }: { controller: GameController; view: GameView }) {
  const reduced = useReducedMotion();
  const enterRef = useEnterMotion(reduced);

  return (
    <View style={{ flex: 1, width: "100%", paddingHorizontal: 10 }}>
      <View ref={enterRef} style={{ paddingTop: 28, gap: 14 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
          <Wordmark />
          <Eyebrow>The L Game</Eyebrow>
        </View>
        <Text
          accessibilityRole="header"
          style={{ fontFamily: FONT.ui, fontSize: 40, fontWeight: "800", letterSpacing: -1.4, lineHeight: 41, color: COLOR.text }}
        >
          Trap the other{"\n"}
          <Text style={{ color: COLOR.mint }}>L</Text>.
        </Text>
        <Text style={{ fontFamily: FONT.ui, fontSize: 15, lineHeight: 22, color: COLOR.textDim, maxWidth: 320 }}>
          Sixteen squares. Two L-shaped pieces. You win the moment your opponent has nowhere legal
          left to move.
        </Text>
      </View>

      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 14 }}>
        <View style={{ width: "100%", maxWidth: 262 }}>
          <MiniBoard position={startingPosition()} pieceSkin={view.pieceSkin} boardSkin={view.boardSkin} />
        </View>
      </View>

      <View style={{ flexDirection: "row", paddingVertical: 14 }}>
        <Fact value="16" label="Squares" />
        <Rule />
        <Fact value="2" label="Rules" />
        <Rule />
        <Fact value="5min" label="A match" />
      </View>

      <View style={{ gap: 10, paddingBottom: 14 }}>
        <Action label="Learn it in 60 seconds" variant="primary" onPress={() => controller.startTutorial()} testID="intro-learn" />
        <Action label="I know the rules — just play" onPress={() => controller.finishIntro()} testID="intro-skip" />
        <Text style={{ fontFamily: FONT.ui, fontSize: 11.5, color: COLOR.textGhost, textAlign: "center", marginTop: 2 }}>
          No account needed. Sign in later to play ranked.
        </Text>
      </View>
    </View>
  );
}

/** Two overlapping squares in the two side colours: the smallest possible picture of the game. */
function Wordmark() {
  return (
    <View style={{ width: 22, height: 22 }}>
      <View style={{ position: "absolute", right: 0, bottom: 0, width: 14, height: 14, borderRadius: 5, backgroundColor: "#4778ad" }} />
      <View style={{ position: "absolute", left: 0, top: 0, width: 14, height: 14, borderRadius: 5, backgroundColor: "#cf5c4f" }} />
    </View>
  );
}

function Fact({ value, label }: { value: string; label: string }) {
  return (
    <View style={{ flex: 1, alignItems: "center", gap: 3 }}>
      <Mono size={20}>{value}</Mono>
      <Eyebrow>{label}</Eyebrow>
    </View>
  );
}

function Rule() {
  return <View style={{ width: 1, backgroundColor: COLOR.edge }} />;
}
