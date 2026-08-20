import React from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Circle, Rect } from "react-native-svg";
import { BOARD_SKINS, PIECE_SKINS, css } from "../skins";
import { COLOR, RADIUS, boardGlow } from "../theme";
import { initialState } from "../shared/rules";
import { sameCell } from "../shared/rules";
import type { Cell } from "../shared/types";

const CELL = 100;
const INSET = 7;
const has = (cells: readonly Cell[], cell: Cell) => cells.some((entry) => sameCell(entry, cell));

export interface MiniPosition {
  pieces: [Cell[], Cell[]];
  neutrals: Cell[];
  /** Squares to ring, used to point at the piece a caption is talking about. */
  marked?: Cell[];
}

/** The opening position, which is what both the welcome screen and the locker preview want. */
export function startingPosition(): MiniPosition {
  const state = initialState();
  return { pieces: [state.pieces[0], state.pieces[1]], neutrals: state.neutrals };
}

/**
 * A board with nothing attached to it.
 *
 * The playable board carries gesture handling, sixteen focusable regions and an animation scope;
 * none of that belongs on a picture of a board, so previews get their own much smaller component
 * that still draws the pieces with the same geometry and palette.
 */
export function MiniBoard({ position, pieceSkin, boardSkin, glow, marked }: {
  position: MiniPosition;
  pieceSkin: number;
  boardSkin: number;
  /** Tints the lift. Defaults to the first side's colour. */
  glow?: string;
  marked?: string;
}) {
  const board = BOARD_SKINS[boardSkin];
  const pieces = PIECE_SKINS[pieceSkin];
  const cells: Cell[] = Array.from({ length: 16 }, (_, index) => [index % 4, Math.floor(index / 4)] as Cell);
  const lift = glow ?? css(pieces.colors[0]);

  return (
    <View style={[styles.frame, boardGlow(lift)]} accessibilityRole="image" accessibilityLabel="The L Game board">
      <View style={styles.inner}>
        <Svg width="100%" height="100%" viewBox={`0 0 ${CELL * 4} ${CELL * 4}`}>
          {cells.map(([x, y]) => (
            <Rect
              key={`sq-${x}-${y}`}
              x={x * CELL}
              y={y * CELL}
              width={CELL}
              height={CELL}
              fill={css((x + y) % 2 ? board.dark : board.light)}
              stroke={css(board.outline)}
              strokeWidth={2}
            />
          ))}
          {position.marked?.map(([x, y]) => (
            <Rect
              key={`mark-${x}-${y}`}
              x={x * CELL + 2}
              y={y * CELL + 2}
              width={CELL - 4}
              height={CELL - 4}
              fill="none"
              stroke={marked ?? COLOR.text}
              strokeWidth={6}
            />
          ))}
          {position.pieces.flatMap((owned, player) => owned.map(([x, y]) => (
            <Rect
              key={`p-${player}-${x}-${y}`}
              x={x * CELL + INSET}
              y={y * CELL + INSET}
              width={CELL - INSET * 2}
              height={CELL - INSET * 2}
              rx={19}
              fill={css(pieces.colors[player as 0 | 1])}
              stroke="#fff9"
              strokeWidth={3}
            />
          )))}
          {position.neutrals.map(([x, y], index) => (
            <Circle
              key={`n-${index}`}
              cx={x * CELL + CELL / 2}
              cy={y * CELL + CELL / 2}
              r={26}
              fill={COLOR.disc}
              stroke={css(board.outline)}
              strokeWidth={5}
            />
          ))}
        </Svg>
      </View>
    </View>
  );
}

/** Whether a cell is occupied, exported because the locker preview builds its own position. */
export const occupied = has;

const styles = StyleSheet.create({
  frame: {
    width: "100%",
    aspectRatio: 1,
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
  },
});
