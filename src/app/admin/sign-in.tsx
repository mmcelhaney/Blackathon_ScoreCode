"use client";

import { useActionState } from "react";
import { signInAdmin } from "./actions";

export function AdminSignIn() {
  const [state, action, pending] = useActionState(signInAdmin, null);
  return (
    <form action={action} className="card space-y-4">
      <div>
        <label className="field-label">Admin Password</label>
        <input
          type="password"
          name="password"
          required
          className="field-input mt-1"
          autoFocus
        />
      </div>
      {state && "error" in state && state.error && (
        <div className="rounded-md border border-blood/60 bg-blood/10 px-3 py-2 text-xs text-blood">
          {state.error}
        </div>
      )}
      <button className="btn-gold w-full" disabled={pending}>
        {pending ? "Signing in…" : "🔓 Unlock Admin"}
      </button>
    </form>
  );
}
