import { Avatar, Button, Card, Chip, Input, Modal, Tabs, Typography } from "@heroui/react";
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

export function UIProvider({ children }: UIProviderProps) { return children; }

export function UIButton({ children, onPress, disabled, variant = "primary", size = "md", fullWidth, ...props }: UIButtonProps) {
  const webVariant = variant === "danger" ? "danger" : variant;
  const brandClass = {
    primary: "bg-[#556b59] text-white hover:bg-[#435648]",
    secondary: "bg-[#dfe7dc] text-[#263129] hover:bg-[#d2ddcf]",
    outline: "border-[#6c7c6e] text-[#334238] hover:bg-[#e8eee5]",
    ghost: "text-[#435648] hover:bg-[#e8eee5]",
    danger: "bg-[#a43f38] text-white hover:bg-[#8d342f]",
  }[variant];
  return (
    <Button
      onPress={() => onPress?.()}
      isDisabled={disabled}
      variant={webVariant}
      size={size}
      fullWidth={fullWidth}
      className={`${brandClass} ${props.className ?? ""}`}
      style={props.style as React.CSSProperties}
      aria-label={props.accessibilityLabel}
      data-testid={props.testID}
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
      style={{ color: muted ? "#626a65" : "#252b29", ...(props.style as React.CSSProperties) }}
      aria-live={props.accessibilityRole === "alert" ? "polite" : undefined}
    >
      {props.children}
    </Typography>
  );
}

export function UITextField({ secureTextEntry, keyboardType, autoComplete, disabled, ...props }: UITextFieldProps) {
  return (
    <Input
      value={props.value}
      onChange={(event) => props.onChangeText(event.currentTarget.value)}
      placeholder={props.placeholder}
      type={secureTextEntry ? "password" : keyboardType === "email-address" ? "email" : keyboardType === "url" ? "url" : "text"}
      autoCapitalize={props.autoCapitalize}
      autoComplete={autoComplete === "off" ? "off" : autoComplete}
      disabled={disabled}
      aria-label={props.accessibilityLabel}
      className={`border-[#b9b2a3] bg-[#fffdf7] text-[#252b29] placeholder:text-[#7b817d] ${props.className ?? ""}`}
      data-testid={props.testID}
      fullWidth
    />
  );
}

export function UICard({ children, variant = "default", ...props }: UICardProps) {
  const webVariant = variant === "transparent" ? "transparent" : variant;
  const brandClass = variant === "secondary" ? "border-[#c7d3c4] bg-[#e8eee5] text-[#252b29]"
    : variant === "transparent" ? "border-transparent bg-transparent text-[#252b29] shadow-none"
      : "border-[#d8d1c2] bg-[#fffdf7] text-[#252b29]";
  return <Card variant={webVariant} className={`border shadow-sm ${brandClass} ${props.className ?? ""}`} style={props.style as React.CSSProperties}><Card.Content>{children}</Card.Content></Card>;
}

export function UIChip({ children, color = "default", className }: UIChipProps) {
  const brandClass = color === "success" ? "bg-[#dcebdd] text-[#2d6038]" : color === "warning" ? "bg-[#f3e5bd] text-[#725619]" : color === "danger" ? "bg-[#f2d7d4] text-[#8d342f]" : "bg-[#e5e1d7] text-[#3f4742]";
  return <Chip color={color} className={`${brandClass} ${className ?? ""}`}>{children}</Chip>;
}

export function UIAvatar({ uri, name, size = "md", className, style }: UIAvatarProps) {
  return (
    <Avatar size={size} className={className} style={style as React.CSSProperties}>
      {uri ? <Avatar.Image src={uri} alt={`${name}'s DiceBear avatar`} /> : null}
      <Avatar.Fallback>{name.slice(0, 2).toUpperCase() || "?"}</Avatar.Fallback>
    </Avatar>
  );
}

export function UIModal({ open, onOpenChange, title, description, children, dismissable = true }: UIModalProps) {
  return (
    <Modal isOpen={open} onOpenChange={onOpenChange}>
      <Modal.Backdrop isDismissable={dismissable}>
        <Modal.Container placement="center" size="lg" scroll="inside">
          <Modal.Dialog>
            <Modal.Header>
              <Modal.Heading>{title}</Modal.Heading>
              {dismissable ? <Modal.CloseTrigger aria-label="Close" /> : null}
            </Modal.Header>
            <Modal.Body>
              {description ? <Typography color="muted">{description}</Typography> : null}
              {children}
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

export function UITabs<T extends string>({ value, onValueChange, options, accessibilityLabel }: UITabsProps<T>) {
  return (
    <Tabs selectedKey={value} onSelectionChange={(key) => onValueChange(String(key) as T)} aria-label={accessibilityLabel}>
      <Tabs.ListContainer>
        <Tabs.List>
          {options.map((option) => <Tabs.Tab key={option.value} id={option.value}>{option.label}</Tabs.Tab>)}
        </Tabs.List>
      </Tabs.ListContainer>
    </Tabs>
  );
}
