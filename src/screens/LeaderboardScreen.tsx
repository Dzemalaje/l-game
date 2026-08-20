import { Pressable, Text, View } from "react-native";
import type { GameController } from "../game/controller";
import type { GameView, RankedPlayer } from "../game/types";
import { COLOR, FONT, RADIUS, alpha } from "../theme";
import { Eyebrow, Mono } from "../components/chrome";
import { UIAvatar, UIText } from "../components/ui";

/**
 * Where you stand, then everybody else.
 *
 * Your own standing is a card rather than a highlighted row somewhere down the list, because
 * hunting for your own name in a leaderboard is the one thing everybody opens a leaderboard to do.
 */
export function LeaderboardScreen({ controller, view }: { controller: GameController; view: GameView }) {
  const total = view.rankCount ?? view.leaderboard.length;
  const share = view.ownRank && total ? Math.max(1, Math.round((view.ownRank / total) * 100)) : undefined;

  return (
    <View style={{ gap: 14 }}>
      <View style={{ gap: 4 }}>
        <Text accessibilityRole="header" style={{ fontFamily: FONT.ui, fontSize: 26, fontWeight: "800", letterSpacing: -0.8, color: COLOR.text }}>
          Leaderboard
        </Text>
        <Text style={{ fontFamily: FONT.ui, fontSize: 12.5, color: COLOR.textMuted }}>
          Ranked players by Glicko-2 rating.
        </Text>
      </View>

      <Segmented
        value={view.leaderboardScope}
        options={[{ value: "global", label: "Global" }, { value: "friends", label: "Friends" }]}
        onChange={(scope) => controller.setLeaderboardScope(scope)}
        label="Leaderboard scope"
      />

      {view.account ? (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 13,
            padding: 14,
            borderRadius: RADIUS.panel,
            backgroundColor: alpha(COLOR.mint, 0.08),
            borderWidth: 1,
            borderColor: alpha(COLOR.mint, 0.26),
          }}
        >
          <UIAvatar uri={view.account.avatarUrl} name={view.account.username} size="md" />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Eyebrow color={COLOR.mint}>Your standing</Eyebrow>
            <Text style={{ fontFamily: FONT.ui, fontSize: 17, fontWeight: "700", color: COLOR.text, marginTop: 3 }}>
              {view.ownRank ? `${ordinal(view.ownRank)} of ${total}` : "Unranked"}
            </Text>
            <Text style={{ fontFamily: FONT.ui, fontSize: 11.5, color: COLOR.textMuted, marginTop: 2 }}>
              {view.ownRank && share ? `Top ${share}% of ranked players` : "Finish a ranked match to enter."}
            </Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Mono size={23}>{view.account.rating}</Mono>
            <Eyebrow>Rating</Eyebrow>
          </View>
        </View>
      ) : null}

      {view.leaderboardStatus ? <UIText muted accessibilityRole="alert">{view.leaderboardStatus}</UIText> : null}

      {view.leaderboard.length ? (
        <View style={{ gap: 2 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 12, paddingBottom: 6 }}>
            <Eyebrow color={COLOR.textGhost} style={{ width: 34 }}>Rank</Eyebrow>
            <Eyebrow color={COLOR.textGhost} style={{ flex: 1 }}>Player</Eyebrow>
            <Eyebrow color={COLOR.textGhost}>Rating</Eyebrow>
          </View>
          {view.leaderboard.map((player) => (
            <Row key={player.id} player={player} mine={player.id === view.account?.id} />
          ))}
        </View>
      ) : !view.leaderboardStatus.startsWith("Loading") ? (
        <Empty scope={view.leaderboardScope} />
      ) : null}
    </View>
  );
}

function Row({ player, mine }: { player: RankedPlayer; mine: boolean }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 11,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: RADIUS.control,
        backgroundColor: mine ? alpha(COLOR.mint, 0.07) : "transparent",
        borderWidth: 1,
        borderColor: mine ? alpha(COLOR.mint, 0.22) : "transparent",
      }}
      accessibilityLabel={`Rank ${player.rank}, ${player.username}, rating ${player.rating}`}
    >
      <Mono size={15} color={player.rank <= 3 ? COLOR.amber : COLOR.textFaint} style={{ width: 34 }}>
        {player.rank}
      </Mono>
      <UIAvatar uri={player.avatarUrl} name={player.username} size="sm" />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ fontFamily: FONT.ui, fontSize: 14, fontWeight: "700", color: COLOR.text }}>
          {player.username}
        </Text>
        <Text style={{ fontFamily: FONT.ui, fontSize: 11, color: COLOR.textFaint }}>
          {player.wins}W · {player.losses}L · {player.games} games
        </Text>
      </View>
      <Mono size={15}>{player.rating}</Mono>
    </View>
  );
}

function Empty({ scope }: { scope: "global" | "friends" }) {
  return (
    <View style={{ alignItems: "center", gap: 8, paddingVertical: 26, paddingHorizontal: 16 }}>
      <Text style={{ fontFamily: FONT.ui, fontSize: 18, fontWeight: "700", color: COLOR.text, textAlign: "center" }}>
        {scope === "friends" ? "No friend rankings yet" : "Be the first ranked player"}
      </Text>
      <Text style={{ fontFamily: FONT.ui, fontSize: 13, lineHeight: 19, color: COLOR.textMuted, textAlign: "center" }}>
        {scope === "friends"
          ? "Add friends, then finish ranked matches to see how you compare."
          : "Complete a ranked match to establish your record."}
      </Text>
    </View>
  );
}

/** The dark segmented control used by the leaderboard and the locker. */
export function Segmented<T extends string>({ value, options, onChange, label }: {
  value: T; options: readonly { value: T; label: string }[]; onChange: (value: T) => void; label: string;
}) {
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={label}
      style={{
        flexDirection: "row",
        gap: 4,
        padding: 4,
        borderRadius: RADIUS.control,
        backgroundColor: alpha(COLOR.text, 0.04),
        borderWidth: 1,
        borderColor: COLOR.edge,
      }}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            testID={`segment-${option.value}`}
            style={{
              flex: 1,
              minHeight: 38,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: RADIUS.control - 4,
              backgroundColor: active ? COLOR.mint : "transparent",
            }}
          >
            <Text style={{ fontFamily: FONT.ui, fontSize: 13, fontWeight: "700", color: active ? COLOR.mintInk : COLOR.textMuted }}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const ordinal = (value: number) => {
  const rest = value % 100;
  if (rest >= 11 && rest <= 13) return `${value}th`;
  return `${value}${["th", "st", "nd", "rd"][value % 10] ?? "th"}`;
};
