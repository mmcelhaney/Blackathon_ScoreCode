"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function JudgeSignIn({ unauthorized }: { unauthorized?: boolean }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "err">(
    "idle",
  );
  const [errMsg, setErrMsg] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setErrMsg("");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/judge/dashboard`,
        shouldCreateUser: false,
      },
    });
    if (error) {
      setStatus("err");
      setErrMsg(
        error.message === "Signups not allowed for otp"
          ? "That email isn't on the judges roster. Check with the organizers."
          : error.message,
      );
    } else {
      setStatus("sent");
    }
  }

  if (status === "sent") {
    return (
      <div className="card animate-fade-up text-center">
        <div className="pill-gold mb-3">Check Your Inbox</div>
        <h2 className="hex-title text-3xl">Link Sent</h2>
        <p className="mt-3 text-dust">
          Click the magic link we emailed to <span className="text-gold">{email}</span>.
          It'll drop you right into your scoring dashboard.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="card space-y-4">
      {unauthorized && (
        <div className="rounded-md border border-blood/60 bg-blood/10 px-4 py-3 text-sm text-blood">
          You're signed in but not on the judges roster. Contact the organizers or
          use a different email.
        </div>
      )}
      <div>
        <label className="field-label">Email Address</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="field-input mt-1"
          placeholder="you@example.com"
        />
      </div>
      {status === "err" && (
        <div className="rounded-md border border-blood/60 bg-blood/10 px-4 py-3 text-sm text-blood">
          {errMsg}
        </div>
      )}
      <button className="btn-gold w-full" disabled={status === "sending"}>
        {status === "sending" ? "Sending…" : "✉ Send Magic Link"}
      </button>
    </form>
  );
}
