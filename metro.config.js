const { getDefaultConfig } = require("expo/metro-config");
const { withUniwindConfig } = require("uniwind/metro");

const config = getDefaultConfig(__dirname);

/**
 * Uniwind compiles exactly one CSS entry per Metro instance, and web and native need different
 * ones: web pulls in `@heroui/styles`, native pulls in `heroui-native/styles`. There is no
 * per-platform option (checked against uniwind 1.11), and Metro does not know the target platform
 * when this config is evaluated - so the choice has to be made by the command that starts it.
 *
 * The consequence is the trap worth knowing about: a server started for web that a phone then
 * connects to over Expo Go will bundle native JS against the *web* stylesheet. None of
 * heroui-native's theme variables compile, every theme colour resolves to "invalid", and the app
 * fills with `colorKit.RGB` errors. `UIProvider` in src/components/ui/index.native.tsx detects
 * exactly that and says so.
 *
 * So: `npm run web` for the browser, `npm run native` (or `android`/`ios`) for a device. Running
 * both at once needs two servers on different ports.
 */
const isWebBuild = process.env.LGAME_PLATFORM === "web";

module.exports = withUniwindConfig(config, {
  cssEntryFile: isWebBuild
    ? "./src/global.web.css"
    : "./src/global.native.css",
});
