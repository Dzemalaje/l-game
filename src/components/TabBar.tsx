import { Pressable, Text, View } from "react-native";
import type { Tab } from "../game/constants";
import { COLOR, FONT } from "../theme";
import { Icon, type IconName } from "./chrome";

const TABS: { value: Tab; label: string; icon: IconName }[] = [
  { value: "play", label: "Play", icon: "play" },
  { value: "leaders", label: "Leaders", icon: "leaders" },
  { value: "friends", label: "Friends", icon: "friends" },
  { value: "locker", label: "Locker", icon: "locker" },
];

/**
 * The four top-level destinations.
 *
 * Icons carry the recognition and the words carry the meaning; neither is dropped at small sizes,
 * because a bare icon row is a memory test and a bare word row is hard to hit. Each target is a
 * full-height column rather than the text alone, which keeps every one of them well past the 48dp
 * minimum on the narrowest phone.
 */
export function TabBar({ value, onChange }: { value: Tab; onChange: (tab: Tab) => void }) {
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel="Primary navigation"
      style={{
        flexDirection: "row",
        backgroundColor: COLOR.panelSunken,
        borderTopWidth: 1,
        borderTopColor: COLOR.edge,
        paddingTop: 4,
        paddingHorizontal: 8,
      }}
    >
      {TABS.map((tab) => {
        const active = tab.value === value;
        const tone = active ? COLOR.mint : COLOR.textGhost;
        return (
          <Pressable
            key={tab.value}
            onPress={() => onChange(tab.value)}
            accessibilityRole="tab"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected: active }}
            testID={`tab-${tab.value}`}
            style={({ pressed }) => ({
              flex: 1,
              minHeight: 52,
              alignItems: "center",
              justifyContent: "center",
              gap: 4,
              paddingVertical: 6,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Icon name={tab.icon} size={21} color={tone} />
            <Text style={{ fontFamily: FONT.ui, fontSize: 10, fontWeight: "700", letterSpacing: 0.6, color: tone }}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
