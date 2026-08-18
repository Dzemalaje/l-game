import { useState } from "react";
import { View } from "react-native";
import type { GameController } from "../game/controller";
import type { GameView } from "../game/types";
import { UIAvatar, UIButton, UICard, UIText, UITextField } from "../components/ui";

interface HomeScreenProps {
  controller: GameController;
  view: GameView;
  onLegal: (page: "terms" | "privacy" | "credits") => void;
}

export function HomeScreen({ controller, view, onLegal }: HomeScreenProps) {
  if (view.namePanel) return <NameEditor controller={controller} view={view} />;

  const account = view.account;
  const guest = !account || account.guest;

  return (
    <View style={{ gap: 18 }}>
      <UICard>
        <View style={{ alignItems: "center", gap: 8 }}>
          <UIAvatar uri={account?.avatarUrl} name={account?.username ?? "Guest"} size="lg" />
          <UIText type="h2" align="center">{account?.username ?? "Guest"}</UIText>
          <UIText muted align="center">
            {!view.connected ? "Offline — CPU and Pass & Play only"
              : guest ? "Choose a name to play ranked"
                : `${account.rating} rating · ${account.wins}W ${account.losses}L`}
          </UIText>
          <UIText weight="semibold" align="center">
            {account && view.ownRank ? `Global rank #${view.ownRank}` : "Unranked"}
          </UIText>
          <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8 }}>
            {account ? <UIButton size="sm" variant="ghost" onPress={() => controller.setTab("locker")}>Choose avatar</UIButton> : null}
            {account ? (
              <UIButton size="sm" variant="ghost" onPress={() => controller.showNameEditor(true)}>
                {guest ? "Choose a name" : "Change name"}
              </UIButton>
            ) : null}
            {account && !guest ? (
              <UIButton size="sm" variant="ghost" onPress={() => void controller.logout()}>Sign out</UIButton>
            ) : null}
          </View>
          {account && !guest ? (
            view.deleteAccountArmed ? (
              <View style={{ gap: 8, alignItems: "center" }}>
                <UIText muted align="center">This permanently deletes your account, rating, friends, and avatar. Past matches keep your name but no longer point at you. This cannot be undone.</UIText>
                {view.authMessage ? <UIText muted accessibilityRole="alert">{view.authMessage}</UIText> : null}
                <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8 }}>
                  <UIButton size="sm" variant="ghost" onPress={() => controller.setDeleteAccountArmed(false)} disabled={view.authBusy}>Cancel</UIButton>
                  <UIButton size="sm" variant="danger" onPress={() => void controller.deleteAccount()} disabled={view.authBusy}>Permanently delete</UIButton>
                </View>
              </View>
            ) : (
              <UIButton size="sm" variant="ghost" onPress={() => controller.setDeleteAccountArmed(true)}>Delete account</UIButton>
            )
          ) : null}
        </View>
      </UICard>

      <View style={{ gap: 10 }} accessibilityLabel="Game modes">
        <UIText type="h2">Choose a match</UIText>
        <UIButton fullWidth size="lg" onPress={() => controller.startMatch("cpu")}>Play vs CPU</UIButton>
        <UIButton fullWidth size="lg" variant="secondary" onPress={() => controller.startMatch("local")}>Pass & Play</UIButton>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1 }}>
            <UIButton fullWidth variant="outline" onPress={() => void controller.joinOnline(false)} disabled={!view.connected}>Casual</UIButton>
          </View>
          <View style={{ flex: 1 }}>
            <UIButton fullWidth variant="outline" onPress={() => void controller.joinOnline(true)} disabled={!view.connected}>Ranked</UIButton>
          </View>
        </View>
        <UIButton fullWidth variant="ghost" onPress={() => controller.openRules()}>How to play</UIButton>
      </View>

      {view.message ? <UIText align="center" muted accessibilityRole="alert">{view.message}</UIText> : null}

      <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 6 }}>
        <UIButton size="sm" variant="ghost" onPress={() => onLegal("terms")}>Terms</UIButton>
        <UIButton size="sm" variant="ghost" onPress={() => onLegal("privacy")}>Privacy</UIButton>
        <UIButton size="sm" variant="ghost" onPress={() => onLegal("credits")}>Credits & licenses</UIButton>
      </View>
    </View>
  );
}

function NameEditor({ controller, view }: { controller: GameController; view: GameView }) {
  const [newName, setNewName] = useState(view.account?.guest ? "" : view.account?.username ?? "");
  return (
    <View style={{ gap: 16 }}>
      <UIText type="h1">{view.account?.guest ? "Choose your name" : "Change player name"}</UIText>
      <UICard>
        <View style={{ gap: 14 }}>
          <View style={{ gap: 6 }}>
            <UIText weight="semibold">Username</UIText>
            <UITextField value={newName} onChangeText={setNewName} autoCapitalize="none" autoComplete="username" accessibilityLabel="New username" />
          </View>
          <UIText muted>
            3–20 letters, numbers, spaces, hyphens or underscores. Claiming a name is what unlocks
            ranked play and lets friends find you. Leaderboard records update with it.
          </UIText>
          {view.authMessage ? <UIText muted accessibilityRole="alert">{view.authMessage}</UIText> : null}
          <View style={{ flexDirection: "row", gap: 10, justifyContent: "flex-end" }}>
            <UIButton variant="ghost" onPress={() => controller.showNameEditor(false)}>Cancel</UIButton>
            <UIButton onPress={() => void controller.changeName(newName)} disabled={view.authBusy || !newName.trim()}>Save name</UIButton>
          </View>
        </View>
      </UICard>
    </View>
  );
}
