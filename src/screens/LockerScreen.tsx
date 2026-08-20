import { Pressable, Text, View } from "react-native";
import { AVATAR_CHOICES } from "../game/constants";
import { diceBearUrl } from "../game/avatars";
import type { GameController } from "../game/controller";
import type { GameView } from "../game/types";
import { BOARD_SKINS, PIECE_SKINS, css } from "../skins";
import { COLOR, FONT, RADIUS, alpha } from "../theme";
import { Eyebrow, Icon } from "../components/chrome";
import { MiniBoard, startingPosition } from "../components/MiniBoard";
import { Segmented } from "./LeaderboardScreen";
import { UIAvatar, UIText } from "../components/ui";

/**
 * Cosmetics, previewed on the thing they change.
 *
 * Every option used to be a full-width button whose own colours were the only clue to what it did.
 * A live board at the top and two-swatch cards below mean the choice is made by looking rather than
 * by reading a name and guessing.
 */
export function LockerScreen({ controller, view }: { controller: GameController; view: GameView }) {
  const piece = PIECE_SKINS[view.pieceSkin];
  const board = BOARD_SKINS[view.boardSkin];
  const selectedAvatar = AVATAR_CHOICES.find((choice) => choice.style === view.account?.avatarStyle);

  return (
    <View style={{ gap: 14 }}>
      <View style={{ gap: 4 }}>
        <Text accessibilityRole="header" style={{ fontFamily: FONT.ui, fontSize: 26, fontWeight: "800", letterSpacing: -0.8, color: COLOR.text }}>
          Locker
        </Text>
        <Text style={{ fontFamily: FONT.ui, fontSize: 12.5, color: COLOR.textMuted }}>
          Looks only. Nothing here changes how the game plays.
        </Text>
      </View>

      <View style={{ alignItems: "center", gap: 11, paddingVertical: 4 }}>
        <View style={{ width: 186 }}>
          {view.lockerCategory === "avatars" ? (
            <View style={{ alignItems: "center", paddingVertical: 22 }}>
              <UIAvatar
                uri={view.account?.avatarUrl || diceBearUrl(AVATAR_CHOICES[0].style, "guest-preview")}
                name={view.account?.username ?? "Guest"}
                size="lg"
              />
            </View>
          ) : (
            <MiniBoard
              position={startingPosition()}
              pieceSkin={view.pieceSkin}
              boardSkin={view.boardSkin}
              glow={css(piece.colors[0])}
            />
          )}
        </View>
        <Eyebrow color={COLOR.textDim}>
          {view.lockerCategory === "avatars"
            ? `${(selectedAvatar?.name ?? "DiceBear preview")} portraits`
            : `${piece.name} on ${board.name}`}
        </Eyebrow>
      </View>

      <Segmented
        value={view.lockerCategory}
        options={[
          { value: "pieces", label: "Pieces" },
          { value: "boards", label: "Boards" },
          { value: "avatars", label: "Avatars" },
        ]}
        onChange={(category) => controller.setLockerCategory(category)}
        label="Cosmetic category"
      />

      {view.lockerCategory === "pieces" ? (
        <Grid>
          {PIECE_SKINS.map((skin, index) => (
            <Swatch
              key={skin.name}
              name={skin.name}
              detail={`${skin.sides[0]} and ${skin.sides[1]}`}
              colors={[css(skin.colors[0]), css(skin.colors[1])]}
              selected={view.pieceSkin === index}
              onPress={() => controller.equip(index, view.boardSkin)}
            />
          ))}
        </Grid>
      ) : null}

      {view.lockerCategory === "boards" ? (
        <Grid>
          {BOARD_SKINS.map((skin, index) => (
            <Swatch
              key={skin.name}
              name={skin.name}
              detail="Board surface"
              colors={[css(skin.light), css(skin.dark)]}
              selected={view.boardSkin === index}
              onPress={() => controller.equip(view.pieceSkin, index)}
            />
          ))}
        </Grid>
      ) : null}

      {view.lockerCategory === "avatars" ? (
        <Grid>
          {AVATAR_CHOICES.map((choice) => {
            const seed = view.account?.avatarSeed || "guest-preview";
            const selected = view.account?.avatarStyle === choice.style;
            return (
              <Card
                key={choice.style}
                selected={selected}
                disabled={!view.account || selected}
                label={`${choice.name} portraits${selected ? ", selected" : ""}`}
                onPress={() => void controller.selectAvatar(choice.style)}
              >
                <View style={{ alignItems: "center", gap: 8 }}>
                  <UIAvatar uri={diceBearUrl(choice.style, seed)} name={choice.name} size="lg" />
                  <Text numberOfLines={1} style={{ fontFamily: FONT.ui, fontSize: 12.5, fontWeight: "700", color: COLOR.text }}>
                    {choice.name}
                  </Text>
                </View>
              </Card>
            );
          })}
        </Grid>
      ) : null}

      {view.lockerMessage ? (
        <UIText muted align="center" accessibilityRole="alert">{view.lockerMessage}</UIText>
      ) : null}
    </View>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>{children}</View>;
}

function Card({ children, selected, disabled, label, onPress }: {
  children: React.ReactNode; selected: boolean; disabled?: boolean; label: string; onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled: !!disabled }}
      style={({ pressed }) => ({
        flexGrow: 1,
        flexBasis: "46%",
        minHeight: 90,
        padding: 12,
        borderRadius: RADIUS.card,
        justifyContent: "center",
        backgroundColor: selected ? alpha(COLOR.mint, 0.08) : pressed ? COLOR.panelRaised : COLOR.panel,
        borderWidth: 1,
        borderColor: selected ? alpha(COLOR.mint, 0.4) : COLOR.edge,
      })}
    >
      {children}
    </Pressable>
  );
}

function Swatch({ name, detail, colors, selected, onPress }: {
  name: string; detail: string; colors: [string, string]; selected: boolean; onPress: () => void;
}) {
  return (
    <Card selected={selected} label={`${name}, ${detail}${selected ? ", selected" : ""}`} onPress={onPress}>
      <View style={{ gap: 9 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
          <View style={{ width: 26, height: 26, borderRadius: 9, backgroundColor: colors[0] }} />
          <View style={{ width: 26, height: 26, borderRadius: 9, backgroundColor: colors[1] }} />
          <View style={{ flex: 1 }} />
          {selected ? <Icon name="check" size={17} color={COLOR.mint} /> : null}
        </View>
        <View>
          <Text style={{ fontFamily: FONT.ui, fontSize: 14, fontWeight: "700", color: COLOR.text }}>{name}</Text>
          <Text style={{ fontFamily: FONT.ui, fontSize: 11, color: COLOR.textMuted }}>{detail}</Text>
        </View>
      </View>
    </Card>
  );
}
