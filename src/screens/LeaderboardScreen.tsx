import { View } from "react-native";
import type { GameController } from "../game/controller";
import type { GameView } from "../game/types";
import { UIAvatar, UICard, UIText, UITabs } from "../components/ui";

export function LeaderboardScreen({ controller, view }: { controller: GameController; view: GameView }) {
  return (
    <View style={{ gap: 16 }}>
      <View style={{ gap: 4 }}>
        <UIText type="h1">Leaderboard</UIText>
        <UIText muted>All-time ranked players, ordered by Glicko-2 rating.</UIText>
      </View>
      <UITabs
        value={view.leaderboardScope}
        onValueChange={(scope) => controller.setLeaderboardScope(scope)}
        options={[{ value: "global", label: "Global" }, { value: "friends", label: "Friends" }]}
        accessibilityLabel="Leaderboard scope"
      />
      {view.account ? (
        <UICard variant="secondary">
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <View style={{ flex: 1, gap: 2 }}>
              <UIText muted>Your global rank</UIText>
              <UIText type="h2">{view.ownRank ? `#${view.ownRank}` : "Unranked"}</UIText>
            </View>
            <UIText align="end" muted>
              {view.ownRank ? `${view.account.rating} rating\n${view.rankCount ?? view.ownRank} ranked players` : "Finish a ranked match\nto enter."}
            </UIText>
          </View>
        </UICard>
      ) : null}
      {view.leaderboardStatus ? <UIText muted accessibilityRole="alert">{view.leaderboardStatus}</UIText> : null}
      <View style={{ gap: 8 }}>
        {view.leaderboard.map((player) => (
          <UICard key={player.id} variant={player.id === view.account?.id ? "secondary" : "default"}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <UIText type="h3" style={{ width: 48 }}>#{player.rank}</UIText>
              <UIAvatar uri={player.avatarUrl} name={player.username} size="sm" />
              <View style={{ flex: 1, gap: 2 }}>
                <UIText weight="semibold" numberOfLines={1}>{player.username}</UIText>
                <UIText muted type="body-sm">{player.wins}W · {player.losses}L · {player.games} games</UIText>
              </View>
              <UIText type="h3" align="end">{player.rating}</UIText>
            </View>
          </UICard>
        ))}
      </View>
      {!view.leaderboard.length && !view.leaderboardStatus.startsWith("Loading") ? (
        <UICard variant="secondary">
          <View style={{ alignItems: "center", gap: 8, paddingVertical: 18 }}>
            <UIText type="h2" align="center">{view.leaderboardScope === "friends" ? "No friend rankings yet" : "Be the first ranked player"}</UIText>
            <UIText muted align="center">{view.leaderboardScope === "friends" ? "Add friends or finish ranked matches together." : "Complete a ranked match to establish your record."}</UIText>
          </View>
        </UICard>
      ) : null}
    </View>
  );
}

