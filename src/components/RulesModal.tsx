import { View } from "react-native";
import type { GameController } from "../game/controller";
import type { GameView } from "../game/types";
import { UIButton, UICard, UIModal, UIText } from "./ui";

const SLIDES = [
  { title: "Trap the other L", eyebrow: "GOAL", body: "Each player controls one four-square L. Win by leaving your opponent with no legal new position for their L." },
  { title: "Move your whole L", eyebrow: "STEP 1", body: "Tap four highlighted squares in one continuous L-shaped path. The new L cannot overlap the other player or either neutral disc, and it must change position." },
  { title: "Move a neutral disc", eyebrow: "STEP 2", body: "After placing your L, you may select either white disc and move it to any highlighted empty square. Moving a disc is optional—choose Skip disc to leave both where they are." },
  { title: "Finish the turn", eyebrow: "STEP 3", body: "Confirm the disc move or skip it. If the next player cannot reposition their L, the match ends immediately. A clock reaching zero also loses the match." },
  { title: "Online play is authoritative", eyebrow: "PLAY", body: "Casual and ranked moves, clocks, reconnect windows, results, and ratings are validated by the server. Queueing, waiting, live, reconnecting, and offline indicators always show the current state." },
] as const;

export function RulesModal({ controller, view }: { controller: GameController; view: GameView }) {
  const slide = SLIDES[view.rulesSlide];
  return (
    <UIModal open={view.rulesOpen} onOpenChange={(open) => open ? undefined : controller.closeRules()} title="How to play" dismissable>
      <View style={{ gap: 16, paddingTop: 12 }}>
        <UICard variant="secondary">
          <View style={{ minHeight: 210, justifyContent: "center", gap: 12, padding: 10 }}>
            <UIText type="body-sm" weight="bold" muted>{slide.eyebrow}</UIText>
            <UIText type="h1">{slide.title}</UIText>
            <UIText>{slide.body}</UIText>
          </View>
        </UICard>
        <View style={{ flexDirection: "row", justifyContent: "center", gap: 7 }} accessibilityLabel={`Slide ${view.rulesSlide + 1} of ${SLIDES.length}`}>
          {SLIDES.map((_, index) => <View key={index} style={{ width: index === view.rulesSlide ? 24 : 8, height: 8, borderRadius: 4, backgroundColor: index === view.rulesSlide ? "#556b59" : "#c8c1b2" }} />)}
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 10 }}>
          <UIButton variant="ghost" disabled={view.rulesSlide === 0} onPress={() => controller.setRulesSlide(view.rulesSlide - 1)}>Previous</UIButton>
          {view.rulesSlide === SLIDES.length - 1
            ? <UIButton onPress={() => controller.closeRules()}>Got it</UIButton>
            : <UIButton onPress={() => controller.setRulesSlide(view.rulesSlide + 1)}>Next</UIButton>}
        </View>
      </View>
    </UIModal>
  );
}

