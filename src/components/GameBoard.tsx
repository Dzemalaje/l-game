import React, { useCallback, useRef } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import type { GestureResponderEvent, LayoutChangeEvent } from "react-native";
import Svg, { Circle, Rect, Text as SvgText } from "react-native-svg";
import { BOARD_SKINS, PIECE_SKINS, css, cssAlpha } from "../skins";
import { COLOR, FONT, RADIUS, boardGlow } from "../theme";
import { sameCell } from "../shared/rules";
import type { Cell } from "../shared/types";
import type { BoardFrame } from "../game/types";
import { useBoardMotion, useReducedMotion } from "../game/motion";

interface GameBoardProps {
  frame: BoardFrame;
  enabled: boolean;
  /** "l" while the shape is being drawn, "neutral" once it is placed and a disc may move. */
  phase: "l" | "neutral" | "gameover";
  onCellPress: (cell: Cell) => void;
  /** A drag crossed into `cell` while drawing. */
  onDrawTo: (cell: Cell) => void;
  /** A drag started on a neutral disc. */
  onPickDisc: (index: 0 | 1) => void;
  /** A held disc was dragged over `cell`. */
  onDragDiscTo: (cell: Cell) => void;
}

const BOARD_UNITS = 400;
const CELL_UNITS = 100;
/** How far a placed piece sits inside its square, in board units. */
const INSET = 7;

const hasCell = (cells: readonly Cell[], cell: Cell) => cells.some((entry) => sameCell(entry, cell));
const key = (cells: readonly Cell[]) => cells.map((cell) => cell.join("")).join("-");
const centre = (value: number) => value * CELL_UNITS + CELL_UNITS / 2;

/**
 * The game board is React Native SVG on every platform.
 *
 * The interface around it is a dark room; this is the only lit object in it, which is why the frame
 * carries a coloured lift rather than a neutral shadow — the glow is tinted with whichever side is
 * on the move, so whose turn it is reads from the board itself before any text is consulted.
 *
 * Three input paths share it and must not fight. Transparent Pressables over the sixteen squares
 * keep keyboard and screen-reader use working exactly as before; a drag handler on the frame takes
 * over the moment a finger moves, which is what makes drawing an L and dragging a disc feel direct;
 * and on web Motion One animates the shapes by `data-lg` selector.
 */
export function GameBoard({ frame, enabled, phase, onCellPress, onDrawTo, onPickDisc, onDragDiscTo }: GameBoardProps) {
  const board = BOARD_SKINS[frame.boardSkin];
  const pieces = PIECE_SKINS[frame.pieceSkin];
  const allCells: Cell[] = Array.from({ length: 16 }, (_, index) => [index % 4, Math.floor(index / 4)] as Cell);
  const reduced = useReducedMotion();
  const moverColor = css(pieces.colors[frame.mover]);

  const { ref: boardRef, reject: rejectMotion } = useBoardMotion({
    targets: key(frame.targets),
    drawn: key(frame.drawn),
    // Identifies each occupied square, so only squares that actually changed are animated.
    pieces: frame.pieces
      .flatMap((cells, player) => cells.map(([x, y]) => `${player}-${x}-${y}`))
      .sort()
      .join(","),
    discs: `${key(frame.neutrals)}|${frame.pendingDestination?.join("") ?? ""}`,
    held: frame.selectedNeutral >= 0,
    discsMovable: frame.discsMovable,
    reduced,
  });

  // Where the board sits on screen, refreshed when the gesture starts. Pointer events report page
  // coordinates; the square under the finger is pure arithmetic once the origin is known.
  const frameRef = useRef<View>(null);
  const bounds = useRef({ x: 0, y: 0, size: 0 });
  // A touch almost never holds perfectly still, so the frame ends up owning gestures that the
  // player meant as taps. Rather than guess at a movement threshold, the gesture records whether it
  // ever left the square it started in and settles the question on release.
  const gesture = useRef<{ start?: Cell; at?: Cell; moved: boolean }>({ moved: false });

  const measure = useCallback(() => {
    frameRef.current?.measureInWindow((x, y, width, height) => {
      bounds.current = { x, y, size: Math.min(width, height) };
    });
  }, []);

  const cellAt = useCallback((event: GestureResponderEvent): Cell | undefined => {
    const { x, y, size } = bounds.current;
    if (!size) return undefined;
    const column = Math.floor(((event.nativeEvent.pageX - x) / size) * 4);
    const row = Math.floor(((event.nativeEvent.pageY - y) / size) * 4);
    if (column < 0 || column > 3 || row < 0 || row > 3) return undefined;
    return [column, row] as Cell;
  }, []);

  const handleGrant = useCallback((event: GestureResponderEvent) => {
    const cell = cellAt(event);
    gesture.current = { start: cell, at: cell, moved: false };
  }, [cellAt]);

  const handleMove = useCallback((event: GestureResponderEvent) => {
    const cell = cellAt(event);
    if (!cell) return;
    const { start, at } = gesture.current;
    // Every pointer sample lands in some square; only a crossing into a new one is a move.
    if (at && sameCell(at, cell)) return;
    gesture.current.at = cell;

    if (phase === "l") {
      // The square the finger landed on is part of the shape too. Nothing is drawn on touch-down,
      // because that would fire for taps as well, so the first crossing claims both squares: the
      // one the drag started on, then the one it just entered.
      if (!gesture.current.moved && start) onDrawTo(start);
      gesture.current.moved = true;
      onDrawTo(cell);
      return;
    }
    if (phase !== "neutral" || !start) return;
    // Crossing a square is a drag whatever it started on, so a gesture that began on an empty
    // square is never mistaken for a tap when the finger lifts somewhere else.
    const dragging = gesture.current.moved;
    gesture.current.moved = true;
    // The disc is picked up on the first crossing rather than on touch-down, so that a plain tap
    // still reaches selectCell and toggles the way it always did.
    if (!dragging) {
      const disc = frame.neutrals.findIndex((neutral) => sameCell(neutral, start));
      if (disc < 0) return;
      onPickDisc(disc as 0 | 1);
    }
    onDragDiscTo(cell);
  }, [cellAt, frame.neutrals, onDragDiscTo, onDrawTo, onPickDisc, phase]);

  const handleRelease = useCallback(() => {
    const { start, moved } = gesture.current;
    gesture.current = { moved: false };
    // Captured the gesture but never left the square: the player tapped, and the Pressable that
    // would normally have handled it was cancelled when the frame took over.
    if (!moved && start) onCellPress(start);
  }, [onCellPress]);

  /** Taps that cannot do anything get a shake, so a refusal is felt rather than only read. */
  const handleCellPress = useCallback((cell: Cell) => {
    const actionable = hasCell(frame.targets, cell)
      || hasCell(frame.drawn, cell)
      || frame.neutrals.some((neutral) => sameCell(neutral, cell));
    if (!actionable) rejectMotion();
    onCellPress(cell);
  }, [frame.drawn, frame.neutrals, frame.targets, onCellPress, rejectMotion]);

  const cellLabel = (cell: Cell) => {
    const coordinate = `${String.fromCharCode(65 + cell[0])}${cell[1] + 1}`;
    const drawnIndex = frame.drawn.findIndex((entry) => sameCell(entry, cell));
    if (drawnIndex >= 0) return `${coordinate}, selected square ${drawnIndex + 1} of 4 for your L`;
    if (frame.pendingDestination && sameCell(frame.pendingDestination, cell)) {
      return `${coordinate}, selected destination for neutral disc ${frame.selectedNeutral + 1}`;
    }
    if (hasCell(frame.targets, cell)) return `${coordinate}, legal target`;
    if (hasCell(frame.pieces[0], cell)) return `${coordinate}, ${pieces.sides[0]} L piece`;
    if (hasCell(frame.pieces[1], cell)) return `${coordinate}, ${pieces.sides[1]} L piece`;
    const neutral = frame.neutrals.findIndex((entry, index) => {
      if (index === frame.selectedNeutral && frame.pendingDestination) return false;
      return sameCell(entry, cell);
    });
    if (neutral >= 0) {
      return `${coordinate}, ${neutral === frame.selectedNeutral ? "selected " : ""}neutral disc ${neutral + 1}`;
    }
    if (hasCell(frame.hint, cell)) return `${coordinate}, part of the suggested L`;
    if (hasCell(frame.outlined, cell)) return `${coordinate}, part of the highlighted L`;
    return `${coordinate}, empty square`;
  };

  return (
    <View ref={frameRef} style={[styles.frame, boardGlow(moverColor)]}>
      <View
        style={styles.inner}
        onLayout={(_event: LayoutChangeEvent) => measure()}
        accessibilityRole="summary"
        accessibilityLabel="Four by four L Game board"
        testID="game-board"
        // A tap belongs to the Pressable underneath; the frame only claims the gesture once the
        // pointer actually travels, so dragging never costs the board its keyboard behaviour.
        onStartShouldSetResponderCapture={() => false}
        onMoveShouldSetResponderCapture={() => enabled}
        onResponderGrant={(event) => { measure(); handleGrant(event); }}
        onResponderMove={handleMove}
        onResponderRelease={handleRelease}
        onResponderTerminate={() => { gesture.current = { moved: false }; }}
        onResponderTerminationRequest={() => false}
      >
        <View ref={boardRef} style={StyleSheet.absoluteFill} pointerEvents="none">
          <Svg width="100%" height="100%" viewBox={`0 0 ${BOARD_UNITS} ${BOARD_UNITS}`}>
            {allCells.map(([x, y]) => (
              <Rect
                key={`square-${x}-${y}`}
                x={x * CELL_UNITS}
                y={y * CELL_UNITS}
                width={CELL_UNITS}
                height={CELL_UNITS}
                fill={css((x + y) % 2 ? board.dark : board.light)}
                stroke={css(board.outline)}
                strokeWidth={2}
              />
            ))}

            {frame.ghost?.cells.map(([x, y]) => (
              <Circle
                key={`ghost-${x}-${y}`}
                data-lg="ghost"
                cx={centre(x)}
                cy={centre(y)}
                // Deliberately smaller and finer than the disc halo below, which is also a dashed
                // ring in the same colour and is on screen at the same time during the disc step.
                // Size and dash weight are what tell "your L was here" from "this disc can move".
                r={30}
                fill="none"
                stroke={css(pieces.colors[frame.ghost!.player])}
                strokeWidth={3.5}
                strokeDasharray="5 7"
                opacity={0.4}
              />
            ))}

            {/* Points at a piece rather than at a move, so it is drawn in paper white: the same
                ring in the piece's own colour would be invisible on top of it. */}
            {frame.outlined.map(([x, y]) => (
              <Rect
                key={`outlined-${x}-${y}`}
                x={x * CELL_UNITS + 3}
                y={y * CELL_UNITS + 3}
                width={CELL_UNITS - 6}
                height={CELL_UNITS - 6}
                rx={23}
                fill="none"
                stroke={COLOR.text}
                strokeWidth={6}
                opacity={0.92}
              />
            ))}

            {/* The suggested L, for a player who cannot yet see that a move exists at all. */}
            {frame.hint.map(([x, y]) => (
              <Circle
                key={`hint-${x}-${y}`}
                data-lg="hint"
                cx={centre(x)}
                cy={centre(y)}
                r={32}
                fill="none"
                stroke={moverColor}
                strokeWidth={6}
                strokeDasharray="12 9"
                opacity={0.9}
              />
            ))}

            {/* Legal squares are the loudest thing on the board while a turn is being built: on a
                board this small, "I cannot see a move" is the whole difficulty of a first game. */}
            {frame.targets.map(([x, y]) => (
              <React.Fragment key={`target-${x}-${y}`}>
                <Circle
                  data-lg="target"
                  cx={centre(x)}
                  cy={centre(y)}
                  r={22}
                  fill={cssAlpha(pieces.colors[frame.mover], 0.22)}
                />
                <Circle
                  data-lg="target"
                  cx={centre(x)}
                  cy={centre(y)}
                  r={frame.discsMovable ? 12 : 15}
                  fill={moverColor}
                  opacity={frame.discsMovable ? 0.7 : 1}
                />
              </React.Fragment>
            ))}

            {frame.pieces.flatMap((cells, player) => cells
              .filter((cell) => !(frame.ghost?.lifted && player === frame.ghost.player && hasCell(frame.ghost.cells, cell)))
              .map(([x, y]) => (
                <Rect
                  key={`piece-${player}-${x}-${y}`}
                  data-lg="piece"
                  data-cell={`${player}-${x}-${y}`}
                  x={x * CELL_UNITS + INSET}
                  y={y * CELL_UNITS + INSET}
                  width={CELL_UNITS - INSET * 2}
                  height={CELL_UNITS - INSET * 2}
                  rx={19}
                  fill={css(pieces.colors[player as 0 | 1])}
                  stroke="#fff9"
                  strokeWidth={3}
                />
              )))}

            {/* Each drawn square carries its position in the trace, which is what makes "tap a
                numbered square to step back to it" a visible offer rather than a hidden one. */}
            {frame.drawn.map(([x, y], index) => (
              <React.Fragment key={`drawn-${x}-${y}`}>
                <Rect
                  data-lg="drawn"
                  x={x * CELL_UNITS + INSET}
                  y={y * CELL_UNITS + INSET}
                  width={CELL_UNITS - INSET * 2}
                  height={CELL_UNITS - INSET * 2}
                  rx={19}
                  fill={moverColor}
                  stroke="#ffffffec"
                  strokeWidth={5}
                />
                <SvgText
                  x={centre(x)}
                  y={centre(y) + 7}
                  fill="#ffffffed"
                  fontSize={20}
                  fontWeight="700"
                  fontFamily={FONT.mono}
                  textAnchor="middle"
                >
                  {index + 1}
                </SvgText>
              </React.Fragment>
            ))}

            {frame.neutrals.map(([x, y], index) => {
              const selected = frame.selectedNeutral === index;
              const moved = selected && frame.pendingDestination;
              const at = moved ? frame.pendingDestination! : [x, y] as Cell;
              return (
                <React.Fragment key={`neutral-${index}`}>
                  {/* Nothing on the board used to say when the discs became live, so the second half
                      of a turn was easy to miss entirely. This halo appears exactly then. */}
                  {frame.discsMovable && !selected ? (
                    <Circle
                      data-lg="disc-ready"
                      cx={centre(at[0])}
                      cy={centre(at[1])}
                      r={38}
                      fill="none"
                      stroke={moverColor}
                      strokeWidth={4}
                      strokeDasharray="8 7"
                      opacity={0.8}
                    />
                  ) : null}
                  <Circle
                    data-lg="disc"
                    data-held={selected ? "true" : "false"}
                    cx={centre(at[0])}
                    cy={centre(at[1])}
                    r={selected ? 30 : 26}
                    fill={COLOR.disc}
                    stroke={selected ? moverColor : css(board.outline)}
                    strokeWidth={selected ? 8 : 5}
                  />
                </React.Fragment>
              );
            })}
          </Svg>
        </View>

        <View style={StyleSheet.absoluteFill} pointerEvents={enabled ? "auto" : "none"}>
          {allCells.map((cell) => {
            const target = hasCell(frame.targets, cell);
            const drawn = hasCell(frame.drawn, cell);
            const pendingDestination = Boolean(frame.pendingDestination && sameCell(frame.pendingDestination, cell));
            const neutralIndex = frame.neutrals.findIndex((entry, index) => {
              if (index === frame.selectedNeutral && frame.pendingDestination) return false;
              return sameCell(entry, cell);
            });
            const neutral = neutralIndex >= 0;
            const selectedNeutral = neutralIndex >= 0 && neutralIndex === frame.selectedNeutral;
            return (
              <Pressable
                key={`input-${cell[0]}-${cell[1]}`}
                onPress={() => handleCellPress(cell)}
                disabled={!enabled}
                focusable={enabled}
                accessibilityRole="button"
                accessibilityLabel={cellLabel(cell)}
                accessibilityHint={target || neutral ? "Activate to build the current move" : undefined}
                accessibilityState={{ disabled: !enabled, selected: drawn || pendingDestination || selectedNeutral }}
                style={{
                  position: "absolute",
                  left: `${cell[0] * 25}%`,
                  top: `${cell[1] * 25}%`,
                  width: "25%",
                  height: "25%",
                }}
                testID={`board-cell-${cell[0]}-${cell[1]}`}
              />
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  /**
   * Two views rather than one: the outer carries the coloured lift, the inner clips the squares.
   * `overflow: hidden` and a shadow on the same element cancel each other out on Android.
   */
  frame: {
    width: "100%",
    aspectRatio: 1,
    alignSelf: "center",
    borderRadius: RADIUS.board,
    padding: 5,
    backgroundColor: COLOR.boardFrame,
    borderWidth: 1,
    borderColor: COLOR.boardFrameEdge,
  },
  inner: {
    flex: 1,
    borderRadius: RADIUS.board - 6,
    overflow: "hidden",
    backgroundColor: COLOR.boardFrame,
  },
});
