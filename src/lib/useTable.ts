import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabase";

type Opts = { order?: string; ascending?: boolean; limit?: number; filter?: [string, string, unknown] };

/** Loads a table and keeps it live: any change on another device shows up here within a second. */
export function useTable<T extends { id?: string }>(table: string, opts: Opts = {}) {
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const key = JSON.stringify(opts);

  const load = useCallback(async () => {
    let q = supabase.from(table).select("*");
    if (opts.filter) q = q.filter(opts.filter[0], opts.filter[1], opts.filter[2] as string);
    if (opts.order) q = q.order(opts.order, { ascending: opts.ascending ?? false });
    if (opts.limit) q = q.limit(opts.limit);
    const { data, error } = await q;
    if (error) setError(error.message);
    else { setRows((data ?? []) as T[]); setError(null); }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, key]);

  useEffect(() => {
    load();
    const ch = supabase
      .channel(`live-${table}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table }, () => load())
      .subscribe();
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => { supabase.removeChannel(ch); window.removeEventListener("focus", onFocus); };
  }, [load, table]);

  return { rows, loading, error, reload: load };
}
