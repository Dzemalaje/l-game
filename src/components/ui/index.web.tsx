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
    primary: "bg-[#7fd6a6] text-[#08150e] font-semibold hover:bg-[#6ac492]",
    secondary: "bg-[#1f2d27] text-[#f2efe4] hover:bg-[#2c3b34]",
    outline: "border-[#33443e] text-[#9fb0a6] hover:bg-[#16211c]",
    ghost: "text-[#9fb0a6] hover:bg-[#16211c] hover:text-[#f2efe4]",
    danger: "bg-[#e5695c] text-[#2a0d0a] font-semibold hover:bg-[#c9564a]",
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
      style={{ color: muted ? "#8b9d93" : "#f2efe4", ...(props.style as React.CSSProperties) }}
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
      className={`border-[#2c3b34] bg-[#101a15] text-[#f2efe4] placeholder:text-[#5d6f66] ${props.className ?? ""}`}
      data-testid={props.testID}
      fullWidth
    />
  );
}

export function UICard({ children, variant = "default", ...props }: UICardProps) {
  const webVariant = variant === "transparent" ? "transparent" : variant;
  const brandClass = variant === "secondary" ? "border-[#33443e] bg-[#1f2d27] text-[#f2efe4]"
    : variant === "transparent" ? "border-transparent bg-transparent text-[#f2efe4] shadow-none"
      : "border-[#22302a] bg-[#16211c] text-[#f2efe4]";
  return <Card variant={webVariant} className={`border shadow-sm ${brandClass} ${props.className ?? ""}`} style={props.style as React.CSSProperties}><Card.Content>{children}</Card.Content></Card>;
}

export function UIChip({ children, color = "default", className }: UIChipProps) {
  const brandClass = color === "success" ? "bg-[#7fd6a629] text-[#7fd6a6]" : color === "warning" ? "bg-[#e8b56229] text-[#e8b562]" : color === "danger" ? "bg-[#e5695c29] text-[#e5695c]" : "bg-[#22302a] text-[#9fb0a6]";
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
