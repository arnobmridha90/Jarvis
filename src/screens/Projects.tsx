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
        <p className="muted small">Jarvis passes it to that project's Claude within {dispatchMinutes} minutes. Anything risky still asks you in that project first.</p>
        <div className="row wrap">
          <select value={target} onChange={(e) => setTarget(e.target.value)}>
            <option value="auto">Let Jarvis pick</option>
            {projects.rows.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <textarea rows={3} placeholder="e.g. Add a booking button to the Kozi homepage" value={text} onChange={(e) => setText(e.target.value)} />
        <button className="primary" disabled={!text.trim()} onClick={send}>Send to project</button>
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
