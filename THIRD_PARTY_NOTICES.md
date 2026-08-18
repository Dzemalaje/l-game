# Third-Party Notices

Last reviewed: 14 August 2026

Product names and trademarks belong to their owners; inclusion does not imply endorsement.

## Avatar service and artwork

[DiceBear's HTTP API](https://www.dicebear.com/how-to-use/http-api) returns avatar SVGs. Selected
CC0 1.0 styles are Lorelei by Lisa Wischofsky, Notionists by Zoish, Open Peeps by Pablo Stanley,
and Pixel Art and Thumbs by DiceBear. Neutral variants use the matching source artwork. See the
[DiceBear license index](https://www.dicebear.com/licenses/). CC0 requires no attribution; these
credits are retained in appreciation of the artists.

## Principal runtime packages

| Component | Version | License | Project |
| --- | ---: | --- | --- |
| SpacetimeDB server | 2.8.1 | BSL 1.1 | <https://github.com/clockworklabs/SpacetimeDB> |
| `spacetimedb` (module + client SDK) | 2.8.x | ISC | <https://www.npmjs.com/package/spacetimedb> |
| Caddy (web host and gateway) | 2.10.x | Apache-2.0 | <https://github.com/caddyserver/caddy> |
| Expo / Expo Router | 57.0.x | MIT | <https://github.com/expo/expo> |
| React / React DOM | 19.2.3 | MIT | <https://github.com/facebook/react> |
| React Native | 0.86.2 | MIT | <https://github.com/facebook/react-native> |
| HeroUI Native | 1.0.8 | Apache-2.0 | <https://github.com/heroui-inc/heroui-native> |
| HeroUI React | 3.2.4 | MIT | <https://github.com/heroui-inc/heroui> |
| Uniwind | 1.10.x | MIT | <https://github.com/withuniwind/uniwind> |
| Tailwind CSS | 4.3.x | MIT | <https://github.com/tailwindlabs/tailwindcss> |
| React Native SVG | 15.15.4 | MIT | <https://github.com/software-mansion/react-native-svg> |

## SpacetimeDB licensing

The SpacetimeDB server is not open source. It is under the Business Source License 1.1, whose
Additional Use Grant permits production use provided the application "uses the Licensed Work with no
more than one SpacetimeDB instance in production" and is not itself a Database Service. The
deployment in `docker-compose.yml` runs exactly one instance and stays inside that grant; running a
second production instance, or offering the database to third parties, would not. Re-read the
current licence before scaling out: <https://github.com/clockworklabs/SpacetimeDB/blob/master/LICENSE.txt>.

## Notices

Transitive package license files are shipped in installed npm packages and linked upstream source.
Production source/distributions must retain notices required by Apache-2.0, MIT, BSD, and other
dependency licenses. Run a dependency/license inventory as part of each release upgrade.

