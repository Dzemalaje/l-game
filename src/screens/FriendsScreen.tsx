import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import type { GameController } from "../game/controller";
import type { NetFriend } from "../game/net";
import type { GameView } from "../game/types";
import { COLOR, FONT, RADIUS, alpha } from "../theme";
import { Action, Dot, Eyebrow, Icon } from "../components/chrome";
import { UIAvatar, UIText, UITextField } from "../components/ui";

/**
 * Friends, grouped by what you can do about them.
 *
 * Incoming requests come first and are the only rows that carry a positive action, because they
 * are the only ones waiting on a decision. Everything else is a list you read.
 */
export function FriendsScreen({ controller, view }: { controller: GameController; view: GameView }) {
  const [username, setUsername] = useState("");

  if (!view.connected) {
    return (
      <Gate
        title="You are offline"
        body="Friends live on the game server. Reconnect to manage them."
        action="Reconnect"
        onPress={() => void controller.loadFriends()}
      />
    );
  }

  if (view.account?.guest) {
    return (
      <Gate
        title="Choose a name first"
        body="Friends find you by your username, so you need one before you can add anybody."
        action="Choose a name"
        onPress={() => { controller.setTab("play"); controller.showNameEditor(true); }}
      />
    );
  }

  // The server stores each side of a friendship as its own edge, using these same four states.
  const incoming = view.friends.filter((friend) => friend.state === 2);
  const mutual = view.friends.filter((friend) => friend.state === 0);
  const sent = view.friends.filter((friend) => friend.state === 1);
  const blocked = view.friends.filter((friend) => friend.state === 3);

  return (
    <View style={{ gap: 14 }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text accessibilityRole="header" style={{ fontFamily: FONT.ui, fontSize: 26, fontWeight: "800", letterSpacing: -0.8, color: COLOR.text }}>
            Friends
          </Text>
          <Text style={{ fontFamily: FONT.ui, fontSize: 12.5, color: COLOR.textMuted }}>
            People you can rank against.
          </Text>
        </View>
        <Pressable
          onPress={() => void controller.loadFriends()}
          accessibilityRole="button"
          accessibilityLabel="Refresh friends"
          style={{ padding: 10 }}
        >
          <Icon name="refresh" size={18} color={COLOR.textMuted} />
        </Pressable>
      </View>

      <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
        <View style={{ flex: 1 }}>
          <UITextField
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoComplete="off"
            placeholder="Exact username"
            accessibilityLabel="Friend username"
          />
        </View>
        <Action
          label="Add"
          variant="primary"
          disabled={!username.trim()}
          onPress={() => { void controller.sendFriendRequest(username); setUsername(""); }}
          style={{ paddingHorizontal: 20 }}
        />
      </View>

      {view.friendsStatus ? <UIText muted accessibilityRole="alert">{view.friendsStatus}</UIText> : null}

      <Section title="Requests" friends={incoming} controller={controller} accent={COLOR.amber} />
      <Section title="Friends" friends={mutual} controller={controller} empty="No friends yet. Add someone by their exact username." />
      <Section title="Sent" friends={sent} controller={controller} />
      <Section title="Blocked" friends={blocked} controller={controller} />
    </View>
  );
}

function Gate({ title, body, action, onPress }: { title: string; body: string; action: string; onPress: () => void }) {
  return (
    <View style={{ gap: 16 }}>
      <Text accessibilityRole="header" style={{ fontFamily: FONT.ui, fontSize: 26, fontWeight: "800", letterSpacing: -0.8, color: COLOR.text }}>
        Friends
      </Text>
      <View
        style={{
          alignItems: "center",
          gap: 10,
          paddingVertical: 26,
          paddingHorizontal: 18,
          borderRadius: RADIUS.panel,
          backgroundColor: COLOR.panel,
          borderWidth: 1,
          borderColor: COLOR.edge,
        }}
      >
        <Text style={{ fontFamily: FONT.ui, fontSize: 18, fontWeight: "700", color: COLOR.text, textAlign: "center" }}>{title}</Text>
        <Text style={{ fontFamily: FONT.ui, fontSize: 13, lineHeight: 19, color: COLOR.textMuted, textAlign: "center" }}>{body}</Text>
        <Action label={action} variant="primary" onPress={onPress} style={{ marginTop: 4, paddingHorizontal: 24 }} />
      </View>
    </View>
  );
}

function Section({ title, friends, controller, empty, accent }: {
  title: string; friends: NetFriend[]; controller: GameController; empty?: string; accent?: string;
}) {
  if (!friends.length && !empty) return null;
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Text style={{ fontFamily: FONT.ui, fontSize: 15, fontWeight: "700", color: COLOR.text }}>{title}</Text>
        <View
          style={{
            paddingHorizontal: 7,
            paddingVertical: 1,
            borderRadius: 999,
            backgroundColor: accent && friends.length ? accent : COLOR.edge,
          }}
        >
          <Text style={{ fontFamily: FONT.ui, fontSize: 10.5, fontWeight: "700", color: accent && friends.length ? COLOR.mintInk : COLOR.textDim }}>
            {friends.length}
          </Text>
        </View>
      </View>
      {friends.length
        ? friends.map((friend) => <Row key={friend.id} friend={friend} controller={controller} accent={accent} />)
        : <Text style={{ fontFamily: FONT.ui, fontSize: 13, color: COLOR.textMuted }}>{empty}</Text>}
    </View>
  );
}

function Row({ friend, controller, accent }: { friend: NetFriend; controller: GameController; accent?: string }) {
  const state = friend.state === 2 ? "Wants to be friends"
    : friend.state === 1 ? "Waiting for them to accept"
      : friend.state === 3 ? "Blocked"
        : friend.online ? "Online now" : "Offline";
  const tone = friend.state === 2 ? COLOR.amber
    : friend.state === 0 && friend.online ? COLOR.mint : COLOR.textFaint;
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 11,
        padding: 10,
        borderRadius: RADIUS.control,
        backgroundColor: COLOR.panel,
        borderWidth: 1,
        borderColor: accent && friend.state === 2 ? alpha(COLOR.amber, 0.32) : COLOR.edge,
        flexWrap: "wrap",
      }}
    >
      <View>
        <UIAvatar uri={friend.avatarUrl} name={friend.username} size="sm" />
        {friend.state === 0 ? (
          <View style={{ position: "absolute", right: -2, bottom: -2, padding: 2, borderRadius: 999, backgroundColor: COLOR.panel }}>
            <Dot color={friend.online ? COLOR.mint : COLOR.edgeStrong} size={9} />
          </View>
        ) : null}
      </View>
      <View style={{ flex: 1, minWidth: 110 }}>
        <Text numberOfLines={1} style={{ fontFamily: FONT.ui, fontSize: 14, fontWeight: "700", color: COLOR.text }}>
          {friend.username}
        </Text>
        <Eyebrow color={tone}>{state}</Eyebrow>
      </View>
      <Actions friend={friend} controller={controller} />
    </View>
  );
}

function Actions({ friend, controller }: { friend: NetFriend; controller: GameController }) {
  const small = { minHeight: 38, paddingHorizontal: 12 };
  if (friend.state === 2) {
    return (
      <View style={{ flexDirection: "row", gap: 6 }}>
        <Action label="Accept" variant="primary" style={small} onPress={() => void controller.changeFriend("accept", friend)} />
        <Action label="Decline" style={small} onPress={() => void controller.changeFriend("delete", friend)} />
      </View>
    );
  }
  if (friend.state === 1) {
    return <Action label="Cancel" style={small} onPress={() => void controller.changeFriend("delete", friend)} />;
  }
  if (friend.state === 3) {
    return <Action label="Unblock" style={small} onPress={() => void controller.changeFriend("delete", friend)} />;
  }
  return (
    <View style={{ flexDirection: "row", gap: 6 }}>
      <Action label="Remove" style={small} onPress={() => void controller.changeFriend("delete", friend)} />
      <Action label="Block" style={small} onPress={() => void controller.changeFriend("block", friend)} />
    </View>
  );
}
