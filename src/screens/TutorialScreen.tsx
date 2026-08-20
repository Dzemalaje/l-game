import { useMemo, useState } from "react";
import { Text, View } from "react-native";
import type { GameController } from "../game/controller";
import type { BoardFrame, GameView } from "../game/types";
import type { Cell, GameState } from "../shared/types";
import {
  cloneState,
  initialState,
  isLegalNeutralDestination,
  legalContinuations,
  legalNeutralDestinations,
  placementForDraw,
  sameCell,
} from "../shared/rules";
import { css, PIECE_SKINS } from "../skins";
import { COLOR, FONT, RADIUS, alpha } from "../theme";
import { Action, Eyebrow, Icon, IconButton } from "../components/chrome";
import { GameBoard } from "../components/GameBoard";
import { TRAPPED_POSITION } from "../shared/positions";

const STEP_COUNT = 5;
const has = (cells: readonly Cell[], cell: Cell) => cells.some((entry) => sameCell(entry, cell));

/**
 * Learning the game by playing a turn of it.
 *
 * This replaces a five-slide wall of text that could describe a move but never let anybody make
 * one. Two of the five steps are the real board with the real rules engine behind them, and only
 * legal squares are lit, so a beginner cannot make an illegal move here - not because it is
 * rejected, but because there is nothing illegal to tap.
 *
 * The coaching sits under the board, in the same place the match screen puts its instruction, so
 * the lesson also teaches where to look during a real game.
 */
export function TutorialScreen({ controller, view }: { controller: GameController; view: GameView }) {
  const [step, setStep] = useState(0);
  const [state, setState] = useState<GameState>(() => initialState());
  const [drawn, setDrawn] = useState<Cell[]>([]);
  const [ghost, setGhost] = useState<Cell[] | undefined>();
  const [placed, setPlaced] = useState(false);
  const [held, setHeld] = useState<-1 | 0 | 1>(-1);
  const [discMoved, setDiscMoved] = useState(false);

  const trapped = step === 4;
  const drawing = step === 1 && !placed;
  const moving = step === 2 && !discMoved;
  const sides = PIECE_SKINS[view.pieceSkin].colors;

  const board: GameState = useMemo(
    () => (trapped ? { ...cloneState(initialState()), ...TRAPPED_POSITION, turn: 1, winner: -1 } : state),
    [state, trapped],
  );

  const targets = drawing ? legalContinuations(state, 0, drawn)
    : moving && held >= 0 ? legalNeutralDestinations(state) : [];

  const done = step === 0 || step === 3 || trapped || (step === 1 && placed) || (step === 2 && discMoved);

  const press = (cell: Cell) => {
    if (drawing) {
      const back = drawn.findIndex((entry) => sameCell(entry, cell));
      if (back >= 0) { setDrawn(drawn.slice(0, back + 1)); return; }
      if (!has(targets, cell)) return;
      const next = [...drawn, cell];
      if (next.length < 4) { setDrawn(next); return; }
      const placement = placementForDraw(state, 0, next);
      if (!placement) return;
      const advanced = cloneState(state);
      advanced.pieces[0] = placement.map((entry) => [...entry] as Cell);
      setGhost(state.pieces[0].map((entry) => [...entry] as Cell));
      setDrawn(next);
      setState(advanced);
      setPlaced(true);
      return;
    }
    if (!moving) return;
    const disc = state.neutrals.findIndex((neutral) => sameCell(neutral, cell));
    if (disc >= 0) { setHeld(held === disc ? -1 : disc as 0 | 1); return; }
    if (held < 0 || !isLegalNeutralDestination(state, cell)) return;
    // `held` is a -1 | 0 | 1 union, which TypeScript does not narrow through a `< 0` comparison.
    const index = held as 0 | 1;
    const advanced = cloneState(state);
    advanced.neutrals[index] = [...cell] as Cell;
    setState(advanced);
    setHeld(-1);
    setDiscMoved(true);
  };

  const frame: BoardFrame = {
    pieces: [board.pieces[0], board.pieces[1]],
    neutrals: board.neutrals,
    ghost: !trapped && ghost ? { cells: ghost, player: 0, lifted: false } : undefined,
    drawn: drawing || (step === 1 && placed) ? drawn : [],
    targets,
    hint: [],
    // Step one rings your own piece so "this is yours" has something to point at; the last step
    // rings the piece that has run out of moves. Both sit on top of a piece, so both use the
    // contrasting outline rather than the mover-coloured hint.
    outlined: step === 0 ? board.pieces[0] : trapped ? board.pieces[1] : [],
    selectedNeutral: moving ? held : -1,
    pendingDestination: undefined,
    discsMovable: moving,
    mover: trapped ? 1 : 0,
    watching: false,
    pieceSkin: view.pieceSkin,
    boardSkin: view.boardSkin,
  };

  const copy = STEPS[step](done);

  return (
    <View style={{ flex: 1, width: "100%" }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <IconButton
          name="back"
          label="Previous step"
          size={38}
          disabled={step === 0}
          onPress={() => setStep(Math.max(0, step - 1))}
        />
        <View style={{ flex: 1, alignItems: "center", gap: 2 }}>
          <Eyebrow color={COLOR.mint}>Learn to play</Eyebrow>
          <Text style={{ fontFamily: FONT.ui, fontSize: 12, fontWeight: "600", color: COLOR.textFaint }}>
            Step {step + 1} of {STEP_COUNT}
          </Text>
        </View>
        <Action label="Skip" onPress={() => controller.finishIntro()} style={{ minHeight: 38, paddingHorizontal: 12 }} />
      </View>

      <View style={{ flexDirection: "row", gap: 5, marginTop: 12 }} accessibilityLabel={`Step ${step + 1} of ${STEP_COUNT}`}>
        {Array.from({ length: STEP_COUNT }, (_, index) => (
          <View
            key={index}
            style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: index <= step ? COLOR.mint : COLOR.edge }}
          />
        ))}
      </View>

      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 14 }}>
        <View style={{ width: "100%", maxWidth: 380 }}>
          <GameBoard
            frame={frame}
            enabled={drawing || moving}
            phase={moving ? "neutral" : drawing ? "l" : "gameover"}
            onCellPress={press}
            onDrawTo={press}
            onPickDisc={(index) => setHeld(index)}
            onDragDiscTo={press}
          />
        </View>
      </View>

      <View
        style={{
          padding: 13,
          borderRadius: RADIUS.card,
          backgroundColor: done ? alpha(COLOR.mint, 0.06) : alpha(COLOR.amber, 0.06),
          borderWidth: 1,
          borderColor: done ? alpha(COLOR.mint, 0.24) : alpha(COLOR.amber, 0.24),
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 6 }}>
          <Icon name={done ? "check" : "target"} size={14} color={done ? COLOR.mint : COLOR.amber} />
          <Eyebrow color={done ? COLOR.mint : COLOR.amber}>{copy.eyebrow}</Eyebrow>
        </View>
        <Text style={{ fontFamily: FONT.ui, fontSize: 18, fontWeight: "700", lineHeight: 22, color: COLOR.text }}>
          {copy.title}
        </Text>
        <Text style={{ fontFamily: FONT.ui, fontSize: 12.5, lineHeight: 18, color: COLOR.textDim, marginTop: 4 }}>
          {copy.body}
        </Text>
      </View>

      <View style={{ paddingTop: 10, paddingBottom: 6 }}>
        <Action
          label={copy.action}
          variant="primary"
          disabled={!done}
          onPress={() => (step === STEP_COUNT - 1 ? controller.finishIntro() : setStep(step + 1))}
          testID="tutorial-next"
        />
      </View>

      {/* Colour is never the only signal: the sides are named here as well as shown. */}
      <View style={{ flexDirection: "row", justifyContent: "center", gap: 14, paddingTop: 8 }}>
        <Legend color={css(sides[0])} label={`You — ${PIECE_SKINS[view.pieceSkin].sides[0]}`} />
        <Legend color={css(sides[1])} label={`Them — ${PIECE_SKINS[view.pieceSkin].sides[1]}`} />
      </View>
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: color }} />
      <Text style={{ fontFamily: FONT.ui, fontSize: 11, color: COLOR.textFaint }}>{label}</Text>
    </View>
  );
}

type Copy = { eyebrow: string; title: string; body: string; action: string };

const STEPS: ((done: boolean) => Copy)[] = [
  () => ({
    eyebrow: "The pieces",
    title: "The outlined piece is yours",
    body: "Four squares in an L. Your opponent has the other one, and the two white discs belong to nobody.",
    action: "Got it",
  }),
  (done) => (done
    ? {
      eyebrow: "Nicely done",
      title: "That is a legal L",
      body: "Every turn starts this way. Your L has to land somewhere new — it may flip or rotate, it just cannot stay where it was.",
      action: "Next",
    }
    : {
      eyebrow: "Your move",
      title: "Now move your L",
      body: "Tap the four glowing squares in order. Only legal landings glow, so you cannot make an illegal move by accident.",
      action: "Trace all four squares",
    }),
  (done) => (done
    ? {
      eyebrow: "That is a whole turn",
      title: "Disc moved",
      body: "Discs are how you close the board down. Most turns you will move one; skipping it is legal too.",
      action: "Next",
    }
    : {
      eyebrow: "Optional step",
      title: "You may also move one disc",
      body: "Tap a white disc, then tap any empty square. Skipping this is allowed — it is your choice, not a requirement.",
      action: "Move a disc",
    }),
  () => ({
    eyebrow: "Every turn",
    title: "Move your L, then maybe a disc",
    body: "That is the entire game. The board never gets bigger, so every move takes options away from somebody.",
    action: "Show me a win",
  }),
  () => ({
    eyebrow: "This is a win",
    title: "The outlined L has nowhere to go",
    body: "It has to move and there is no legal square left for it. The other player wins the moment that happens.",
    action: "Play my first match",
  }),
];
