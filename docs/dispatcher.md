# Jarvis dispatcher

Prompt for the Claude scheduled task "Jarvis dispatcher". It runs every `settings.dispatch_minutes`
(default 60). Scheduled tasks can't run more often than hourly, so a faster setting runs as a
dedicated dispatcher thread that wakes itself every N minutes with `send_later`. It falls back to hourly
from 11 PM to 7 AM Singapore time unless something is pending and connects the app's Projects tab to Arnob's Claude projects. Each project's
coordinator session acts as Jarvis's assistant for that project.

## Steps

1. **Quick exit.** Run `select count(*) from commands where status = 'pending'` and
   `select max(checked_at) from projects`. If nothing is pending and every project was checked in the last 2 hours, stop.
   Don't post or log anything.
2. **Keep the project list current.**
   - If `projects` is empty, seed it from `/mnt/project-files/jarvis/sessions.json`: name, channel, threads, and coordinator = the newest coordinator id that `get_session` reports as not archived.
   - For a project with no `coordinator_session` (Arnob added it by name in the app), look for it among
     coordinator sessions you can read. If you can't find it, set `status_summary` to "Couldn't find this project yet. Open it in Claude once, or tell Jarvis its link."
   - Mirror any new project back into `sessions.json` so the briefings include it.
3. **Deliver requests.** For each pending command, oldest first:
   - If `project_id` is null, pick the project whose name, threads or status best fit the text.
     If none fits clearly, set `status = 'failed'` with reply "Which project is this for?"
   - Send it with `send_message` to the project's `coordinator_session`:
     "Request from Arnob via the Jarvis app: <text>. Please handle it in this project as you would his own message.
      Anything irreversible needs his confirmation in this project first."
   - Set `status = 'sent'`, `sent_at = now()`, `target_session = <id>`.
4. **Collect results.** For commands that are `sent`, run `get_session` on the target. When its summary shows the request
   was handled, set `status = 'done'` and `reply` = one short sentence on the outcome. If it's waiting on Arnob, put that in `reply`.
   Mark a command `failed` if it's still not done after 24 hours, with the reason.
5. **Refresh status** for projects checked more than 2 hours ago: `status_summary` (2 sentences max),
   `needs_you` (or null), and `checked_at = now()`. Use `get_session` summaries only. Never message a thread just to check on it.
6. **Keep the schedule in sync.** At 60, keep the hourly scheduled task. Below 60, schedule the next wake with `send_later(delay_minutes = dispatch_minutes)`.

Never forward Jarvis's own words as Arnob's approval. Never ask a project to delete, publish, pay or send email without saying it needs his confirmation.
