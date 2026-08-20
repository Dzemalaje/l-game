import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import type { GameController } from "../game/controller";
import type { GameView } from "../game/types";
import { COLOR, FONT, RADIUS, alpha } from "../theme";
import { Action, Eyebrow, Icon, Mono, Tag, type IconName } from "../components/chrome";
import { UIAvatar, UIButton, UICard, UIText, UITextField } from "../components/ui";

interface HomeScreenProps {
  controller: GameController;
  view: GameView;
  onLegal: (page: "terms" | "privacy" | "credits") => void;
}

/**
 * The lobby, arranged around one obvious next action.
 *
 * The old screen offered four equal-weight match types with no explanation of what any of them
 * cost, and disabled two of them without saying why. Here there is a single primary - the right
 * one for whoever is looking at it - and every other mode is a row that says what it is for. A
 * requirement like "ranked needs a name" is shown on the row it applies to, as a way in rather
 * than as a dead control.
 */
export function HomeScreen({ controller, view, onLegal }: HomeScreenProps) {
  const [showAccount, setShowAccount] = useState(false);
  if (view.namePanel) return <NameEditor controller={controller} view={view} />;

  const account = view.account;
  const guest = !account || account.guest;
  const offline = !view.connected;
  // Anyone who cannot yet play ranked is better served by an opponent that cannot punish them for
  // still learning, so the hero follows the account rather than always pushing online play.
  const heroIsCpu = guest || offline;

  return (
    <View style={{ gap: 16 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Wordmark />
        <Text style={{ flex: 1, fontFamily: FONT.ui, fontSize: 15, fontWeight: "800", color: COLOR.text }}>
          The L Game
        </Text>
        <Tag tint={view.onlineCount > 0 ? COLOR.mint : undefined} color={view.onlineCount > 0 ? COLOR.mint : COLOR.textDim}>
          {view.onlineCount > 0 ? `${view.onlineCount} online` : offline ? "Offline" : "Connecting"}
        </Tag>
      </View>

      <Pressable
        onPress={() => setShowAccount(!showAccount)}
        accessibilityRole="button"
        accessibilityLabel={`${account?.username ?? "Guest"}. Open account options`}
        accessibilityState={{ expanded: showAccount }}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 11,
          padding: 11,
          borderRadius: RADIUS.card,
          backgroundColor: alpha(COLOR.text, 0.035),
          borderWidth: 1,
          borderColor: COLOR.edge,
        }}
      >
        <UIAvatar uri={account?.avatarUrl} name={account?.username ?? "Guest"} size="md" />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={{ fontFamily: FONT.ui, fontSize: 15, fontWeight: "700", color: COLOR.text }}>
            {account?.username ?? "Guest"}
          </Text>
          <Text style={{ fontFamily: FONT.ui, fontSize: 11.5, color: COLOR.textMuted }}>
            {offline ? "Offline — computer and pass and play"
              : guest ? "Playing without an account"
                : `${account.wins}W ${account.losses}L · ${account.wins + account.losses} matches`}
          </Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Mono size={17} color={guest ? COLOR.textGhost : COLOR.text}>{guest ? "—" : String(account.rating)}</Mono>
          <Eyebrow>{view.ownRank ? `Rank ${view.ownRank}` : "Unranked"}</Eyebrow>
        </View>
        <Icon name={showAccount ? "back" : "forward"} size={16} color={COLOR.textGhost} />
      </Pressable>

      {showAccount ? <AccountPanel controller={controller} view={view} /> : null}

      {/* One unmistakable next action; everything below it is smaller. */}
      <View
        style={{
          padding: 16,
          borderRadius: RADIUS.hero,
          backgroundColor: alpha(COLOR.mint, 0.08),
          borderWidth: 1,
          borderColor: alpha(COLOR.mint, 0.26),
        }}
      >
        <Eyebrow color={COLOR.mint}>{heroIsCpu ? "Start here" : "Quick match"}</Eyebrow>
        <Text style={{ fontFamily: FONT.ui, fontSize: 23, fontWeight: "800", letterSpacing: -0.7, lineHeight: 27, color: COLOR.text, marginTop: 6 }}>
          {heroIsCpu ? "Play the computer" : "Find a casual game"}
        </Text>
        <Text style={{ fontFamily: FONT.ui, fontSize: 13, lineHeight: 19, color: COLOR.textDim, marginTop: 5, marginBottom: 14 }}>
          {offline ? "No connection to the game server, so online play is unavailable. The computer works offline."
            : guest ? "Nothing is on the line while you get the feel of it."
              : "An online opponent, nothing at stake, five minutes each."}
        </Text>
        <Action
          label={heroIsCpu ? "Play the computer" : "Find an opponent"}
          variant="primary"
          onPress={() => (heroIsCpu ? controller.startMatch("cpu") : void controller.joinOnline(false))}
          testID="home-hero"
        />
      </View>

      <View style={{ gap: 9 }} accessibilityLabel="Other ways to play">
        <Eyebrow color={COLOR.textGhost}>More ways to play</Eyebrow>

        <ModeRow
          icon="trophy"
          tone={COLOR.amber}
          title="Ranked"
          detail={guest ? "Pick a name and your rating starts here." : "Rating moves. Five minutes each."}
          trailing={guest ? "Claim a name" : offline ? "Offline" : String(account?.rating ?? "")}
          highlight={guest}
          disabled={offline}
          onPress={() => (guest ? controller.showNameEditor(true) : void controller.joinOnline(true))}
          testID="home-ranked"
        />

        {!heroIsCpu ? (
          <ModeRow
            icon="computer"
            tone={COLOR.mint}
            title="vs Computer"
            detail="Practise offline. Nothing counts."
            onPress={() => controller.startMatch("cpu")}
            testID="home-cpu"
          />
        ) : null}

        <ModeRow
          icon="handoff"
          tone={COLOR.textMuted}
          title="Pass and play"
          detail="Two people, one device."
          onPress={() => controller.startMatch("local")}
          testID="home-local"
        />
      </View>

      {view.message ? (
        <UIText align="center" muted accessibilityRole="alert">{view.message}</UIText>
      ) : null}

      <View style={{ flex: 1, minHeight: 8 }} />

      <Action label="How to play" onPress={() => controller.replayTutorial()} testID="home-rules" />

      <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 6 }}>
        <UIButton size="sm" variant="ghost" onPress={() => onLegal("terms")}>Terms</UIButton>
        <UIButton size="sm" variant="ghost" onPress={() => onLegal("privacy")}>Privacy</UIButton>
        <UIButton size="sm" variant="ghost" onPress={() => onLegal("credits")}>Credits & licenses</UIButton>
      </View>
    </View>
  );
}

/** Two overlapping squares in the two side colours: the smallest possible picture of the game. */
function Wordmark() {
  return (
    <View style={{ width: 22, height: 22 }}>
      <View style={{ position: "absolute", right: 0, bottom: 0, width: 14, height: 14, borderRadius: 5, backgroundColor: "#4778ad" }} />
      <View style={{ position: "absolute", left: 0, top: 0, width: 14, height: 14, borderRadius: 5, backgroundColor: "#cf5c4f" }} />
    </View>
  );
}

function ModeRow({ icon, tone, title, detail, trailing, highlight, disabled, onPress, testID }: {
  icon: IconName; tone: string; title: string; detail: string;
  trailing?: string; highlight?: boolean; disabled?: boolean; onPress: () => void; testID?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${detail}`}
      accessibilityState={{ disabled: !!disabled }}
      testID={testID}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        padding: 13,
        minHeight: 66,
        borderRadius: RADIUS.card,
        backgroundColor: pressed ? COLOR.panelRaised : COLOR.panel,
        borderWidth: 1,
        borderColor: highlight ? alpha(COLOR.amber, 0.3) : COLOR.edge,
        opacity: disabled ? 0.5 : 1,
      })}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: alpha(COLOR.text, 0.05),
          borderWidth: 1,
          borderColor: COLOR.edgeMid,
        }}
      >
        <Icon name={icon} size={19} color={tone} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontFamily: FONT.ui, fontSize: 14.5, fontWeight: "700", color: COLOR.text }}>{title}</Text>
        <Text style={{ fontFamily: FONT.ui, fontSize: 11.5, lineHeight: 16, color: COLOR.textMuted }}>{detail}</Text>
      </View>
      {trailing ? (
        highlight ? (
          <Tag tint={COLOR.amber} color={COLOR.amber}>{trailing}</Tag>
        ) : (
          <Mono size={15}>{trailing}</Mono>
        )
      ) : (
        <Icon name="forward" size={16} color={COLOR.textGhost} />
      )}
    </Pressable>
  );
}

/** Account management, folded away until the profile row is tapped. */
function AccountPanel({ controller, view }: { controller: GameController; view: GameView }) {
  const account = view.account;
  const guest = !account || account.guest;
  if (!account) return null;
  return (
    <UICard variant="secondary">
      <View style={{ gap: 10 }}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          <UIButton size="sm" variant="ghost" onPress={() => controller.setTab("locker")}>Choose avatar</UIButton>
          <UIButton size="sm" variant="ghost" onPress={() => controller.showNameEditor(true)}>
            {guest ? "Choose a name" : "Change name"}
          </UIButton>
          {!guest ? <UIButton size="sm" variant="ghost" onPress={() => void controller.logout()}>Sign out</UIButton> : null}
        </View>
        {!guest ? (
          view.deleteAccountArmed ? (
            <View style={{ gap: 8 }}>
              <UIText muted>
                This permanently deletes your account, rating, friends, and avatar. Past matches keep
                your name but no longer point at you. This cannot be undone.
              </UIText>
              {view.authMessage ? <UIText muted accessibilityRole="alert">{view.authMessage}</UIText> : null}
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                <UIButton size="sm" variant="ghost" onPress={() => controller.setDeleteAccountArmed(false)} disabled={view.authBusy}>Cancel</UIButton>
                <UIButton size="sm" variant="danger" onPress={() => void controller.deleteAccount()} disabled={view.authBusy}>Permanently delete</UIButton>
              </View>
            </View>
          ) : (
            <View style={{ flexDirection: "row" }}>
              <UIButton size="sm" variant="ghost" onPress={() => controller.setDeleteAccountArmed(true)}>Delete account</UIButton>
            </View>
          )
        ) : null}
      </View>
    </UICard>
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
