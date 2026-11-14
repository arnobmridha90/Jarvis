import { useState } from "react";
import { supabase } from "../lib/supabase";
import { useTable } from "../lib/useTable";
import type { Briefing, Reminder, Suggestion } from "../lib/types";
import { ask, listen, speak, speechSupported } from "../voice";

function ago(iso: string) {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
}

export default function Home({ voiceEnabled }: { voiceEnabled: boolean }) {
  const briefings = useTable<Briefing>("briefings", { order: "created_at", limit: 1 });
  const sugg = useTable<Suggestion>("suggestions", { order: "created_at", limit: 20, filter: ["status", "eq", "new"] });
  const rem = useTable<Reminder>("reminders", { order: "due_at", ascending: true, filter: ["done", "eq", false] });
  const [text, setText] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [listening, setListening] = useState<null | (() => void)>(null);

  async function tell(t: string, via: "typed" | "voice") {
    if (!t.trim()) return;
    if (voiceEnabled) {
      const r = await ask(t);
      if (r.answer) { setNote(r.answer); if (via === "voice") speak(r.answer); return; }
      setNote("Saved. Jarvis will pick it up on the next learning run.");
    } else {
      await supabase.from("inbox").insert({ text: t, via });
      setNote("Saved. Jarvis will learn from it tonight.");
    }
    setText("");
  }

  function mic() {
    if (listening) { listening(); setListening(null); return; }
    const stop = listen((t) => { setListening(null); setText(t); tell(t, "voice"); }, (m) => { setListening(null); setNote(m); });
    setListening(() => stop);
  }

  async function react(s: Suggestion, feedback: -1 | 1) {
    await supabase.from("suggestions").update({ feedback, status: feedback === 1 ? "done" : "dismissed" }).eq("id", s.id);
  }

  const b = briefings.rows[0];
  return (
    <div className="stack">
      <div className="card tell">
        <input placeholder="Tell Jarvis something… (e.g. I'm cutting down on sugar)" value={text}
          onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && tell(text, "typed")} />
        {speechSupported() && <button className={listening ? "mic on" : "mic"} onClick={mic} title="Speak">🎙</button>}
        <button className="primary" onClick={() => tell(text, "typed")}>Send</button>
      </div>
      {note && <p className="muted small">{note}</p>}

      <section className="card">
        <h2>Latest briefing {b && <span className="muted small">· {b.slot} · {ago(b.created_at)}</span>}</h2>
        {b ? <pre className="briefing">{b.content}</pre> : <p className="muted">No briefing yet. The next one arrives at your next briefing time.</p>}
      </section>

      <section className="card">
        <h2>Suggestions</h2>
        {sugg.rows.length === 0 && <p className="muted">Nothing right now. Jarvis adds a few each day as it learns.</p>}
        {sugg.rows.map((s) => (
          <div key={s.id} className={`item kind-${s.kind}`}>
            <div className="grow">
              <strong>{s.title}</strong>
              {s.body && <p>{s.body}</p>}
              {s.why && <p className="muted small">Why: {s.why}</p>}
            </div>
            <div className="row">
              <button title="Useful" onClick={() => react(s, 1)}>👍</button>
              <button title="Not for me" onClick={() => react(s, -1)}>👎</button>
            </div>
          </div>
        ))}
      </section>

      <section className="card">
        <h2>Upcoming reminders</h2>
        {rem.rows.length === 0 && <p className="muted">No open reminders.</p>}
        {rem.rows.slice(0, 5).map((r) => (
          <div key={r.id} className="item">
            <div className="grow">{r.text}</div>
            {r.due_at && <span className="muted small">{new Date(r.due_at).toLocaleString()}</span>}
          </div>
        ))}
      </section>
    </div>
  );
}
