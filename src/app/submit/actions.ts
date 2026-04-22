"use server";

import { submissionSchema } from "@/lib/submission-schema";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type SubmitResult =
  | { ok: true; id: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export async function submitProject(
  _prev: SubmitResult | null,
  form: FormData,
): Promise<SubmitResult> {
  // Phase gate
  const supa = await createClient();
  const { data: state } = await supa
    .from("event_state")
    .select("phase")
    .eq("id", 1)
    .maybeSingle();
  if (state?.phase !== "submissions") {
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
  const admin = createAdminClient();
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
