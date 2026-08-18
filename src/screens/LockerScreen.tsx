import { View } from "react-native";
import { AVATAR_CHOICES } from "../game/constants";
import { diceBearUrl } from "../game/avatars";
import type { GameController } from "../game/controller";
import type { GameView } from "../game/types";
import { BOARD_SKINS, PIECE_SKINS, css } from "../skins";
import { UIAvatar, UIButton, UICard, UIText, UITabs } from "../components/ui";

export function LockerScreen({ controller, view }: { controller: GameController; view: GameView }) {
  const selectedAvatarName = AVATAR_CHOICES.find((choice) => choice.style === view.account?.avatarStyle)?.name;
  return (
    <View style={{ gap: 16 }}>
      <View style={{ gap: 4 }}><UIText type="h1">Locker</UIText><UIText muted>Personalize the board without changing gameplay.</UIText></View>
      <UICard variant="secondary">
        <View style={{ alignItems: "center", gap: 10, paddingVertical: 12 }}>
          {view.lockerCategory === "avatars" ? (
            <UIAvatar uri={view.account?.avatarUrl || diceBearUrl(AVATAR_CHOICES[0].style, "guest-preview")} name={view.account?.username ?? "Guest"} size="lg" />
          ) : <SkinPreview piece={view.pieceSkin} board={view.boardSkin} />}
          <UIText weight="bold" align="center">
            {view.lockerCategory === "avatars" ? (selectedAvatarName ?? "DiceBear preview").toUpperCase() : `${PIECE_SKINS[view.pieceSkin].name.toUpperCase()} ON ${BOARD_SKINS[view.boardSkin].name.toUpperCase()}`}
          </UIText>
        </View>
      </UICard>
      <UITabs
        value={view.lockerCategory}
        onValueChange={(category) => controller.setLockerCategory(category)}
        options={[{ value: "pieces", label: "Pieces" }, { value: "boards", label: "Boards" }, { value: "avatars", label: "Avatars" }]}
        accessibilityLabel="Cosmetic category"
      />
      {view.lockerCategory === "pieces" ? (
        <View style={{ gap: 8 }}>{PIECE_SKINS.map((skin, index) => (
          <UIButton key={skin.name} fullWidth variant={view.pieceSkin === index ? "primary" : "outline"} onPress={() => controller.equip(index, view.boardSkin)}>
            {skin.name} · {skin.sides[0]} & {skin.sides[1]}
          </UIButton>
        ))}</View>
      ) : null}
      {view.lockerCategory === "boards" ? (
        <View style={{ gap: 8 }}>{BOARD_SKINS.map((skin, index) => (
          <UIButton key={skin.name} fullWidth variant={view.boardSkin === index ? "primary" : "outline"} onPress={() => controller.equip(view.pieceSkin, index)}>{skin.name} board</UIButton>
        ))}</View>
      ) : null}
      {view.lockerCategory === "avatars" ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, justifyContent: "center" }}>
          {AVATAR_CHOICES.map((choice) => {
            const seed = view.account?.avatarSeed || "guest-preview";
            const selected = view.account?.avatarStyle === choice.style;
            return (
              <View key={choice.style} style={{ width: 132, gap: 6, alignItems: "center" }}>
                <UICard variant={selected ? "secondary" : "default"}>
                  <View style={{ gap: 8, alignItems: "center" }}>
                    <UIAvatar uri={diceBearUrl(choice.style, seed)} name={choice.name} size="lg" />
                    <UIText type="body-sm" align="center" weight="semibold">{choice.name}</UIText>
                    <UIButton size="sm" variant={selected ? "primary" : "outline"} disabled={!view.account || selected} onPress={() => void controller.selectAvatar(choice.style)}>{selected ? "Selected" : "Choose"}</UIButton>
                  </View>
                </UICard>
              </View>
            );
          })}
        </View>
      ) : null}
      <UIText muted align="center" accessibilityRole="alert">{view.lockerMessage}</UIText>
    </View>
  );
}

function SkinPreview({ piece, board }: { piece: number; board: number }) {
  const p = PIECE_SKINS[piece];
  const b = BOARD_SKINS[board];
  return (
    <View style={{ width: 176, height: 176, flexDirection: "row", flexWrap: "wrap", borderWidth: 3, borderColor: css(b.outline), borderRadius: 18, overflow: "hidden" }}>
      {Array.from({ length: 16 }, (_, index) => {
        const x = index % 4;
        const y = Math.floor(index / 4);
        const player = index === 0 || index === 4 || index === 8 || index === 9 ? 0 : index === 15 || index === 11 || index === 7 || index === 6 ? 1 : -1;
        return <View key={index} style={{ width: "25%", height: "25%", backgroundColor: player >= 0 ? css(p.colors[player as 0 | 1]) : css((x + y) % 2 ? b.dark : b.light), borderWidth: 0.5, borderColor: css(b.outline) }} />;
      })}
    </View>
  );
}

