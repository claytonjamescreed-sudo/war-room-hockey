// Commissioner sign-in state and small helpers shared by the commissioner's pages
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { whoami } from "@/lib/admin.functions";

export const msg = (e: unknown) =>
  e instanceof Error
    ? e.message
    : e && typeof e === "object" && "message" in e
      ? String(e.message)
      : String(e);
export const field = "rounded border bg-card px-3 py-2 text-lg";
export const primary =
  "rounded bg-primary px-4 py-2 text-lg font-bold uppercase tracking-wide text-primary-foreground disabled:opacity-50";
export const quiet =
  "rounded border px-4 py-2 text-lg font-semibold hover:bg-muted disabled:opacity-50";

export function useSession() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data }) => alive && setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, []);
  return session;
}

// Whether this browser is signed in as the commissioner (false while unknown or signed out)
export function useIsCommissioner() {
  const session = useSession();
  const me = useQuery({
    queryKey: ["whoami", session?.user.id],
    enabled: !!session,
    queryFn: async () => {
      // Grants the admin role on first sign-in if this is the commissioner's email
      await supabase.rpc("claim_admin");
      return whoami();
    },
    staleTime: 5 * 60_000,
  });
  return { session, me, isAdmin: !!session && !!me.data?.isAdmin };
}

// busy / error state around one async action
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      return true;
    } catch (e) {
      setError(msg(e));
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, run };
}
