// Shared pieces for the commissioner's pages: the sign-in gate and small form helpers
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { field, msg, primary, quiet, useAction, useIsCommissioner } from "@/hooks/use-commissioner";
import { prepareCommissionerLogin } from "@/lib/admin.functions";

// A button that needs a second tap within a few seconds
export function ConfirmButton({
  label,
  confirmLabel,
  onConfirm,
  disabled,
  className = quiet,
}: {
  label: string;
  confirmLabel: string;
  onConfirm: () => void;
  disabled?: boolean;
  className?: string;
}) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => {
        if (!armed) return setArmed(true);
        setArmed(false);
        onConfirm();
      }}
      className={
        armed
          ? "rounded bg-red px-4 py-2 text-lg font-bold uppercase tracking-wide text-white"
          : className
      }
    >
      {armed ? confirmLabel : label}
    </button>
  );
}

export const Err = ({ error }: { error: string | null }) =>
  error ? (
    <p role="alert" className="mt-2 font-semibold text-red">
      {error}
    </p>
  ) : null;

// Renders children only for the signed-in commissioner; otherwise the sign-in form
export function CommissionerGate({
  children,
}: {
  children: (me: { email: string | null; signOut: () => void }) => ReactNode;
}) {
  const { session, me } = useIsCommissioner();
  const signOut = () => {
    supabase.auth.signOut();
  };
  if (session === undefined || (session && me.isPending))
    return <p className="text-lg text-muted-foreground">Checking sign-in…</p>;
  if (!session) return <SignIn />;
  if (me.error)
    return (
      <>
        <p className="text-lg">Couldn't check your account: {msg(me.error)}</p>
        <button onClick={signOut} className={`${quiet} mt-4`}>
          Sign out
        </button>
      </>
    );
  if (!me.data?.isAdmin)
    return (
      <>
        <p className="text-lg">
          {me.data?.email ?? "This account"} isn't the commissioner's account.
        </p>
        <button onClick={signOut} className={`${quiet} mt-4`}>
          Sign out
        </button>
      </>
    );
  return <>{children({ email: me.data.email, signOut })}</>;
}

function SignIn() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const { busy, error, run } = useAction();
  const send = (e: FormEvent) => {
    e.preventDefault();
    run(async () => {
      const { ok } = await prepareCommissionerLogin({ data: { email } });
      if (ok) {
        const { error } = await supabase.auth.signInWithOtp({
          email: email.trim(),
          // Back to this page after the link is opened
          options: {
            shouldCreateUser: false,
            emailRedirectTo: location.origin + location.pathname,
          },
        });
        if (error) throw error;
      }
      // Same answer either way, so the page doesn't reveal the commissioner's email
      setSent(true);
    });
  };
  if (sent)
    return (
      <div className="rounded-md border bg-card px-4 py-4 text-lg">
        <p className="font-semibold">Check your email.</p>
        <p className="mt-1 text-muted-foreground">
          If that's the commissioner's address, a sign-in link is on its way. Open it on this
          device. Nothing after a few minutes? Check the spelling and{" "}
          <button className="underline" onClick={() => setSent(false)}>
            try again
          </button>
          .
        </p>
      </div>
    );
  return (
    <form onSubmit={send} className="max-w-md">
      <p className="mb-4 text-lg text-muted-foreground">
        Only the commissioner can sign in. Enter your email and we'll send you a sign-in link.
      </p>
      <label className="mb-1 block font-semibold" htmlFor="email">
        Email
      </label>
      <input
        id="email"
        type="email"
        required
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className={`${field} w-full`}
      />
      <button type="submit" disabled={busy} className={`${primary} mt-4`}>
        {busy ? "Sending…" : "Send sign-in link"}
      </button>
      <Err error={error} />
    </form>
  );
}
