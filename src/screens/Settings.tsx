import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { Settings as S } from "../lib/types";
import { checkForUpdate, currentVersion, UpdateState } from "../lib/updates";
import { speechSupported } from "../voice";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const SOURCES: [string, string][] = [
  ["gmail", "Gmail"], ["calendar", "Google Calendar"], ["drive", "Google Drive and Docs"],
  ["threads", "Claude project threads"], ["screenshots", "Screenshots you share"],
  ["browsing", "Browsing history (Chrome/Edge on your laptop)"], ["health", "Health data"],
  ["voice", "What you tell Jarvis"],
];

export default function Settings({ settings }: { settings: S | null }) {
  const [s, setS] = useState<S | null>(settings);
  const [saved, setSaved] = useState<string | null>(null);
  const [version, setVersion] = useState("…");
  const [upd, setUpd] = useState<UpdateState | null>(null);

  useEffect(() => setS(settings), [settings]);
  useEffect(() => { currentVersion().then(setVersion); }, []);

  if (!s) return <p className="muted">Loading settings…</p>;

  async function patch(p: Partial<S>) {
    const next = { ...s!, ...p };
    setS(next);
    const { error } = await supabase.from("settings").update(p).eq("user_id", next.user_id);
    setSaved(error ? `Couldn't save: ${error.message}` : "Saved. Syncing to your other devices.");
    setTimeout(() => setSaved(null), 2500);
  }

  const times = s.briefing_times;
  return (
    <div className="stack">
      {saved && <div className="toast">{saved}</div>}

      <section className="card">
        <h2>Briefings</h2>
        <p className="muted small">Times are in {s.timezone}. Changes reach the briefing schedule within a few hours.</p>
        {times.map((t, i) => (
          <div className="row" key={i}>
            <input type="time" value={t} onChange={(e) => { const n = [...times]; n[i] = e.target.value; patch({ briefing_times: n.sort() }); }} />
            <button className="danger" disabled={times.length <= 1} onClick={() => patch({ briefing_times: times.filter((_, j) => j !== i) })}>Remove</button>
          </div>
        ))}
        <div className="row wrap">
          <button disabled={times.length >= 6} onClick={() => patch({ briefing_times: [...times, "12:00"].sort() })}>Add a time</button>
          <label className="toggle"><input type="checkbox" checked={s.briefings_paused} onChange={(e) => patch({ briefings_paused: e.target.checked })} /> Pause all briefings</label>
        </div>
        <h3>Quiet days</h3>
        <div className="row wrap">
          {DAYS.map((d, i) => (
            <label key={d} className="chip">
              <input type="checkbox" checked={s.quiet_days.includes(i)}
                onChange={(e) => patch({ quiet_days: e.target.checked ? [...s.quiet_days, i] : s.quiet_days.filter((x) => x !== i) })} />
              {d}
            </label>
          ))}
        </div>
        <h3>Time zone</h3>
        <input value={s.timezone} onChange={(e) => setS({ ...s, timezone: e.target.value })} onBlur={() => patch({ timezone: s.timezone })} />
      </section>

      <section className="card">
        <h2>Learning</h2>
        <p className="muted small">Jarvis reads what's new from these sources every night and adds what it learns to "What Jarvis knows".</p>
        {SOURCES.map(([k, label]) => (
          <label key={k} className="toggle">
            <input type="checkbox" checked={!!s.sources[k]} onChange={(e) => patch({ sources: { ...s.sources, [k]: e.target.checked } })} />
            {label}
          </label>
        ))}
        <label className="toggle"><input type="checkbox" checked={s.learning_paused} onChange={(e) => patch({ learning_paused: e.target.checked })} /> Pause all learning</label>
        <h3>Suggestions per day</h3>
        <input type="range" min={0} max={10} value={s.suggestions_per_day} onChange={(e) => patch({ suggestions_per_day: Number(e.target.value) })} />
        <span className="muted small"> {s.suggestions_per_day}</span>
      </section>

      <section className="card">
        <h2>Projects</h2>
        <p className="muted small">How often Jarvis passes your requests to your Claude projects and refreshes their status. Shorter is faster but uses more of your Claude plan.</p>
        <select value={s.dispatch_minutes} onChange={(e) => patch({ dispatch_minutes: Number(e.target.value) })}>
          {[5, 10, 15, 30, 60].map((m) => <option key={m} value={m}>Every {m} minutes</option>)}
        </select>
      </section>

      <section className="card">
        <h2>Voice</h2>
        <label className="toggle">
          <input type="checkbox" checked={s.voice_enabled} onChange={(e) => patch({ voice_enabled: e.target.checked })} />
          Live voice answers
        </label>
        <p className="muted small">
          {s.voice_enabled
            ? "On. If the AI key isn't set up yet, what you say is saved for the nightly run instead."
            : "Off. The mic still works and saves what you say for Jarvis to learn from overnight. Live answers need an API key (not set up yet)."}
          {!speechSupported() && " This device doesn't offer speech recognition yet."}
        </p>
      </section>

      <section className="card">
        <h2>App</h2>
        <p className="small">Version {version}</p>
        <div className="row wrap">
          <button onClick={async () => setUpd(await checkForUpdate())}>Check for updates</button>
          {upd?.kind === "available" && <button className="primary" onClick={upd.install}>Install {upd.version}</button>}
          {upd?.kind === "none" && <span className="muted small">You're up to date.</span>}
          {upd?.kind === "error" && <span className="error small">{upd.message}</span>}
          <button className="link" onClick={() => supabase.auth.signOut()}>Sign out</button>
        </div>
      </section>
    </div>
  );
}
