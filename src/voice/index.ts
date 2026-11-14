/**
 * Voice slot. Live voice commands need an AI model to understand and act on what was said,
 * which needs an Anthropic API key (Arnob hasn't decided yet).
 *
 * To switch it on later:
 *  1. Set the ANTHROPIC_API_KEY secret on the Supabase project.
 *  2. Deploy supabase/functions/jarvis-ask (already written; it answers 501 until the key exists).
 *  3. Turn on "Voice" in Settings. The mic button then records, transcribes and sends to jarvis-ask.
 *
 * Until then the mic button saves what you say into the inbox for the nightly learning run.
 */
import { supabase } from "../lib/supabase";

type SR = { start(): void; stop(): void; lang: string; interimResults: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null; onend: (() => void) | null };

export function speechSupported(): boolean {
  const w = window as unknown as Record<string, unknown>;
  return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
}

export function listen(onText: (t: string) => void, onError: (m: string) => void): () => void {
  const w = window as unknown as Record<string, new () => SR>;
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
  if (!Ctor) { onError("Speech recognition isn't available on this device yet."); return () => {}; }
  const r = new Ctor();
  r.lang = "en-SG";
  r.interimResults = false;
  r.onresult = (e) => onText(Array.from(e.results).map((x) => x[0].transcript).join(" "));
  r.onerror = (e) => onError(e.error);
  r.start();
  return () => r.stop();
}

export async function ask(text: string): Promise<{ answer?: string; queued?: boolean }> {
  const { data, error } = await supabase.functions.invoke("jarvis-ask", { body: { text } });
  if (!error && data?.answer) return { answer: data.answer as string };
  // No key yet (501) or offline: keep it for the nightly run instead of losing it.
  await supabase.from("inbox").insert({ text, via: "voice" });
  return { queued: true };
}

export function speak(text: string) {
  if ("speechSynthesis" in window) window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
}
