"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Papa from "papaparse";
import {
  checkAdminPassword,
  clearAdminCookie,
  isAdminSignedIn,
  issueAdminCookie,
} from "./auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  drawBubble,
  monteCarloTop,
  type ScoreRow,
  type SubmissionMeta,
} from "@/lib/monte-carlo";

// ── sign in / out ────────────────────────────────────────────────
export async function signInAdmin(_: unknown, form: FormData) {
  const pw = String(form.get("password") ?? "");
  if (!checkAdminPassword(pw)) {
    return { ok: false as const, error: "Wrong password." };
  }
  await issueAdminCookie();
  redirect("/admin");
}

export async function signOutAdmin() {
  await clearAdminCookie();
  redirect("/");
}

// ── phase toggle ─────────────────────────────────────────────────
export async function setPhase(
  phase: "submissions" | "judging" | "results",
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(await isAdminSignedIn())) {
    return { ok: false, error: "Admin session expired — please sign in again." };
  }
  const admin = createAdminClient();
  const { error } = await admin
    .from("event_state")
    .update({
      phase,
      closed_at: phase === "results" ? new Date().toISOString() : null,
    })
    .eq("id", 1);
  if (error) {
    console.error("setPhase: update failed", error);
    return { ok: false, error: `DB error: ${error.message}` };
  }
  revalidatePath("/", "layout");
  revalidatePath("/admin");
  return { ok: true };
}

// ── judge / mentor roster ────────────────────────────────────────
export async function addJudge(_: unknown, form: FormData) {
  if (!(await isAdminSignedIn())) throw new Error("Not authorized");
  const name = String(form.get("name") ?? "").trim();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const roleRaw = String(form.get("role") ?? "judge").trim().toLowerCase();
  const role = roleRaw === "mentor" ? "mentor" : "judge";
  if (!name || !email) return { ok: false as const, error: "Name and email required" };

  const admin = createAdminClient();

  // Create auth user (passwordless — magic links only)
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
  });
  let authUserId = created?.user?.id;
  if (createErr && !authUserId) {
    // Maybe already exists — look them up
    const { data: found } = await admin.auth.admin.listUsers();
    authUserId = found?.users.find((u) => u.email?.toLowerCase() === email)?.id;
    if (!authUserId)
      return { ok: false as const, error: `Couldn't create ${role}: ${createErr.message}` };
  }

  const { error } = await admin.from("judges").upsert(
    {
      auth_user_id: authUserId!,
      name,
      email,
      role,
      is_active: true,
    },
    { onConflict: "email" },
  );
  if (error) {
    // Likely cause: 0002_mentors migration not applied yet, so `role` column
    // doesn't exist. Fall back to inserting without `role` — but only if
    // we're trying to add a regular judge. Mentors require the migration.
    const isMissingColumn = /column .*role.* does not exist/i.test(error.message);
    if (isMissingColumn && role === "judge") {
      const retry = await admin.from("judges").upsert(
        {
          auth_user_id: authUserId!,
          name,
          email,
          is_active: true,
        },
        { onConflict: "email" },
      );
      if (retry.error) return { ok: false as const, error: retry.error.message };
      revalidatePath("/admin");
      return { ok: true as const };
    }
    if (isMissingColumn && role === "mentor") {
      return {
        ok: false as const,
        error:
          "Mentors require the 0002_mentors migration. Run supabase/migrations/0002_mentors.sql in the Supabase SQL Editor first.",
      };
    }
    return { ok: false as const, error: error.message };
  }
  revalidatePath("/admin");
  return { ok: true as const };
}

export async function removeJudge(judgeId: string) {
  if (!(await isAdminSignedIn())) throw new Error("Not authorized");
  const admin = createAdminClient();
  await admin.from("judges").update({ is_active: false }).eq("id", judgeId);
  revalidatePath("/admin");
}

// ── shared password for all judges (bypasses email rate limits) ──
export async function setSharedJudgePassword(
  _: unknown,
  form: FormData,
): Promise<
  | { ok: true; updated: number; failed: number }
  | { ok: false; error: string }
> {
  if (!(await isAdminSignedIn())) throw new Error("Not authorized");
  const password = String(form.get("password") ?? "").trim();
  if (password.length < 6) {
    return { ok: false, error: "Password must be at least 6 characters" };
  }
  const admin = createAdminClient();
  const { data: judges, error } = await admin
    .from("judges")
    .select("auth_user_id")
    .eq("is_active", true);
  if (error) return { ok: false, error: error.message };

  let updated = 0;
  let failed = 0;
  for (const j of judges ?? []) {
    if (!j.auth_user_id) {
      failed++;
      continue;
    }
    const { error: updErr } = await admin.auth.admin.updateUserById(
      j.auth_user_id,
      { password },
    );
    if (updErr) failed++;
    else updated++;
  }
  revalidatePath("/admin");
  return { ok: true, updated, failed };
}

// ── one-off test account with a known password ──────────────────

// Paginated lookup — auth.admin.listUsers only returns 50/page, so a single
// call misses users on later pages.
async function findAuthUserIdByEmail(
  admin: ReturnType<typeof createAdminClient>,
  email: string,
): Promise<string | null> {
  const target = email.toLowerCase();
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error || !data) return null;
    const hit = data.users.find((u) => u.email?.toLowerCase() === target);
    if (hit) return hit.id;
    if (data.users.length < 200) return null; // last page
  }
  return null;
}

export async function createTestJudge(
  _: unknown,
  form: FormData,
): Promise<{ ok: true; email: string } | { ok: false; error: string }> {
  if (!(await isAdminSignedIn())) throw new Error("Not authorized");
  const name = String(form.get("name") ?? "").trim() || "Test Judge";
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "").trim();
  const roleRaw = String(form.get("role") ?? "judge").trim().toLowerCase();
  const role = roleRaw === "mentor" ? "mentor" : "judge";

  if (!email) return { ok: false, error: "Email required" };
  if (password.length < 6)
    return { ok: false, error: "Password must be at least 6 characters" };

  const admin = createAdminClient();

  // Two-step: ensure auth user exists, then explicitly set password +
  // email_confirm via updateUserById. More reliable than passing the password
  // to createUser (which can silently no-op in some edge cases).
  let authUserId = await findAuthUserIdByEmail(admin, email);
  if (!authUserId) {
    const { data: created, error: createErr } =
      await admin.auth.admin.createUser({
        email,
        email_confirm: true,
      });
    if (createErr || !created?.user?.id) {
      // Race: maybe it was created concurrently — retry lookup
      const retryId = await findAuthUserIdByEmail(admin, email);
      if (!retryId) {
        console.error("createTestJudge: createUser failed", createErr);
        return {
          ok: false,
          error: `Couldn't create auth user: ${createErr?.message ?? "unknown"}`,
        };
      }
      authUserId = retryId;
    } else {
      authUserId = created.user.id;
    }
  }

  const { error: pwdErr } = await admin.auth.admin.updateUserById(authUserId, {
    password,
    email_confirm: true,
  });
  if (pwdErr) {
    console.error("createTestJudge: updateUserById failed", pwdErr);
    return { ok: false, error: `Couldn't set password: ${pwdErr.message}` };
  }

  // Upsert into judges table (try with role; fall back if column missing)
  const { error } = await admin.from("judges").upsert(
    { auth_user_id: authUserId, name, email, role, is_active: true },
    { onConflict: "email" },
  );
  if (error) {
    if (/column .*role.* does not exist/i.test(error.message) && role === "judge") {
      const retry = await admin.from("judges").upsert(
        { auth_user_id: authUserId, name, email, is_active: true },
        { onConflict: "email" },
      );
      if (retry.error) return { ok: false, error: retry.error.message };
    } else {
      return { ok: false, error: error.message };
    }
  }
  revalidatePath("/admin");
  return { ok: true, email };
}

// ── CSV import ───────────────────────────────────────────────────
const TRACKS = new Set([
  "AI for Coding",
  "Technology Solutions",
  "Both",
  "Other",
]);

type CsvRow = Record<string, string>;

export async function importCsv(_: unknown, form: FormData): Promise<
  | { ok: true; inserted: number; skipped: number; flagged: number }
  | { ok: false; error: string }
> {
  if (!(await isAdminSignedIn())) throw new Error("Not authorized");
  const file = form.get("file") as File | null;
  if (!file) return { ok: false, error: "No file uploaded" };
  const text = await file.text();
  // Strip BOM
  const cleaned = text.replace(/^﻿/, "");
  const parsed = Papa.parse<CsvRow>(cleaned, {
    header: true,
    skipEmptyLines: true,
  });

  const admin = createAdminClient();
  let inserted = 0;
  let skipped = 0;
  let flagged = 0;

  for (const raw of parsed.data) {
    const project_name = (raw["Project Name"] ?? "").trim();
    if (!project_name) {
      skipped++;
      continue;
    }

    // Defensive fix for misaligned Airtable rows
    let challenge_track = (raw["Challenge Track"] ?? "").trim();
    let team_name = (raw["Team Name"] ?? "").trim();
    let member2_name = (raw["Member 2 Name"] ?? "").trim();
    let needs_review = false;
    if (!challenge_track && TRACKS.has(team_name)) {
      challenge_track = team_name;
      team_name = "";
      needs_review = true;
    }
    if (member2_name === "Technology Solutions") {
      member2_name = "";
      needs_review = true;
    }

    const solo_or_team = (raw["Solo or Team"] ?? "").trim() as "Solo" | "Team" | "";
    const is_complete_str = (raw["Is Submission Complete?"] ?? "").trim();
    const is_submission_complete = is_complete_str === "1";

    const row = {
      project_name,
      team_name: team_name || null,
      solo_or_team: solo_or_team || null,
      challenge_track: challenge_track || null,
      project_category: (raw["Project Category"] ?? "").trim() || null,
      project_description: (raw["Project Description"] ?? "").trim() || null,
      project_description_summary:
        (raw["Project Description Summary"] ?? "").trim() || null,
      technologies_used: (raw["Technologies Used"] ?? "").trim() || null,
      team_size: Number.parseInt(raw["Team Size"] ?? "") || 1,
      github_url: (raw["GitHub URL"] ?? "").trim() || null,
      live_demo_url: (raw["Live Demo URL"] ?? "").trim() || null,
      demo_video_url: (raw["Demo Video URL"] ?? "").trim() || null,
      linkedin_post_url: (raw["LinkedIn Post URL"] ?? "").trim() || null,
      member1_name: (raw["Full Legal Name"] ?? "").trim() || null,
      member1_email: (raw["Email Address"] ?? "").trim() || null,
      member2_name: member2_name || null,
      member2_email: (raw["Member 2 Email"] ?? "").trim() || null,
      member3_name: (raw["Member 3 Name"] ?? "").trim() || null,
      member3_email: (raw["Member 3 Email"] ?? "").trim() || null,
      member4_name: (raw["Member 4 Name"] ?? "").trim() || null,
      member4_email: (raw["Member 4 Email"] ?? "").trim() || null,
      submitter_linkedin_url: (raw["LinkedIn Profile URL"] ?? "").trim() || null,
      affiliated_org: (raw["Affiliated Org"] ?? "").trim() || null,
      submitter_role: (raw["Role"] ?? "").trim() || null,
      all_members_in_video: (raw["All Members in Video"] ?? "").trim() || null,
      participants: (raw["Participants"] ?? "").trim() || null,
      is_submission_complete,
      needs_review,
    };

    const { error } = await admin
      .from("submissions")
      .upsert(row, { onConflict: "project_name" });
    if (error) {
      skipped++;
      continue;
    }
    inserted++;
    if (needs_review) flagged++;
  }

  revalidatePath("/admin");
  return { ok: true, inserted, skipped, flagged };
}

export async function toggleHideSubmission(id: string, hidden: boolean) {
  if (!(await isAdminSignedIn())) throw new Error("Not authorized");
  const admin = createAdminClient();
  await admin
    .from("submissions")
    .update({ hidden_from_judges: hidden })
    .eq("id", id);
  revalidatePath("/admin");
}

// ── top-6 compute + lock ─────────────────────────────────────────
export async function computeAndLockTop6(formData: FormData) {
  if (!(await isAdminSignedIn())) throw new Error("Not authorized");
  const admin = createAdminClient();

  const seedInput = formData.get("seed");
  const seed =
    seedInput && String(seedInput).length > 0
      ? Number.parseInt(String(seedInput), 10)
      : Date.now();

  const { data: scores } = await admin
    .from("scores")
    .select("judge_id, submission_id, idea, creativity, build_quality, ux, presentation, impact");
  const { data: subs } = await admin
    .from("submissions")
    .select("id, project_name")
    .eq("hidden_from_judges", false)
    .eq("is_submission_complete", true);

  if (!scores || !subs) throw new Error("Couldn't load scores/submissions");

  const mc = monteCarloTop(scores as ScoreRow[], subs as SubmissionMeta[], {
    seed,
    trials: 1000,
    topN: 6,
  });

  const slotsLeft = 6 - mc.autoLocked.length;
  const drawn = drawBubble(mc.bubble, mc.rankings, slotsLeft, seed);

  const chosen = [...mc.autoLocked, ...drawn].slice(0, 6);
  const top6 = chosen.map((sid, i) => {
    const r = mc.rankings.find((r) => r.submission_id === sid);
    return {
      submission_id: sid,
      rank: i + 1,
      probability: r?.p_top_n ?? 0,
    };
  });

  await admin.from("results_lock").upsert(
    { id: 1, seed, top6 },
    { onConflict: "id" },
  );
  await admin
    .from("event_state")
    .update({ phase: "results", closed_at: new Date().toISOString() })
    .eq("id", 1);

  revalidatePath("/admin");
  revalidatePath("/results", "layout");
  revalidatePath("/", "layout");
}

export async function recordTieBreak(
  winnerId: string,
  loserId: string,
  reason: string,
  decidedBy: string,
) {
  if (!(await isAdminSignedIn())) throw new Error("Not authorized");
  const admin = createAdminClient();
  await admin.from("tie_breaks").insert({
    winning_submission_id: winnerId,
    losing_submission_id: loserId,
    reason,
    decided_by: decidedBy,
  });
  revalidatePath("/admin");
}
