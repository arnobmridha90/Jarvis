import { useState } from "react";
import { supabase } from "../lib/supabase";

export default function SignIn() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function send() {
    setBusy(true); setMsg(null);
    const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
    setBusy(false);
    if (error) setMsg(error.message); else setSent(true);
  }
  async function verify() {
    setBusy(true); setMsg(null);
    const { error } = await supabase.auth.verifyOtp({ email, token: code.trim(), type: "email" });
    setBusy(false);
    if (error) setMsg(error.message);
  }

  return (
    <div className="center">
      <div className="card narrow">
        <h1 className="brand">Jarvis</h1>
        <p className="muted">Sign in once on each device. Your data stays locked to your account.</p>
        {!sent ? (
          <>
            <input type="email" placeholder="Your email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <button className="primary" disabled={!email || busy} onClick={send}>Email me a code</button>
          </>
        ) : (
          <>
            <input inputMode="numeric" placeholder="6-digit code" value={code} onChange={(e) => setCode(e.target.value)} />
            <button className="primary" disabled={code.trim().length < 6 || busy} onClick={verify}>Sign in</button>
            <button className="link" onClick={() => setSent(false)}>Use a different email</button>
          </>
        )}
        {msg && <p className="error">{msg}</p>}
      </div>
    </div>
  );
}
