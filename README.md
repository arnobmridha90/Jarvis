# Jarvis

Arnob's personal assistant: a Windows app and an Android app built from one codebase (Tauri 2 + React).

- **Sync:** Supabase (sign in with an emailed code; row-level security locks every table to the first account, the owner). Changes appear live on every device.
- **Auto update:** every push to `main` builds a new version (`.github/workflows/release.yml`). Windows installs it in the background on next launch; Android shows an "Update" banner that downloads the new APK.
- **Projects:** tell any of your Claude projects what to do from the Projects tab; a Claude scheduled task delivers it to that project's coordinator and reports back. See `docs/dispatcher.md`.
- **Learning:** a nightly Claude scheduled task reads the sources switched on in Settings and writes facts to `memories` and nudges to `suggestions`. See `docs/learning-run.md`.
- **Voice:** the mic saves what you say for the nightly run. For live answers, set `ANTHROPIC_API_KEY` on Supabase and deploy `supabase/functions/jarvis-ask`.

## Screens
Home (briefing, suggestions with 👍/👎, reminders, "Tell Jarvis"), Projects (send requests to each Claude project, see status), Knows (view/edit/delete everything Jarvis has learned), Reminders, Places (restaurants from screenshots), Settings (briefing times, quiet days, time zone, learning sources, suggestions per day, voice, updates).

## One-time setup
1. Apply the migrations in `supabase/migrations` to the Supabase project.
2. Fill `.env.production` with the project URL and publishable key (both are public by design).
3. Add repository secrets: `TAURI_SIGNING_PRIVATE_KEY`, `ANDROID_KEYSTORE_B64`, `ANDROID_KEYSTORE_PASSWORD`.
4. After signing in on both devices, turn off new sign-ups in Supabase Auth.

## Develop
```
npm install
npm run tauri dev            # desktop
npm run tauri android dev    # Android (needs Android Studio + NDK)
```
