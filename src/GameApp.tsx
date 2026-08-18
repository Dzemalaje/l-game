import { useEffect, useState } from "react";
import { BackHandler, Platform, ScrollView, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { LegalPage, Tab } from "./game/constants";
import { useGame } from "./game/useGame";
import { RulesModal } from "./components/RulesModal";
import { UICard, UIChip, UIProvider, UIText, UITabs } from "./components/ui";
import { FriendsScreen } from "./screens/FriendsScreen";
import { HomeScreen } from "./screens/HomeScreen";
import { LeaderboardScreen } from "./screens/LeaderboardScreen";
import { LegalScreen } from "./screens/LegalScreen";
import { LockerScreen } from "./screens/LockerScreen";
import { MatchScreen } from "./screens/MatchScreen";

const NAV_OPTIONS = [
  { value: "play", label: "Play" },
  { value: "leaders", label: "Leaders" },
  { value: "friends", label: "Friends" },
  { value: "locker", label: "Locker" },
] as const;

/**
 * The tallest 9:16 box that fits the viewport.
 *
 * A match is played inside this frame and never scrolls. Scrolling a board that the player is
 * dragging on is the worst of both worlds: the drag fights the scroll, and half the board can sit
 * off screen at the moment it matters. Fixing the shape also means the layout has one aspect ratio
 * to be good at instead of every phone's.
 */
function playfield(width: number, height: number) {
  const boxHeight = Math.min(height, (width * 16) / 9);
  return { width: Math.floor((boxHeight * 9) / 16), height: Math.floor(boxHeight) };
}

export default function GameApp() {
  const { controller, view } = useGame();
  const [legal, setLegal] = useState<LegalPage | undefined>();
  const { width, height } = useWindowDimensions();
  const desktop = width >= 900;

  useEffect(() => {
    if (Platform.OS === "web") return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (view.rulesOpen) { controller.closeRules(); return true; }
      if (legal) { setLegal(undefined); return true; }
      if (view.leaveConfirmOpen) { controller.cancelLeaveMatch(); return true; }
      if (view.inMatch) { controller.requestLeaveMatch(); return true; }
      if (view.tab !== "play") { controller.setTab("play"); return true; }
      return false;
    });
    return () => subscription.remove();
  }, [controller, legal, view.inMatch, view.leaveConfirmOpen, view.rulesOpen, view.tab]);

  const content = legal ? <LegalScreen page={legal} onBack={() => setLegal(undefined)} />
    : view.tab === "leaders" ? <LeaderboardScreen controller={controller} view={view} />
      : view.tab === "friends" ? <FriendsScreen controller={controller} view={view} />
        : view.tab === "locker" ? <LockerScreen controller={controller} view={view} />
          : <HomeScreen controller={controller} view={view} onLegal={setLegal} />;

  // A match takes the whole screen. The title bar is deliberately absent there: it names the app to
  // someone already inside a game of it, and the row it costs is a row the board could have used.
  if (view.inMatch) {
    const box = playfield(width, height);
    return (
      <UIProvider>
        <SafeAreaView style={{ flex: 1, backgroundColor: "#e9e4d6" }}>
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <View
              style={{
                width: desktop ? Math.min(width - 32, 620) : box.width,
                height: desktop ? undefined : box.height,
                flex: desktop ? 1 : undefined,
                maxHeight: desktop ? 860 : undefined,
                paddingHorizontal: 12,
                paddingVertical: 10,
                backgroundColor: "#f4f0e6",
              }}
            >
              <MatchScreen controller={controller} view={view} />
            </View>
          </View>
          <RulesModal controller={controller} view={view} />
        </SafeAreaView>
      </UIProvider>
    );
  }

  return (
    <UIProvider>
      <SafeAreaView style={{ flex: 1, backgroundColor: "#f4f0e6" }}>
        <View style={{ flex: 1 }}>
          <View style={{ paddingHorizontal: Math.max(16, (width - 1180) / 2), paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#d8d1c2", backgroundColor: "#f8f5ed", flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <View style={{ flex: 1 }}><UIText type="h3">THE L GAME</UIText></View>
            <UIChip color={view.onlineCount > 0 ? "success" : "default"}>{view.onlineCount} player{view.onlineCount === 1 ? "" : "s"} online</UIChip>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ width: "100%", maxWidth: 680, alignSelf: "center", padding: width < 600 ? 16 : 24, paddingBottom: 110 }}>
            {!view.initialized ? (
              <UICard variant="secondary"><View style={{ paddingVertical: 30 }}><UIText align="center">Preparing your game…</UIText></View></UICard>
            ) : content}
          </ScrollView>
          {!legal ? (
            <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 10, backgroundColor: "#f8f5ed", borderTopWidth: 1, borderTopColor: "#d8d1c2" }}>
              <View style={{ width: "100%", maxWidth: 680, alignSelf: "center" }}>
                <UITabs value={view.tab} onValueChange={(tab: Tab) => controller.setTab(tab)} options={NAV_OPTIONS} accessibilityLabel="Primary navigation" />
              </View>
            </View>
          ) : null}
        </View>
        <RulesModal controller={controller} view={view} />
      </SafeAreaView>
    </UIProvider>
  );
}
