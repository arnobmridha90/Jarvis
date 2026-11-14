import { useState } from "react";
import { supabase } from "../lib/supabase";

export default function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function signIn() {
    setBusy(true); setErr(null); setMsg(null);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) setErr(error.message === "Email not confirmed"
      ? "Open the confirmation email from Supabase and click the link, then sign in here again."
      : error.message);
  }
  async function create() {
    setBusy(true); setErr(null); setMsg(null);
    const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
    setBusy(false);
    if (error) setErr(error.message);
    else if (!data.session) setMsg("Account created. Click the link in the email from Supabase (the page it opens may look broken, that's fine), then come back and sign in.");
  }

  const ok = email.includes("@") && password.length >= 8;
  return (
    <div className="center">
      <div className="card narrow">
        <h1 className="brand">Jarvis</h1>
        <p className="muted">Sign in once on each device. Your data stays locked to your account.</p>
        <input type="email" autoComplete="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input type="password" autoComplete="current-password" placeholder="Password (8+ characters)" value={password}
          onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && ok && signIn()} />
        <button className="primary" disabled={!ok || busy} onClick={signIn}>Sign in</button>
        <button disabled={!ok || busy} onClick={create}>First time? Create account</button>
        {msg && <p className="small">{msg}</p>}
        {err && <p className="error small">{err}</p>}
      </div>
    </div>
  );
}
