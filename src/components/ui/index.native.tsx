import { useEffect } from "react";
import { useCSSVariable } from "uniwind";
import { Avatar } from "heroui-native/avatar";
import { Button } from "heroui-native/button";
import { Card } from "heroui-native/card";
import { Chip } from "heroui-native/chip";
import { Dialog } from "heroui-native/dialog";
import { Input } from "heroui-native/input";
import { HeroUINativeProvider } from "heroui-native/provider";
import { Tabs } from "heroui-native/tabs";
import { Typography } from "heroui-native/text";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ScrollView } from "react-native";
import type {
  UIAvatarProps,
  UIButtonProps,
  UICardProps,
  UIChipProps,
  UIModalProps,
  UIProviderProps,
  UITabsProps,
  UITextFieldProps,
  UITextProps,
} from "./types";

export function UIProvider({ children }: UIProviderProps) {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <HeroUINativeProvider>
          <ThemeCheck />
          {children}
        </HeroUINativeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/**
 * Reports the one failure that otherwise arrives as a wall of unexplained `colorKit.RGB` errors.
 *
 * heroui-native reads its colours from CSS variables that uniwind compiles from
 * `src/global.native.css`. Uniwind compiles a single CSS entry per Metro server and it is chosen by
 * `LGAME_PLATFORM` (see metro.config.js), so a server started for web and then opened on a device
 * bundles native JS against the web stylesheet. Every theme colour then resolves to "invalid" and
 * each component complains separately about a colour it cannot parse.
 *
 * This turns that into one line saying what to actually do.
 */
function ThemeCheck() {
  const [accent] = useCSSVariable(["--color-accent"]);
  const missing = typeof accent !== "string" || accent === "invalid";

  useEffect(() => {
    if (!missing) return;
    console.error(
      "[L Game] The native theme did not compile, so every colour falls back to black. This Metro "
        + "server was started for web. Stop it and run `npm run native` (or `npm run android` / "
        + "`npm run ios`) to bundle with src/global.native.css.",
    );
  }, [missing]);

  return null;
}

export function UIButton({ children, onPress, disabled, variant = "primary", size = "md", fullWidth, ...props }: UIButtonProps) {
  const brandClass = {
    primary: "bg-[#7fd6a6]",
    secondary: "bg-[#1f2d27]",
    outline: "border-[#33443e]",
    ghost: "bg-transparent",
    danger: "bg-[#e5695c]",
  }[variant];
  return (
    <Button
      onPress={onPress}
      isDisabled={disabled}
      variant={variant}
      size={size}
      className={`${brandClass} ${fullWidth ? "w-full" : ""} ${props.className ?? ""}`}
      style={[{ minHeight: 48 }, props.style]}
      accessibilityLabel={props.accessibilityLabel}
      testID={props.testID}
    >
      {children}
    </Button>
  );
}

export function UIText({ muted, ...props }: UITextProps) {
  return (
    <Typography
      type={props.type ?? "body"}
      color={muted ? "muted" : "default"}
      weight={props.weight}
      align={props.align}
      className={props.className}
      style={[{ color: muted ? "#8b9d93" : "#f2efe4" }, props.style]}
      numberOfLines={props.numberOfLines}
      accessibilityRole={props.accessibilityRole}
    >
      {props.children}
    </Typography>
  );
}

export function UITextField({ secureTextEntry, keyboardType, autoComplete, disabled, ...props }: UITextFieldProps) {
  return (
    <Input
      value={props.value}
      onChangeText={props.onChangeText}
      placeholder={props.placeholder}
      secureTextEntry={secureTextEntry}
      keyboardType={keyboardType}
      autoCapitalize={props.autoCapitalize}
      autoComplete={autoComplete}
      isDisabled={disabled}
      accessibilityLabel={props.accessibilityLabel}
      className={`border-[#2c3b34] bg-[#101a15] text-[#f2efe4] ${props.className ?? ""}`}
      testID={props.testID}
    />
  );
}

export function UICard({ children, variant = "default", ...props }: UICardProps) {
  const brandClass = variant === "secondary" ? "border border-[#33443e] bg-[#1f2d27]" : variant === "transparent" ? "bg-transparent" : "border border-[#22302a] bg-[#16211c]";
  return <Card variant={variant} className={`${brandClass} ${props.className ?? ""}`} style={props.style}><Card.Body>{children}</Card.Body></Card>;
}

export function UIChip({ children, color = "default", className }: UIChipProps) {
  return <Chip color={color} className={className}>{String(children)}</Chip>;
}

export function UIAvatar({ uri, name, size = "md", className, style }: UIAvatarProps) {
  return (
    <Avatar size={size} className={className} style={style}>
      {uri ? <Avatar.Image source={{ uri }} accessibilityLabel={`${name}'s DiceBear avatar`} /> : null}
      <Avatar.Fallback>{name.slice(0, 2).toUpperCase() || "?"}</Avatar.Fallback>
    </Avatar>
  );
}

export function UIModal({ open, onOpenChange, title, description, children, dismissable = true }: UIModalProps) {
  return (
    <Dialog isOpen={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay isCloseOnPress={dismissable} />
        <Dialog.Content className="mx-4 max-h-[88%]">
          {dismissable ? <Dialog.Close /> : null}
          <Dialog.Title>{title}</Dialog.Title>
          {description ? <Dialog.Description>{description}</Dialog.Description> : null}
          <ScrollView
            style={{ flexShrink: 1 }}
            contentContainerStyle={{ paddingBottom: 4 }}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}

export function UITabs<T extends string>({ value, onValueChange, options }: UITabsProps<T>) {
  return (
    <Tabs value={value} onValueChange={(next: string) => onValueChange(next as T)}>
      <Tabs.List>
        <Tabs.Indicator />
        {options.map((option) => (
          <Tabs.Trigger key={option.value} value={option.value}>
            <Tabs.Label>{option.label}</Tabs.Label>
          </Tabs.Trigger>
        ))}
      </Tabs.List>
    </Tabs>
  );
}
