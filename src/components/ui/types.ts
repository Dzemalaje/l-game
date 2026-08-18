import type { ReactNode } from "react";
import type { ImageStyle, StyleProp, TextStyle, ViewStyle } from "react-native";

export interface UIProviderProps { children: ReactNode }

export interface UIButtonProps {
  children: ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
  className?: string;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  testID?: string;
}

export interface UITextProps {
  children?: ReactNode;
  type?: "h1" | "h2" | "h3" | "h4" | "body" | "body-sm" | "body-xs" | "code";
  muted?: boolean;
  weight?: "normal" | "medium" | "semibold" | "bold";
  align?: "start" | "center" | "end";
  className?: string;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
  accessibilityRole?: "header" | "text" | "summary" | "timer" | "alert";
}

export interface UITextFieldProps {
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: "default" | "email-address" | "url";
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  autoComplete?: "email" | "username" | "current-password" | "new-password" | "off";
  disabled?: boolean;
  accessibilityLabel?: string;
  className?: string;
  testID?: string;
}

export interface UICardProps {
  children: ReactNode;
  className?: string;
  style?: StyleProp<ViewStyle>;
  variant?: "default" | "secondary" | "tertiary" | "transparent";
}

export interface UIChipProps {
  children: ReactNode;
  color?: "default" | "accent" | "success" | "warning" | "danger";
  className?: string;
}

export interface UIAvatarProps {
  uri?: string;
  name: string;
  size?: "sm" | "md" | "lg";
  className?: string;
  style?: StyleProp<ImageStyle>;
}

export interface UIModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  dismissable?: boolean;
}

export interface UITabsProps<T extends string> {
  value: T;
  onValueChange: (value: T) => void;
  options: readonly { value: T; label: string }[];
  accessibilityLabel?: string;
}

