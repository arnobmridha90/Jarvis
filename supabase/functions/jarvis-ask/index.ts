// Live "Ask Jarvis" for voice and typed commands.
// Answers 501 until the ANTHROPIC_API_KEY secret is set on the Supabase project;
// the app then saves the request to the inbox instead.
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const MODEL = Deno.env.get("JARVIS_MODEL") ?? "claude-sonnet-5-5";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) return Response.json({ error: "voice_not_configured" }, { status: 501, headers: cors });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data: owner } = await supabase.rpc("is_owner");
  if (!owner) return Response.json({ error: "forbidden" }, { status: 403, headers: cors });

  const { text } = await req.json();
  const [{ data: mem }, { data: rem }, { data: settings }] = await Promise.all([
    supabase.from("memories").select("fact,category").order("pinned", { ascending: false }).order("updated_at", { ascending: false }).limit(200),
    supabase.from("reminders").select("text,due_at").eq("done", false).limit(50),
    supabase.from("settings").select("timezone").maybeSingle(),
  ]);

  const system = [
    "You are Jarvis, Arnob's personal assistant. Be brief, warm and direct; answers may be spoken aloud.",
    `Arnob's time zone: ${settings?.timezone ?? "Asia/Singapore"}. Now: ${new Date().toISOString()}.`,
    "What you know about Arnob:", ...(mem ?? []).map((m) => `- (${m.category}) ${m.fact}`),
    "Open reminders:", ...(rem ?? []).map((r) => `- ${r.text}${r.due_at ? ` (due ${r.due_at})` : ""}`),
    'If Arnob asks you to remember something or set a reminder, end your reply with a JSON line: {"remember":"…"} or {"remind":"…","due_at":"ISO"}.',
  ].join("\n");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: MODEL, max_tokens: 600, system, messages: [{ role: "user", content: text }] }),
  });
  if (!res.ok) return Response.json({ error: await res.text() }, { status: 502, headers: cors });
  const out = await res.json();
  let answer: string = out.content?.map((c: { text?: string }) => c.text ?? "").join("") ?? "";

  const last = answer.trim().split("\n").pop() ?? "";
  try {
    const action = JSON.parse(last);
    if (action.remember) await supabase.from("memories").insert({ fact: action.remember, source: "voice", confidence: 1 });
    if (action.remind) await supabase.from("reminders").insert({ text: action.remind, due_at: action.due_at ?? null });
    answer = answer.trim().split("\n").slice(0, -1).join("\n");
  } catch { /* no action line */ }

  await supabase.from("inbox").insert({ text, via: "voice", processed_at: new Date().toISOString() });
  return Response.json({ answer }, { headers: cors });
});
