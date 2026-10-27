# Arabic and English

The header language button switches the interface immediately between Arabic (RTL) and English (LTR). Arabic is the default. The preference is stored in `brio_language_v1` on each browser/origin and synchronized between tabs on that origin. Blocked storage does not prevent switching.

Switching changes interface copy only. Quiz names, questions, answer options, nicknames, custom identity names and image labels remain user-authored content. A host's language does not force every player to use the same language.

## Implementation

- `apps/web/src/i18n/locale.ts`: locale store, interpolation, numeric locale, count wording and translation of stored system messages. It has no dependency on authentication, quiz caches or game sockets.
- `use-locale.tsx`: React subscriptions, preference restoration, cross-tab synchronization and React-managed document title/description. `useTranslations` binds rendered copy to React's hydration snapshot, avoiding mismatched text when a saved English preference restores before a deferred component hydrates. Screens do not remount or reset their state.
- `LanguageSwitch.tsx`: accessible header button with the destination language written in that language.
- `messages-*.ts`: Arabic source keys with English translations, split into bounded modules. Interpolation uses numbered slots so translated word order can differ safely.
- Dynamic errors/progress use `translateMessage` at display boundaries, including older messages stored before a language switch. HTTP/LAN APIs retain their existing contracts; known server errors are translated in the browser.
- The offline service-worker fallback contains a small independent language switch and reads the same preference. Both online and LAN builds bundle the catalogs locally.
- Google sign-in buttons use both the SDK `hl` parameter and button `locale`, as described in [Google's button-language documentation](https://developers.google.com/identity/gsi/web/guides/display-button). Login-only script loads are serialized so rapid switches cannot leave the previous SDK language active. Colors, QR codes, join codes and URLs retain intentional LTR behavior; layout/text alignment and back arrows follow the interface language.

## Adding interface text

1. Add its Arabic source and English value to a catalog module.
2. Use `t(source, values)` for system text. Never pass user quiz/answer/name content through translation.
3. Use the functions returned by `useTranslations()` in rendering components; use the imperative locale helpers in services and event processing. This keeps SSR/hydration consistent. Avoid storing translated static labels at module initialization; resolve system labels within the current render.
4. Translate transient system messages at display time. Keep locale changes out of game connection and save-effect dependencies.
5. Run the web tests and architecture/format checks. Catalog coverage tests reject untranslated JSX text, missing keys and mismatched interpolation slots.

## Validation

- 152 tests pass: 6 contracts, 10 core, 58 Worker, 69 web and 9 LAN. Workspace type checks, architecture and formatting pass; cloud and LAN exports build.
- Browser checks with production assets covered dashboard, creation, library selection, question editing, Google sign-in button copy, host/player lobby, answering, answer lock and finale in both languages.
- An unsaved quiz name survived a language switch. A host language switch kept the WebSocket connection counter unchanged; a player switch retained the accepted answer with one submission and two total connections (host + player).
- The player and authoring layouts fit 390px without horizontal overflow. Document title/description stay English after internal navigation, and the saved preference restores after a full reload.
- Offline fallback language restoration/switching and disabled-storage behavior are tested. Real Google OAuth submission and physical phone/router rehearsal were not performed in this iteration.
- Screenshots: `english-dashboard.png` and `english-player-mobile.png`. All quiz/player fixtures were isolated locally; no production sample records were created.

The English catalog adds approximately 19 kB to a typical route's first-load JavaScript versus the preceding Arabic-only build. It is bundled once and cached with hashed application assets; changing interface copy needs no catalog request. Google's sign-in widget fetches its own language resources on the login screen.
