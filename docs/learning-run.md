# Jarvis nightly learning run

This is the prompt for the Claude scheduled task "Jarvis learning run" (daily, 3:00 AM Asia/Singapore).
It runs on Arnob's Claude plan with his connectors, so it needs no API key.
Supabase project: see `SUPABASE_PROJECT_ID` in the scheduled task. Write with `execute_sql`.

## Steps

1. **Read settings.** `select * from settings limit 1`. If `learning_paused`, log a run with note "paused" and stop.
   The owner's id is `select user_id from owner`; use it as `user_id` on every insert.
2. **Gather what's new since the last run** (`select max(ran_at) from learning_runs`), only from sources switched on in `settings.sources`:
   - `gmail`: threads from the last day. Skip newsletters and promotions unless they reveal a preference (bookings, orders, subscriptions).
   - `calendar`: events from the past day and the next 7 days.
   - `drive`: recently changed docs, plus new images in the Drive folder "Jarvis Screenshots".
   - `screenshots`: new files in the Supabase storage bucket `screenshots`, and the Drive folder above. Extract restaurants into `restaurants` (dedupe by name and area). Turn anything else useful into memories or reminders.
   - `threads`: titles, summaries and checklists of Arnob's project threads, via `get_session` on ids in `/mnt/project-files/jarvis/sessions.json`.
   - `browsing`: if Arnob's Windows laptop is reachable, stage the Chrome or Edge `History` file
     (`AppData/Local/Google/Chrome/User Data/Default/History` or `AppData/Local/Microsoft/Edge/User Data/Default/History`),
     open it with sqlite, and read the last day's visits. Skip it quietly if the laptop is off.
   - `health`: the Health Data connector, only if switched on.
   - `voice`: unprocessed rows in `inbox`. Mark them `processed_at = now()`.
   - Feedback: suggestions with `feedback <> 0` since the last run. A 👎 means "less of this"; save that as a memory with `source = 'feedback'`.
3. **Update memory.** Pick out lasting facts: preferences, habits, goals, people, places, health, money and work. Before inserting, check for a near-duplicate
   (`select id, fact from memories where fact ilike '%keyword%'`). If one exists, update it, raise `times_seen` and `confidence`, and leave pinned facts and facts with `source = 'you'` alone.
   Never store passwords, card numbers, one-time codes or other people's private messages verbatim.
4. **Suggest.** Write up to `settings.suggestions_per_day` rows into `suggestions` (title, body, why, kind = nudge | warning | idea | reminder).
   Each needs a specific "why" grounded in memories. Be honest: if something looks bad for Arnob (sleep, spending, health, missed commitments), say so kindly.
   Don't repeat a suggestion he dismissed in the last 14 days.
5. **Sync briefing times (the bridge).** Compare `settings.briefing_times`, `briefings_paused` and `quiet_days` with the three
   "Jarvis briefing" triggers (see `/mnt/project-files/jarvis/schedule.md`). If they differ, `update_trigger` each cron with
   `CRON_TZ=<settings.timezone>`, create or delete triggers so the counts match, and update `schedule.md`.
6. **Log the run.** Insert into `learning_runs` (sources_read, facts_added, facts_updated, suggestions_added, notes).

Keep the run quiet: post nothing in chat unless something failed.
