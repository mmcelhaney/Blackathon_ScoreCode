"use server";

import { submissionSchema } from "@/lib/submission-schema";
import { createAdminClient } from "@/lib/supabase/admin";

export type SubmitResult =
  | { ok: true; id: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export async function submitProject(
  _prev: SubmitResult | null,
  form: FormData,
): Promise<SubmitResult> {
  // Phase gate — use the service-role client so this can't drift from what
  // the admin panel sees due to RLS or auth-context quirks. Match the admin
  // panel's fallback: a missing/null phase defaults to "submissions" (which
  // is also the table-level default).
  const admin = createAdminClient();
  const { data: state, error: stateError } = await admin
    .from("event_state")
    .select("phase")
    .eq("id", 1)
    .maybeSingle();
  if (stateError) {
    console.error("submitProject: failed to read event_state", stateError);
  }
  const rawPhase = (state?.phase ?? "").toString().trim().toLowerCase();
  const phase = rawPhase || "submissions";
  if (phase !== "submissions") {
    return {
      ok: false,
      error: "Submissions are closed. Contact the organizers if you believe this is a mistake.",
    };
  }

  const raw = Object.fromEntries(form.entries());
  const parsed = submissionSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the errors below.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }
  const input = parsed.data;

  // Service-role insert — bypasses the public-insert RLS policy (which
  // would also work, but we want consistent inserts and controlled columns).
  const { data, error } = await admin
    .from("submissions")
    .insert({
      ...input,
      is_submission_complete: true,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return {
        ok: false,
        error:
          "A project with that name has already been submitted. One submission per team — if you meant to edit yours, check your email for the edit link.",
      };
    }
    return { ok: false, error: error.message };
  }

  return { ok: true, id: data.id };
}
