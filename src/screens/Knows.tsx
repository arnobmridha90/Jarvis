import { useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { useTable } from "../lib/useTable";
import type { Memory } from "../lib/types";

const CATEGORIES = ["preference", "habit", "goal", "person", "place", "health", "money", "work", "general"];

export default function Knows() {
  const { rows, loading } = useTable<Memory>("memories", { order: "updated_at" });
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [newFact, setNewFact] = useState("");
  const [newCat, setNewCat] = useState("preference");

  const shown = useMemo(() => rows.filter((m) =>
    (cat === "all" || m.category === cat) && (!q || m.fact.toLowerCase().includes(q.toLowerCase()))), [rows, q, cat]);

  async function save(id: string) {
    await supabase.from("memories").update({ fact: draft, source: "you", confidence: 1 }).eq("id", id);
    setEditing(null);
  }
  async function add() {
    if (!newFact.trim()) return;
    await supabase.from("memories").insert({ fact: newFact.trim(), category: newCat, source: "you", confidence: 1, pinned: true });
    setNewFact("");
  }
  const [confirmWipe, setConfirmWipe] = useState(false);
  async function wipe() {
    if (!confirmWipe) { setConfirmWipe(true); setTimeout(() => setConfirmWipe(false), 5000); return; }
    await supabase.from("memories").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    setConfirmWipe(false);
  }

  return (
    <div className="stack">
      <section className="card">
        <h2>What Jarvis knows <span className="muted small">· {rows.length} facts</span></h2>
        <p className="muted small">Everything Jarvis has learned about you, with where it came from. Edit or delete anything. Facts you add or edit are trusted fully.</p>
        <div className="row wrap">
          <input placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} />
          <select value={cat} onChange={(e) => setCat(e.target.value)}>
            <option value="all">All</option>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
      </section>

      <section className="card">
        <div className="row wrap">
          <input className="grow" placeholder="Teach Jarvis a fact about you" value={newFact} onChange={(e) => setNewFact(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()} />
          <select value={newCat} onChange={(e) => setNewCat(e.target.value)}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
          <button className="primary" onClick={add}>Add</button>
        </div>
      </section>

      <section className="card">
        {loading && <p className="muted">Loading…</p>}
        {!loading && shown.length === 0 && <p className="muted">Nothing here yet. The first learning run fills this in overnight.</p>}
        {shown.map((m) => (
          <div key={m.id} className="item">
            <div className="grow">
              {editing === m.id ? (
                <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && save(m.id)} autoFocus />
              ) : (
                <span>{m.pinned && "📌 "}{m.fact}</span>
              )}
              <p className="muted small">
                {m.category} · from {m.source} · {Math.round(m.confidence * 100)}% sure · seen {m.times_seen}× · {new Date(m.updated_at).toLocaleDateString()}
              </p>
            </div>
            <div className="row">
              {editing === m.id ? <button onClick={() => save(m.id)}>Save</button>
                : <button onClick={() => { setEditing(m.id); setDraft(m.fact); }}>Edit</button>}
              <button onClick={() => supabase.from("memories").update({ pinned: !m.pinned }).eq("id", m.id)}>{m.pinned ? "Unpin" : "Pin"}</button>
              <button className="danger" onClick={() => supabase.from("memories").delete().eq("id", m.id)}>Delete</button>
            </div>
          </div>
        ))}
      </section>

      <button className="danger" onClick={wipe}>{confirmWipe ? "Tap again to delete every memory" : "Forget everything"}</button>
    </div>
  );
}
