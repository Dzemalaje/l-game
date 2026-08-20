import { useEffect, useState } from "react";
import { BackHandler, Platform, ScrollView, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { LegalPage } from "./game/constants";
import { useGame } from "./game/useGame";
import { COLOR } from "./theme";
import { RulesModal } from "./components/RulesModal";
import { TabBar } from "./components/TabBar";
import { UICard, UIProvider, UIText } from "./components/ui";
import { FriendsScreen } from "./screens/FriendsScreen";
import { HomeScreen } from "./screens/HomeScreen";
import { LeaderboardScreen } from "./screens/LeaderboardScreen";
import { LegalScreen } from "./screens/LegalScreen";
import { LockerScreen } from "./screens/LockerScreen";
import { MatchScreen } from "./screens/MatchScreen";
import { ResultScreen } from "./screens/ResultScreen";
import { TutorialScreen } from "./screens/TutorialScreen";
import { WelcomeScreen } from "./screens/WelcomeScreen";

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
      if (view.intro === "tutorial") { controller.finishIntro(); return true; }
      if (view.inMatch) { controller.requestLeaveMatch(); return true; }
      if (view.tab !== "play") { controller.setTab("play"); return true; }
      return false;
    });
    return () => subscription.remove();
  }, [controller, legal, view.inMatch, view.intro, view.leaveConfirmOpen, view.rulesOpen, view.tab]);

  const content = legal ? <LegalScreen page={legal} onBack={() => setLegal(undefined)} />
    : view.tab === "leaders" ? <LeaderboardScreen controller={controller} view={view} />
      : view.tab === "friends" ? <FriendsScreen controller={controller} view={view} />
        : view.tab === "locker" ? <LockerScreen controller={controller} view={view} />
          : <HomeScreen controller={controller} view={view} onLegal={setLegal} />;

  // The intro, a match and a finished match all own the whole screen. They share the playfield
  // frame so the board is the same size and in the same place across all three, which is what
  // makes the result feel like the match stopping rather than a different screen opening.
  const fullscreen = Boolean(view.intro) || view.inMatch;

  if (fullscreen && view.initialized) {
    const box = playfield(width, height);
    // A live match on a desktop earns a wider frame, because it lays the board out beside its
    // controls rather than above them. The intro and the result stay in the narrow column: both are
    // reading screens, and a 1100px line of body copy is not one.
    const twoPane = desktop && view.inMatch && !view.resultOpen && !view.intro;
    return (
      <UIProvider>
        <SafeAreaView style={{ flex: 1, backgroundColor: COLOR.stageDeep }}>
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <View
              style={{
                width: desktop ? Math.min(width - 32, twoPane ? 1120 : 620) : box.width,
                height: desktop ? undefined : box.height,
                flex: desktop ? 1 : undefined,
                maxHeight: desktop ? 900 : undefined,
                paddingHorizontal: twoPane ? 20 : 12,
                paddingVertical: twoPane ? 16 : 10,
                backgroundColor: COLOR.stage,
              }}
            >
              {view.intro ? (
                view.intro === "welcome"
                  ? <WelcomeScreen controller={controller} view={view} />
                  : <TutorialScreen controller={controller} view={view} />
              ) : view.resultOpen ? (
                <ResultScreen controller={controller} view={view} />
              ) : (
                <MatchScreen controller={controller} view={view} wide={twoPane} />
              )}
            </View>
          </View>
          <RulesModal controller={controller} view={view} />
        </SafeAreaView>
      </UIProvider>
    );
  }

  return (
    <UIProvider>
      <SafeAreaView style={{ flex: 1, backgroundColor: COLOR.stage }}>
        <View style={{ flex: 1 }}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              width: "100%",
              maxWidth: 680,
              alignSelf: "center",
              padding: width < 600 ? 16 : 24,
              paddingBottom: 40,
              // Lets a short screen push its own footer to the bottom instead of stranding it in
              // the middle of an empty page.
              flexGrow: 1,
            }}
          >
            {!view.initialized ? (
              <UICard variant="secondary">
                <View style={{ paddingVertical: 30 }}><UIText align="center">Preparing your game…</UIText></View>
              </UICard>
            ) : content}
          </ScrollView>
          {!legal ? <TabBar value={view.tab} onChange={(tab) => controller.setTab(tab)} /> : null}
        </View>
        <RulesModal controller={controller} view={view} />
      </SafeAreaView>
    </UIProvider>
  );
}
