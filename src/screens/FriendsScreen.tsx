import { useState } from "react";
import { View } from "react-native";
import type { GameController } from "../game/controller";
import type { NetFriend } from "../game/net";
import type { GameView } from "../game/types";
import { UIAvatar, UIButton, UICard, UIChip, UIText, UITextField } from "../components/ui";

export function FriendsScreen({ controller, view }: { controller: GameController; view: GameView }) {
  const [username, setUsername] = useState("");

  if (!view.connected) {
    return (
      <View style={{ gap: 16 }}>
        <UIText type="h1">Friends</UIText>
        <UICard variant="secondary">
          <View style={{ alignItems: "center", gap: 10, paddingVertical: 20 }}>
            <UIText type="h2" align="center">You are offline</UIText>
            <UIText muted align="center">Friends live on the game server. Reconnect to manage them.</UIText>
            <UIButton onPress={() => void controller.loadFriends()}>Reconnect</UIButton>
          </View>
        </UICard>
      </View>
    );
  }

  if (view.account?.guest) {
    return (
      <View style={{ gap: 16 }}>
        <UIText type="h1">Friends</UIText>
        <UICard variant="secondary">
          <View style={{ alignItems: "center", gap: 10, paddingVertical: 20 }}>
            <UIText type="h2" align="center">Choose a name first</UIText>
            <UIText muted align="center">Friends find you by your username, so you need one before you can add anybody.</UIText>
            <UIButton onPress={() => { controller.setTab("play"); controller.showNameEditor(true); }}>Choose a name</UIButton>
          </View>
        </UICard>
      </View>
    );
  }

  // The server stores each side of a friendship as its own edge, using these same four states.
  const incoming = view.friends.filter((friend) => friend.state === 2);
  const mutual = view.friends.filter((friend) => friend.state === 0);
  const sent = view.friends.filter((friend) => friend.state === 1);
  const blocked = view.friends.filter((friend) => friend.state === 3);

  return (
    <View style={{ gap: 16 }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <View style={{ gap: 4 }}><UIText type="h1">Friends</UIText><UIText muted>Play with people you know.</UIText></View>
        <UIButton size="sm" variant="ghost" onPress={() => void controller.loadFriends()}>Refresh</UIButton>
      </View>
      <UICard>
        <View style={{ gap: 10 }}>
          <UIText weight="semibold">Add by exact username</UIText>
          <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
            <View style={{ flex: 1 }}><UITextField value={username} onChangeText={setUsername} autoCapitalize="none" autoComplete="off" placeholder="PlayerName" accessibilityLabel="Friend username" /></View>
            <UIButton onPress={() => { void controller.sendFriendRequest(username); setUsername(""); }} disabled={!username.trim()}>Add</UIButton>
          </View>
        </View>
      </UICard>
      {view.friendsStatus ? <UIText muted accessibilityRole="alert">{view.friendsStatus}</UIText> : null}
      <FriendSection title="Requests" friends={incoming} controller={controller} />
      <FriendSection title="Friends" friends={mutual} controller={controller} empty="No friends yet. Add someone by username." />
      <FriendSection title="Sent" friends={sent} controller={controller} />
      <FriendSection title="Blocked" friends={blocked} controller={controller} />
    </View>
  );
}

function FriendSection({ title, friends, controller, empty }: {
  title: string; friends: NetFriend[]; controller: GameController; empty?: string;
}) {
  if (!friends.length && !empty) return null;
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><UIText type="h2">{title}</UIText><UIChip>{friends.length}</UIChip></View>
      {friends.length
        ? friends.map((friend) => <FriendRow key={friend.id} friend={friend} controller={controller} />)
        : <UIText muted>{empty}</UIText>}
    </View>
  );
}

function FriendRow({ friend, controller }: { friend: NetFriend; controller: GameController }) {
  const state = friend.state === 2 ? "Incoming request"
    : friend.state === 1 ? "Request sent"
      : friend.state === 3 ? "Blocked"
        : friend.online ? "Online" : "Offline";
  return (
    <UICard>
      <View style={{ flexDirection: "row", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <UIAvatar uri={friend.avatarUrl} name={friend.username} size="sm" />
        <View style={{ flex: 1, minWidth: 120, gap: 2 }}>
          <UIText weight="semibold">{friend.username}</UIText>
          <UIText type="body-sm" muted>{state}</UIText>
        </View>
        <FriendActions friend={friend} controller={controller} />
      </View>
    </UICard>
  );
}

function FriendActions({ friend, controller }: { friend: NetFriend; controller: GameController }) {
  if (friend.state === 2) {
    return (
      <View style={{ flexDirection: "row", gap: 4 }}>
        <UIButton size="sm" onPress={() => void controller.changeFriend("accept", friend)}>Accept</UIButton>
        <UIButton size="sm" variant="ghost" onPress={() => void controller.changeFriend("delete", friend)}>Decline</UIButton>
        <UIButton size="sm" variant="ghost" onPress={() => void controller.changeFriend("block", friend)}>Block</UIButton>
      </View>
    );
  }
  if (friend.state === 1) return <UIButton size="sm" variant="ghost" onPress={() => void controller.changeFriend("delete", friend)}>Cancel</UIButton>;
  if (friend.state === 3) return <UIButton size="sm" variant="ghost" onPress={() => void controller.changeFriend("delete", friend)}>Unblock</UIButton>;
  return (
    <View style={{ flexDirection: "row", gap: 4 }}>
      <UIButton size="sm" variant="ghost" onPress={() => void controller.changeFriend("delete", friend)}>Remove</UIButton>
      <UIButton size="sm" variant="ghost" onPress={() => void controller.changeFriend("block", friend)}>Block</UIButton>
    </View>
  );
}
