import { Pressable, StyleSheet, View } from "react-native";
import Svg, { Circle, Rect } from "react-native-svg";
import { BOARD_SKINS, PIECE_SKINS, css } from "../skins";
import { sameCell } from "../shared/rules";
import type { Cell } from "../shared/types";
import type { BoardFrame } from "../game/types";

interface GameBoardProps {
  frame: BoardFrame;
  enabled: boolean;
  onCellPress: (cell: Cell) => void;
}

const BOARD_UNITS = 400;
const CELL_UNITS = 100;
const INSET = 8;

const hasCell = (cells: readonly Cell[], cell: Cell) => cells.some((entry) => sameCell(entry, cell));

/**
 * The game board is React Native SVG on every platform. Transparent accessible Pressables sit over
 * the 16 squares, keeping touch, pointer, keyboard, and screen-reader input independent of drawing.
 */
export function GameBoard({ frame, enabled, onCellPress }: GameBoardProps) {
  const board = BOARD_SKINS[frame.boardSkin];
  const pieces = PIECE_SKINS[frame.pieceSkin];
  const allCells: Cell[] = Array.from({ length: 16 }, (_, index) => [index % 4, Math.floor(index / 4)] as Cell);

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
    return `${coordinate}, empty square`;
  };

  return (
    <View
      style={styles.frame}
      accessibilityRole="summary"
      accessibilityLabel="Four by four L Game board"
      testID="game-board"
    >
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
          <Rect
            key={`ghost-${x}-${y}`}
            x={x * CELL_UNITS + 17}
            y={y * CELL_UNITS + 17}
            width={66}
            height={66}
            rx={16}
            fill={css(pieces.colors[frame.ghost!.player])}
            opacity={0.2}
            stroke={css(pieces.colors[frame.ghost!.player])}
            strokeDasharray="8 7"
            strokeWidth={3}
          />
        ))}

        {frame.targets.map(([x, y]) => (
          <Circle
            key={`target-${x}-${y}`}
            cx={x * CELL_UNITS + 50}
            cy={y * CELL_UNITS + 50}
            r={15}
            fill={css(board.outline)}
            opacity={0.62}
          />
        ))}

        {frame.pieces.flatMap((cells, player) => cells.map(([x, y]) => (
          <Rect
            key={`piece-${player}-${x}-${y}`}
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

        {frame.drawn.map(([x, y], index) => (
          <Rect
            key={`drawn-${x}-${y}`}
            x={x * CELL_UNITS + INSET}
            y={y * CELL_UNITS + INSET}
            width={CELL_UNITS - INSET * 2}
            height={CELL_UNITS - INSET * 2}
            rx={19}
            fill={css(pieces.colors[frame.ghost?.player ?? 0])}
            opacity={0.72 + index * 0.07}
            stroke="#fff"
            strokeWidth={4}
          />
        ))}

        {frame.neutrals.map(([x, y], index) => {
          const selected = frame.selectedNeutral === index;
          const moved = selected && frame.pendingDestination;
          const at = moved ? frame.pendingDestination! : [x, y] as Cell;
          return (
            <Circle
              key={`neutral-${index}`}
              cx={at[0] * CELL_UNITS + 50}
              cy={at[1] * CELL_UNITS + 50}
              r={selected ? 28 : 24}
              fill="#f8f5ec"
              stroke={selected ? css(pieces.colors[frame.ghost?.player ?? 0]) : css(board.outline)}
              strokeWidth={selected ? 8 : 5}
            />
          );
        })}
      </Svg>

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
              onPress={() => onCellPress(cell)}
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
  );
}

const styles = StyleSheet.create({
  frame: {
    width: "100%",
    aspectRatio: 1,
    maxWidth: 560,
    alignSelf: "center",
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 3,
    borderColor: "#435c49",
    backgroundColor: "#e8dfc9",
    shadowColor: "#17231c",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 8,
  },
});
