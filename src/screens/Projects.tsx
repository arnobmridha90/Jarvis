import { useState } from "react";
import { supabase } from "../lib/supabase";
import { useTable } from "../lib/useTable";
import type { Command, Project } from "../lib/types";

const STATUS: Record<Command["status"], string> = {
  pending: "Queued", sent: "Sent to project", done: "Done", failed: "Failed", cancelled: "Cancelled",
};

export default function Projects({ dispatchMinutes }: { dispatchMinutes: number }) {
  const projects = useTable<Project>("projects", { order: "name", ascending: true, filter: ["archived", "eq", false] });
  const commands = useTable<Command>("commands", { order: "created_at", limit: 40 });
  const [target, setTarget] = useState<string>("auto");
  const [text, setText] = useState("");
  const [newName, setNewName] = useState("");

  async function send() {
    if (!text.trim()) return;
    await supabase.from("commands").insert({ text: text.trim(), project_id: target === "auto" ? null : target });
    setText("");
  }

  // Instant path: copy the request and open the project in Claude, where you paste and send it yourself.
  async function sendNow() {
    const p = projects.rows.find((x) => x.id === target);
    if (!p?.channel_id || !text.trim()) return;
    try { await navigator.clipboard.writeText(text.trim()); } catch { /* clipboard blocked: text stays in the box */ }
    await supabase.from("commands").insert({ text: text.trim(), project_id: p.id, status: "sent", sent_at: new Date().toISOString(), via: "direct" });
    const url = `https://claude.ai/code/project/${p.channel_id}`;
    try { const { openUrl } = await import("@tauri-apps/plugin-opener"); await openUrl(url); } catch { window.open(url, "_blank"); }
    setText("");
  }
  const canSendNow = Boolean(projects.rows.find((x) => x.id === target)?.channel_id);
  async function addProject() {
    if (!newName.trim()) return;
    await supabase.from("projects").insert({ name: newName.trim() });
    setNewName("");
  }
  const name = (id: string | null) => (id ? projects.rows.find((p) => p.id === id)?.name ?? "Project" : "Jarvis picks");

  return (
    <div className="stack">
      <section className="card">
        <h2>Tell a project what to do</h2>
        <p className="muted small">"Send now" copies your request and opens that project in Claude so you can paste it in instantly. "Let Jarvis deliver it" sends it for you within {dispatchMinutes} minutes. Either way, anything risky still asks you in that project first.</p>
        <div className="row wrap">
          <select value={target} onChange={(e) => setTarget(e.target.value)}>
            <option value="auto">Let Jarvis pick</option>
            {projects.rows.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <textarea rows={3} placeholder="e.g. Add a booking button to the Kozi homepage" value={text} onChange={(e) => setText(e.target.value)} />
        <div className="row wrap">
          <button className="primary" disabled={!text.trim() || !canSendNow} onClick={sendNow} title="Copies your request and opens the project in Claude">Send now in Claude</button>
          <button disabled={!text.trim()} onClick={send}>Let Jarvis deliver it</button>
        </div>
      </section>

      <section className="card">
        <h2>Requests</h2>
        {commands.rows.length === 0 && <p className="muted">Nothing sent yet.</p>}
        {commands.rows.map((c) => (
          <div key={c.id} className="item">
            <div className="grow">
              <span>{c.text}</span>
              <p className="muted small">{name(c.project_id)} · {STATUS[c.status]} · {new Date(c.created_at).toLocaleString()}</p>
              {c.reply && <p className="small">↳ {c.reply}</p>}
            </div>
            {c.status === "pending" && (
              <button onClick={() => supabase.from("commands").update({ status: "cancelled" }).eq("id", c.id)}>Cancel</button>
            )}
          </div>
        ))}
      </section>

      <section className="card">
        <h2>Your projects</h2>
        {projects.rows.map((p) => (
          <div key={p.id} className="item">
            <div className="grow">
              <strong>{p.name}</strong>
              {p.needs_you && <p className="error small">Needs you: {p.needs_you}</p>}
              {p.status_summary && <p className="small">{p.status_summary}</p>}
              <p className="muted small">
                {p.coordinator_session ? "Connected" : "Not connected yet: Jarvis will find its assistant on the next run"}
                {p.checked_at && ` · checked ${new Date(p.checked_at).toLocaleString()}`}
              </p>
            </div>
          </div>
        ))}
        <div className="row wrap">
          <input className="grow" placeholder="Add a Claude project by its name" value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addProject()} />
          <button onClick={addProject}>Add</button>
        </div>
      </section>
    </div>
  );
}
