import { useState } from "react";
import { supabase } from "../lib/supabase";
import { useTable } from "../lib/useTable";
import type { Reminder, Restaurant } from "../lib/types";

export function Reminders() {
  const { rows } = useTable<Reminder>("reminders", { order: "created_at" });
  const [text, setText] = useState("");
  const [due, setDue] = useState("");
  async function add() {
    if (!text.trim()) return;
    await supabase.from("reminders").insert({ text: text.trim(), due_at: due ? new Date(due).toISOString() : null });
    setText(""); setDue("");
  }
  const open = rows.filter((r) => !r.done), done = rows.filter((r) => r.done);
  return (
    <div className="stack">
      <section className="card">
        <h2>Reminders</h2>
        <div className="row wrap">
          <input className="grow" placeholder="Remind me to…" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
          <input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} />
          <button className="primary" onClick={add}>Add</button>
        </div>
      </section>
      <section className="card">
        {open.length === 0 && <p className="muted">All clear.</p>}
        {[...open, ...done].map((r) => (
          <div key={r.id} className={`item ${r.done ? "done" : ""}`}>
            <input type="checkbox" checked={r.done} onChange={() => supabase.from("reminders").update({ done: !r.done }).eq("id", r.id)} />
            <div className="grow">{r.text}{r.due_at && <span className="muted small"> · {new Date(r.due_at).toLocaleString()}</span>}</div>
            <button className="danger" onClick={() => supabase.from("reminders").delete().eq("id", r.id)}>Delete</button>
          </div>
        ))}
      </section>
    </div>
  );
}

export function Places() {
  const { rows } = useTable<Restaurant>("restaurants", { order: "created_at" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // On Android this opens the system photo picker, which includes Google Photos albums.
  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true); setMsg(null);
    let ok = 0;
    for (const f of Array.from(files)) {
      const path = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}-${f.name}`;
      const { error } = await supabase.storage.from("screenshots").upload(path, f, { contentType: f.type });
      if (!error) ok++;
    }
    setBusy(false);
    setMsg(`${ok} of ${files.length} screenshots sent. Jarvis reads them on the next learning run.`);
  }

  const toTry = rows.filter((r) => !r.visited), been = rows.filter((r) => r.visited);
  return (
    <div className="stack">
      <section className="card">
        <h2>Places to try</h2>
        <p className="muted small">Share screenshots of restaurants, cafés or anything you want Jarvis to remember. It pulls out the details overnight.</p>
        <label className="button primary">
          {busy ? "Uploading…" : "Add screenshots"}
          <input type="file" accept="image/*" multiple hidden onChange={(e) => upload(e.target.files)} />
        </label>
        {msg && <p className="muted small">{msg}</p>}
      </section>
      <section className="card">
        {toTry.length === 0 && <p className="muted">No places yet.</p>}
        {[...toTry, ...been].map((r) => (
          <div key={r.id} className={`item ${r.visited ? "done" : ""}`}>
            <div className="grow">
              <strong>{r.name}</strong>
              <p className="muted small">{[r.cuisine, r.area].filter(Boolean).join(" · ")}</p>
              {r.notes && <p className="small">{r.notes}</p>}
            </div>
            <button onClick={() => supabase.from("restaurants").update({ visited: !r.visited }).eq("id", r.id)}>
              {r.visited ? "Not yet" : "Been there"}
            </button>
          </div>
        ))}
      </section>
    </div>
  );
}
