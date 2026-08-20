import type { ReactNode } from "react";
import { Pressable, Text, View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import { COLOR, EYEBROW, FONT, MONO, RADIUS, alpha } from "../theme";

/**
 * The controls the dark match and lobby screens are built from.
 *
 * These sit alongside the HeroUI wrappers rather than replacing them: forms, dialogs and the legal
 * pages still want the library's platform behaviour, while the board-side chrome needs a handful of
 * shapes HeroUI has no equivalent for - a three-slot action bar, an icon tab bar, progress pips.
 * Keeping them here means one definition each instead of one per screen.
 */

export type IconName =
  | "back" | "forward" | "help" | "target" | "undo" | "check" | "trophy"
  | "computer" | "handoff" | "play" | "leaders" | "friends" | "locker" | "refresh";

const PATHS: Record<IconName, ReactNode> = {
  back: <Path d="M15 18l-6-6 6-6" />,
  forward: <Path d="M9 6l6 6-6 6" />,
  help: <><Circle cx={12} cy={12} r={9} /><Path d="M9.6 9.2a2.5 2.5 0 013.9-1.6c1.4.9 1.1 2.6-.3 3.3-.8.4-1.2 1-1.2 1.8" /><Path d="M12 17h.01" /></>,
  target: <><Circle cx={12} cy={12} r={8} /><Circle cx={12} cy={12} r={3} /></>,
  undo: <><Path d="M3 8h11a5 5 0 010 10h-6" /><Path d="M7 4L3 8l4 4" /></>,
  check: <Path d="M20 6L9 17l-5-5" />,
  trophy: <><Path d="M7 4h10v5a5 5 0 01-10 0z" /><Path d="M17 5h3v2a3 3 0 01-3 3" /><Path d="M7 5H4v2a3 3 0 003 3" /><Path d="M12 14v4" /><Path d="M8.5 20h7" /></>,
  computer: <><Rect x={3} y={5} width={18} height={12} rx={2} /><Path d="M8 21h8" /><Path d="M12 17v4" /><Path d="M9 10h.01" /><Path d="M15 10h.01" /></>,
  handoff: <><Circle cx={8} cy={8} r={3} /><Circle cx={16} cy={16} r={3} /><Path d="M14 6l4 4" /><Path d="M10 18l-4-4" /></>,
  play: <><Rect x={3.5} y={3.5} width={7} height={7} rx={1.5} /><Rect x={13.5} y={3.5} width={7} height={7} rx={1.5} /><Rect x={3.5} y={13.5} width={7} height={7} rx={1.5} /><Rect x={13.5} y={13.5} width={4} height={4} rx={1} /></>,
  leaders: <><Path d="M5 21v-8" /><Path d="M12 21V4" /><Path d="M19 21v-5" /></>,
  friends: <><Circle cx={9} cy={8} r={3.5} /><Path d="M3 20a6 6 0 0112 0" /><Path d="M17 5.6a3 3 0 010 5.8" /><Path d="M17.6 14.4A5.5 5.5 0 0121 19.4" /></>,
  locker: <Path d="M6 4.5l3-1a3 3 0 006 0l3 1 1 5-3 .8V20H8V10.3L5 9.5z" />,
  refresh: <><Path d="M20 12a8 8 0 11-2.6-5.9" /><Path d="M20 4v4h-4" /></>,
};

export function Icon({ name, size = 18, color = COLOR.textDim }: { name: IconName; size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      {PATHS[name]}
    </Svg>
  );
}

/** Uppercase micro-label: match type, turn badge, step counter, column heading. */
export function Eyebrow({ children, color = COLOR.textFaint, style }: { children: ReactNode; color?: string; style?: StyleProp<TextStyle> }) {
  return <Text style={[EYEBROW, { color }, style]}>{children}</Text>;
}

/** Clocks, ratings and ranks. Kept monospaced so a changing digit does not shift the row. */
export function Mono({ children, size = 18, color = COLOR.text, style }: { children: ReactNode; size?: number; color?: string; style?: StyleProp<TextStyle> }) {
  return <Text style={[MONO, { fontSize: size, color }, style]} accessibilityRole="text">{children}</Text>;
}

export function Panel({ children, style, tint }: { children: ReactNode; style?: StyleProp<ViewStyle>; tint?: string }) {
  return (
    <View
      style={[
        {
          backgroundColor: tint ? alpha(tint, 0.08) : COLOR.panel,
          borderWidth: 1,
          borderColor: tint ? alpha(tint, 0.28) : COLOR.edge,
          borderRadius: RADIUS.card,
          padding: 13,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

interface ActionProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  /** "primary" is the mint commit action; there is never more than one on screen. */
  variant?: "primary" | "secondary";
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * A control in the action bar.
 *
 * A disabled control keeps its label rather than disappearing: the label is what explains why it
 * cannot be used ("Place your L first"), and a row whose buttons come and go teaches nothing.
 */
export function Action({ label, onPress, disabled, variant = "secondary", style, testID }: ActionProps) {
  const primary = variant === "primary";
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      testID={testID}
      style={({ pressed }) => [
        {
          minHeight: 48,
          borderRadius: RADIUS.control,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 14,
          borderWidth: 1,
          backgroundColor: primary
            ? (disabled ? COLOR.panelRaised : pressed ? COLOR.mintPress : COLOR.mint)
            : (pressed ? COLOR.panelRaised : COLOR.panel),
          borderColor: primary ? (disabled ? COLOR.edgeStrong : COLOR.mint) : COLOR.edgeStrong,
          opacity: disabled && !primary ? 0.42 : 1,
        },
        style,
      ]}
    >
      <Text
        numberOfLines={1}
        style={{
          fontFamily: FONT.ui,
          fontSize: primary ? 15 : 14,
          fontWeight: primary ? "700" : "600",
          color: primary ? (disabled ? COLOR.textFaint : COLOR.mintInk) : COLOR.textDim,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function IconButton({ name, label, onPress, disabled, size = 44, tone = COLOR.textDim }: {
  name: IconName; label: string; onPress: () => void; disabled?: boolean; size?: number; tone?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => ({
        width: size,
        height: size,
        borderRadius: RADIUS.control,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: pressed ? COLOR.panelRaised : COLOR.panel,
        borderWidth: 1,
        borderColor: COLOR.edge,
        opacity: disabled ? 0.42 : 1,
      })}
    >
      <Icon name={name} color={tone} />
    </Pressable>
  );
}

/**
 * How many of the L's four squares are down.
 *
 * The old screen gave no feedback on this at all, so a half-drawn shape looked the same as a
 * stalled one.
 */
export function Pips({ filled, color }: { filled: number; color: string }) {
  return (
    <View style={{ flexDirection: "row", gap: 4 }} accessibilityLabel={`${filled} of 4 squares placed`}>
      {[0, 1, 2, 3].map((index) => (
        <View
          key={index}
          style={{
            width: 22,
            height: 6,
            borderRadius: 3,
            backgroundColor: index < filled ? color : COLOR.edgeMid,
          }}
        />
      ))}
    </View>
  );
}

/** A small round status light. Always accompanied by a word; never the only signal. */
export function Dot({ color, size = 7 }: { color: string; size?: number }) {
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />;
}

/** Pill used for connection state and short counts. */
export function Tag({ children, color = COLOR.textDim, tint }: { children: ReactNode; color?: string; tint?: string }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: RADIUS.chip,
        backgroundColor: tint ? alpha(tint, 0.12) : COLOR.edge,
        borderWidth: 1,
        borderColor: tint ? alpha(tint, 0.26) : "transparent",
      }}
    >
      {tint ? <Dot color={tint} size={6} /> : null}
      <Eyebrow color={color}>{children}</Eyebrow>
    </View>
  );
}
