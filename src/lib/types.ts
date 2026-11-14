export type Settings = {
  user_id: string;
  timezone: string;
  briefing_times: string[];
  briefings_paused: boolean;
  quiet_days: number[];
  suggestions_per_day: number;
  sources: Record<string, boolean>;
  voice_enabled: boolean;
  learning_paused: boolean;
  dispatch_minutes: number;
  updated_at: string;
};
export type Memory = {
  id: string; fact: string; category: string; source: string; source_ref: string | null;
  confidence: number; pinned: boolean; times_seen: number; created_at: string; updated_at: string;
};
export type Suggestion = {
  id: string; title: string; body: string | null; why: string | null; kind: string;
  status: "new" | "done" | "dismissed"; feedback: -1 | 0 | 1; created_at: string;
};
export type Briefing = { id: string; slot: string; content: string; created_at: string };
export type Reminder = { id: string; text: string; due_at: string | null; done: boolean; created_at: string };
export type Restaurant = {
  id: string; name: string; area: string | null; cuisine: string | null; notes: string | null;
  visited: boolean; created_at: string;
};
export type Project = {
  id: string; name: string; channel_id: string | null; coordinator_session: string | null;
  status_summary: string | null; needs_you: string | null; checked_at: string | null; archived: boolean;
};
export type Command = {
  id: string; project_id: string | null; text: string; via: string;
  status: "pending" | "sent" | "done" | "failed" | "cancelled";
  reply: string | null; sent_at: string | null; created_at: string;
};
