import { Linking, View } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { LEGAL_CONTACT, LEGAL_OPERATOR, type LegalPage } from "../game/constants";
import { UIButton, UICard, UIText } from "../components/ui";

export function LegalScreen({ page, onBack }: { page: LegalPage; onBack: () => void }) {
  const title = page === "terms" ? "Terms of Use" : page === "privacy" ? "Privacy Policy" : "Credits & Licenses";
  return (
    <View style={{ gap: 16 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <UIButton size="sm" variant="ghost" onPress={onBack}>Back</UIButton>
        <UIText type="h1">{title}</UIText>
      </View>
      <UICard><View style={{ gap: 14 }}>{page === "terms" ? <Terms /> : page === "privacy" ? <Privacy /> : <Credits />}</View></UICard>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <View style={{ gap: 5 }}><UIText type="h3">{title}</UIText><UIText muted>{children}</UIText></View>;
}

function Terms() {
  return <>
    <UIText muted>Last updated: 14 August 2026</UIText>
    <UIText>These terms govern use of The L Game provided by {LEGAL_OPERATOR}. By creating an account or playing online, you agree to them.</UIText>
    <Section title="1. Accounts and eligibility">Give accurate information, keep credentials secure, and use only accounts you control. Where local law requires parental consent, use the online service only with that consent.</Section>
    <Section title="2. Fair and acceptable play">Do not cheat, automate play, manipulate ratings, impersonate or harass people, send abusive requests, probe the service, or interfere with access. Usernames must be appropriate and lawful.</Section>
    <Section title="3. Results and rankings">The authoritative SpacetimeDB server decides legal moves, clocks, results, and ratings. Rankings are recreational, may be corrected for errors or abuse, and are not money or property.</Section>
    <Section title="4. Availability and third parties">The service may change, pause, reset, or end. DiceBear avatar images and open-source components are governed by their providers’ terms and licenses.</Section>
    <Section title="5. Enforcement">We may restrict access, remove inappropriate names, reverse manipulated results, or preserve evidence needed to protect players and the service.</Section>
    <Section title="6. Disclaimers and liability">The service is provided “as is” and “as available.” To the extent law permits, implied warranties and liability for indirect or consequential losses are excluded. Mandatory consumer rights remain unaffected.</Section>
    <Section title="7. Contact">Material changes will update this page and date. Questions: {LEGAL_CONTACT}.</Section>
  </>;
}

function Privacy() {
  return <>
    <UIText muted>Last updated: 14 August 2026</UIText>
    <UIText>{LEGAL_OPERATOR} is responsible for personal data processed by this deployment. Contact: {LEGAL_CONTACT}.</UIText>
    <Section title="What we process">Username, a device-held identity token, optional avatar style and random seed; game moves, clocks, results, rating, record, rank and reconnect state; friends, requests, blocks, notifications and temporary presence; necessary request and security logs.</Section>
    <Section title="On your device">Session and refresh tokens, a random guest ID, selected cosmetics, and the configured server address. Native tokens use Expo SecureStore; web tokens use browser local storage.</Section>
    <Section title="Why we process it">To provide accounts, matchmaking, authoritative games, rankings, avatars, friends, security, troubleshooting, and service integrity.</Section>
    <Section title="Sharing and external services">SpacetimeDB is self-hosted for this deployment. Avatar display requests an SVG from DiceBear with the selected style and opaque seed; the URL contains no username or account identifier. No advertising or separate analytics service is included.</Section>
    <Section title="Visibility">Username, avatar, rating, record, rank, online status, and friendship state may be shown to other players. Emails, hashes, tokens, blocks, and server-only records are not public.</Section>
    <Section title="Retention and rights">Account, rating, social, and up to 50 recent match records per player remain while needed to run and secure the service, resolve disputes, meet legal duties, and maintain backups. You can permanently delete your account in the account panel. Contact the operator to request access, correction, export, restriction, or objection where applicable.</Section>
    <Section title="Security and children">The service uses access controls and server-authoritative validation, but no system is perfectly secure. It is not directed to children below their country’s minimum digital-consent age.</Section>
  </>;
}

function Credits() {
  return <>
    <UIText>The L Game uses the following tools and APIs. Names belong to their owners; this project is not endorsed by them.</UIText>
    <Credit name="SpacetimeDB and TypeScript SDK" detail="Clockwork Labs · BSL 1.1 · database, authoritative game module, realtime subscriptions, matchmaking, and identity" url="https://spacetimedb.com" />
    <Credit name="Expo and Expo Router" detail="650 Industries / Expo · MIT License · shared iOS, Android, and web application runtime" url="https://expo.dev" />
    <Credit name="React and React Native" detail="Meta and contributors · MIT License · application and native rendering" url="https://reactnative.dev" />
    <Credit name="HeroUI Native and HeroUI React" detail="HeroUI · Apache-2.0 / MIT licensed packages · interface components for mobile and web" url="https://www.heroui.com" />
    <Credit name="Uniwind and Tailwind CSS" detail="Cross-platform styling and design tokens; see their package licenses." url="https://uniwind.dev" />
    <Credit name="React Native SVG" detail="MIT License · cross-platform board drawing" url="https://github.com/software-mansion/react-native-svg" />
    <Credit name="DiceBear HTTP API" detail="Avatars use CC0 styles: Lorelei, Notionists, Open Peeps, Pixel Art, and Thumbs. Style credits are listed by DiceBear." url="https://www.dicebear.com/licenses/" />
    <UIText muted>Complete dependency license text and notices are also included in THIRD_PARTY_NOTICES.md with the source distribution.</UIText>
  </>;
}

function Credit({ name, detail, url }: { name: string; detail: string; url: string }) {
  const open = async () => {
    try { await WebBrowser.openBrowserAsync(url); }
    catch { await Linking.openURL(url); }
  };
  return <View style={{ gap: 4 }}><UIText weight="semibold">{name}</UIText><UIText muted>{detail}</UIText><UIButton size="sm" variant="ghost" onPress={() => void open()}>Open reference</UIButton></View>;
}
