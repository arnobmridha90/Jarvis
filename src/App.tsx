import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { isConfigured, supabase } from "./lib/supabase";
import type { Settings as S } from "./lib/types";
import { autoUpdateOnLaunch, UpdateState } from "./lib/updates";
import SignIn from "./screens/SignIn";
import Home from "./screens/Home";
import Knows from "./screens/Knows";
import Settings from "./screens/Settings";
import { Places, Reminders } from "./screens/Lists";
import Projects from "./screens/Projects";
import "./styles.css";

const TABS = [["home", "Home"], ["projects", "Projects"], ["knows", "Knows"], ["reminders", "Reminders"], ["places", "Places"], ["settings", "Settings"]] as const;
type Tab = (typeof TABS)[number][0];

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<Tab>("home");
  const [settings, setSettings] = useState<S | null>(null);
  const [update, setUpdate] = useState<UpdateState | null>(null);
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    autoUpdateOnLaunch(setUpdate);
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    const load = async () => {
      const { data } = await supabase.from("settings").select("*").maybeSingle();
      setSettings(data as S | null);
      setLocked(!data); // signed in, but not the owner: RLS returns nothing
    };
    load();
    const ch = supabase.channel("live-settings")
      .on("postgres_changes", { event: "*", schema: "public", table: "settings" }, load).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [session]);

  if (!isConfigured) return <div className="center"><div className="card narrow"><h1 className="brand">Jarvis</h1><p>This build has no database settings. Rebuild with VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.</p></div></div>;
  if (!ready) return null;
  if (!session) return <SignIn />;
  if (locked) return <div className="center"><div className="card narrow"><h1 className="brand">Jarvis</h1><p>This Jarvis belongs to someone else.</p><button onClick={() => supabase.auth.signOut()}>Sign out</button></div></div>;

  return (
    <div className="app">
      <header>
        <span className="brand">Jarvis</span>
        <nav>{TABS.map(([k, label]) => <button key={k} className={tab === k ? "active" : ""} onClick={() => setTab(k)}>{label}</button>)}</nav>
      </header>
      {update?.kind === "available" && (
        <div className="banner">Jarvis {update.version} is ready. <button className="primary" onClick={update.install}>Update</button></div>
      )}
      <main>
        {tab === "home" && <Home voiceEnabled={!!settings?.voice_enabled} />}
        {tab === "projects" && <Projects dispatchMinutes={settings?.dispatch_minutes ?? 15} />}
        {tab === "knows" && <Knows />}
        {tab === "reminders" && <Reminders />}
        {tab === "places" && <Places />}
        {tab === "settings" && <Settings settings={settings} />}
      </main>
    </div>
  );
}
