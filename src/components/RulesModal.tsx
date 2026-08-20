import { Text, View } from "react-native";
import type { GameController } from "../game/controller";
import type { GameView } from "../game/types";
import { COLOR, FONT, RADIUS, alpha } from "../theme";
import { Action, Eyebrow } from "./chrome";
import { UIModal } from "./ui";

/**
 * The in-match reference.
 *
 * The playable tutorial teaches the game; this is what you open mid-turn when you have forgotten
 * whether the disc step is compulsory. So it stays short, uses the same words the match screen uses
 * — trace, glow, step one of two — and never replaces the tutorial's job.
 */
const SLIDES = [
  {
    eyebrow: "Goal",
    title: "Trap the other L",
    body: "Each player controls one four-square L. You win the moment your opponent has no legal new position for theirs.",
  },
  {
    eyebrow: "Step 1 of 2",
    title: "Trace your L",
    body: "Tap or drag through the four glowing squares. Only legal landings glow. Your L may flip or rotate, but it cannot stay where it was, and it cannot overlap the other piece or a disc.",
  },
  {
    eyebrow: "Step 2 of 2",
    title: "Move a disc, or do not",
    body: "Once your L is placed you may slide either white disc to an empty square. This is optional — ending the turn straight away is a legal move.",
  },
  {
    eyebrow: "Undo",
    title: "Nothing counts until you end the turn",
    body: "Undo takes back the last square, the disc, or the whole L. End turn commits the L and the disc together.",
  },
  {
    eyebrow: "Online",
    title: "The server has the final say",
    body: "Moves, clocks, reconnect windows, results and ratings are all decided by the server. Running your clock to zero loses the match.",
  },
] as const;

export function RulesModal({ controller, view }: { controller: GameController; view: GameView }) {
  const slide = SLIDES[view.rulesSlide];
  const last = view.rulesSlide === SLIDES.length - 1;
  return (
    <UIModal open={view.rulesOpen} onOpenChange={(open) => open ? undefined : controller.closeRules()} title="How to play" dismissable>
      <View style={{ gap: 16, paddingTop: 12 }}>
        <View
          style={{
            minHeight: 190,
            justifyContent: "center",
            gap: 10,
            padding: 16,
            borderRadius: RADIUS.panel,
            backgroundColor: alpha(COLOR.mint, 0.06),
            borderWidth: 1,
            borderColor: alpha(COLOR.mint, 0.22),
          }}
        >
          <Eyebrow color={COLOR.mint}>{slide.eyebrow}</Eyebrow>
          <Text style={{ fontFamily: FONT.ui, fontSize: 24, fontWeight: "800", letterSpacing: -0.7, lineHeight: 28, color: COLOR.text }}>
            {slide.title}
          </Text>
          <Text style={{ fontFamily: FONT.ui, fontSize: 14, lineHeight: 21, color: COLOR.textDim }}>
            {slide.body}
          </Text>
        </View>

        <View
          style={{ flexDirection: "row", justifyContent: "center", gap: 7 }}
          accessibilityLabel={`Slide ${view.rulesSlide + 1} of ${SLIDES.length}`}
        >
          {SLIDES.map((_, index) => (
            <View
              key={index}
              style={{
                width: index === view.rulesSlide ? 24 : 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: index === view.rulesSlide ? COLOR.mint : COLOR.edgeMid,
              }}
            />
          ))}
        </View>

        <View style={{ flexDirection: "row", gap: 10 }}>
          <Action
            label="Previous"
            disabled={view.rulesSlide === 0}
            onPress={() => controller.setRulesSlide(view.rulesSlide - 1)}
            style={{ flex: 1 }}
          />
          <Action
            label={last ? "Got it" : "Next"}
            variant="primary"
            onPress={() => (last ? controller.closeRules() : controller.setRulesSlide(view.rulesSlide + 1))}
            style={{ flex: 1 }}
          />
        </View>
      </View>
    </UIModal>
  );
}
