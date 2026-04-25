"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  addJudge,
  computeAndLockTop6,
  createTestJudge,
  importCsv,
  removeJudge,
  setPhase,
  setSharedJudgePassword,
  signOutAdmin,
  toggleHideSubmission,
} from "./actions";

type Phase = "submissions" | "judging" | "results";

type Judge = {
  id: string;
  name: string;
  email: string;
  is_active: boolean;
  role: "judge" | "mentor" | null;
  created_at: string;
};

type Submission = {
  id: string;
  project_name: string;
  team_name: string | null;
  solo_or_team: string | null;
  challenge_track: string | null;
  is_submission_complete: boolean | null;
  needs_review: boolean | null;
  hidden_from_judges: boolean | null;
  created_at: string;
};

type Progress = {
  submission_id: string;
  project_name: string;
  votes: number;
};

type JudgeProgress = {
  id: string;
  name: string;
  email: string;
  is_active: boolean;
  scored: number;
  total: number;
  last_scored_at: string | null;
};

type Lock = {
  seed: number;
  top6: { submission_id: string; rank: number; probability: number }[];
  locked_at: string;
};

export function AdminHome({
  phase,
  judges,
  submissions,
  progress,
  judgeProgress,
  lock,
}: {
  phase: Phase;
  judges: Judge[];
  submissions: Submission[];
  progress: Progress[];
  judgeProgress: JudgeProgress[];
  lock: Lock | null;
}) {
  const [tab, setTab] = useState<"phase" | "judges" | "submissions" | "results">("phase");

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="pill-gold">Admin</div>
          <h1 className="hex-title mt-2 text-4xl">Control Center</h1>
        </div>
        <form action={signOutAdmin}>
          <button className="pill hover:border-blood hover:text-blood">Sign Out</button>
        </form>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {(["phase", "judges", "submissions", "results"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-md border px-4 py-2 font-cond text-sm uppercase tracking-wider transition ${
              tab === t
                ? "border-gold bg-gold/10 text-gold"
                : "border-line bg-ink-4 text-dust hover:border-gold/60"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "phase" && (
        <PhasePanel
          phase={phase}
          judges={judges}
          submissions={submissions}
          progress={progress}
          judgeProgress={judgeProgress}
        />
      )}
      {tab === "judges" && <JudgesPanel judges={judges} />}
      {tab === "submissions" && <SubmissionsPanel submissions={submissions} />}
      {tab === "results" && <ResultsPanel phase={phase} submissions={submissions} lock={lock} />}
    </div>
  );
}

function PhasePanel({
  phase,
  judges,
  submissions,
  progress,
  judgeProgress,
}: {
  phase: Phase;
  judges: Judge[];
  submissions: Submission[];
  progress: Progress[];
  judgeProgress: JudgeProgress[];
}) {
  const [pending, start] = useTransition();
  const activeJudges = judges.filter(
    (j) => j.is_active && (j.role ?? "judge") === "judge",
  ).length;
  const activeMentors = judges.filter(
    (j) => j.is_active && j.role === "mentor",
  ).length;
  const visibleSubs = submissions.filter(
    (s) => !s.hidden_from_judges && s.is_submission_complete,
  );

  // Per-judge truth is the source for the progress bar — it only counts scores
  // on currently-visible submissions and clamps overages so the bar never goes >100%.
  const activeJudgeProgress = judgeProgress.filter((j) => j.is_active);
  const cast = activeJudgeProgress.reduce(
    (t, j) => t + Math.min(j.scored, j.total),
    0,
  );
  const totalPossibleVotes = activeJudgeProgress.reduce(
    (t, j) => t + j.total,
    0,
  );
  const pct =
    totalPossibleVotes > 0
      ? Math.round((cast / totalPossibleVotes) * 100)
      : 0;

  const stragglers = activeJudgeProgress.filter(
    (j) => j.scored < j.total,
  ).length;
  void progress;

  const [phaseErr, setPhaseErr] = useState<string | null>(null);

  function handlePhase(p: Phase) {
    setPhaseErr(null);
    start(async () => {
      try {
        const r = await setPhase(p);
        if (!r.ok) {
          setPhaseErr(r.error);
          return;
        }
        if (r.persisted !== p) {
          setPhaseErr(
            `DB returned phase="${r.persisted}" after writing "${p}" (rows affected: ${r.rowsAffected}). Use Supabase SQL editor: UPDATE public.event_state SET phase='${p}' WHERE id=1;`,
          );
          return;
        }
        // Hard reload — guarantees the phase pill updates everywhere even if
        // RSC payload caching gets in the way.
        window.location.reload();
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setPhaseErr(`Couldn't switch phase: ${msg}`);
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="card md:col-span-2">
          <div className="field-label mb-3">Current Phase</div>
          <div className="mb-5 flex gap-2">
            {(["submissions", "judging", "results"] as const).map((p) => (
              <button
                key={p}
                onClick={() => handlePhase(p)}
                disabled={pending || p === phase}
                className={`flex-1 rounded-md border px-3 py-4 font-cond uppercase tracking-wider transition ${
                  phase === p
                    ? "border-gold bg-gold/20 text-gold"
                    : "border-line bg-ink-4 text-dust hover:border-gold/60"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
          {phaseErr && (
            <div className="mb-3 rounded-md border border-blood/60 bg-blood/10 px-3 py-2 text-xs text-blood">
              {phaseErr}
            </div>
          )}
          <p className="text-xs text-dust">
            Changing to <span className="text-gold">judging</span> locks
            submissions. Changing to <span className="text-gold">results</span>{" "}
            reveals aggregated scores; if you haven't computed the top-6 yet,
            do that from the Results tab first.
          </p>
        </div>

        <div className="card">
          <div className="field-label">Voting Progress</div>
          <div className="mt-2 font-display text-5xl text-gold">{pct}%</div>
          <div className="mt-1 text-xs text-dust">
            {cast} / {totalPossibleVotes} votes cast
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full border border-line bg-ink-5">
            <div
              className="h-full bg-gradient-to-r from-blood via-gold to-jade transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
            <Stat label="Judges" v={activeJudges} />
            <Stat label="Mentors" v={activeMentors} />
            <Stat label="Submissions" v={visibleSubs.length} />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="mb-3 flex items-baseline justify-between">
          <div>
            <div className="field-label">Judge Voting Status</div>
            <div className="mt-1 text-[0.7rem] text-dust">
              {stragglers > 0
                ? `${stragglers} judge${stragglers === 1 ? "" : "s"} still need${stragglers === 1 ? "s" : ""} to finish.`
                : "All active judges have completed their scoring."}
            </div>
          </div>
          {activeJudgeProgress.length > 0 && (
            <div className="text-[0.65rem] uppercase tracking-wider text-dust">
              Active: {activeJudgeProgress.length}
            </div>
          )}
        </div>

        {activeJudgeProgress.length === 0 ? (
          <p className="text-sm text-dust">
            No active judges yet. Add some in the Judges tab.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {activeJudgeProgress
              .slice()
              .sort((a, b) => a.scored / (a.total || 1) - b.scored / (b.total || 1))
              .map((j) => {
                const pctJ =
                  j.total > 0 ? Math.round((j.scored / j.total) * 100) : 0;
                const status =
                  j.scored === 0
                    ? "not_started"
                    : j.scored >= j.total
                      ? "done"
                      : "in_progress";
                return (
                  <li
                    key={j.id}
                    className="flex items-center justify-between gap-3 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate font-semibold text-bone">
                          {j.name}
                        </span>
                        {status === "done" && (
                          <span className="pill-gold">✓ Done</span>
                        )}
                        {status === "in_progress" && (
                          <span className="rounded-full border border-gold/40 bg-gold/10 px-3 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-gold">
                            In Progress
                          </span>
                        )}
                        {status === "not_started" && (
                          <span className="rounded-full border border-blood/60 bg-blood/10 px-3 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-blood">
                            Not Started
                          </span>
                        )}
                      </div>
                      <div className="truncate text-[0.7rem] text-dust">
                        {j.email}
                        {j.last_scored_at && (
                          <span className="ml-2">
                            · last vote{" "}
                            {new Date(j.last_scored_at).toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex w-40 flex-col items-end gap-1">
                      <div className="text-xs">
                        <span className="font-display text-lg text-bone">
                          {j.scored}
                        </span>
                        <span className="text-dust"> / {j.total}</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-5">
                        <div
                          className={`h-full transition-all ${
                            status === "done"
                              ? "bg-jade"
                              : status === "not_started"
                                ? "bg-blood"
                                : "bg-gold"
                          }`}
                          style={{ width: `${pctJ}%` }}
                        />
                      </div>
                    </div>
                  </li>
                );
              })}
          </ul>
        )}
      </div>
    </div>
  );
}

function JudgesPanel({ judges }: { judges: Judge[] }) {
  const [state, setState] = useState<{
    ok?: boolean;
    error?: string;
    role?: "judge" | "mentor";
  } | null>(null);
  const [pending, start] = useTransition();

  const [pwdState, setPwdState] = useState<
    | { ok: true; updated: number; failed: number; details: string[] }
    | { ok: false; error: string }
    | null
  >(null);
  const [pwdPending, pwdStart] = useTransition();

  const [testState, setTestState] = useState<
    | { ok: true; email: string }
    | { ok: false; error: string }
    | null
  >(null);
  const [testPending, testStart] = useTransition();

  function onAdd(role: "judge" | "mentor", formId: string) {
    return (fd: FormData) => {
      fd.set("role", role);
      start(async () => {
        const r = await addJudge(null, fd);
        setState({ ...r, role });
        if (r.ok) (document.getElementById(formId) as HTMLFormElement)?.reset();
      });
    };
  }

  function onSetPassword(fd: FormData) {
    pwdStart(async () => {
      const r = await setSharedJudgePassword(null, fd);
      setPwdState(r);
      if (r.ok) {
        (document.getElementById("pwd-form") as HTMLFormElement)?.reset();
      }
    });
  }

  function onCreateTest(fd: FormData) {
    testStart(async () => {
      const r = await createTestJudge(null, fd);
      setTestState(r);
      if (r.ok) {
        (document.getElementById("test-form") as HTMLFormElement)?.reset();
      }
    });
  }

  const justJudges = judges.filter((j) => (j.role ?? "judge") === "judge");
  const mentors = judges.filter((j) => j.role === "mentor");

  return (
    <div className="space-y-6">
      {/* Shared Password — bypass email rate limits */}
      <form
        id="pwd-form"
        action={onSetPassword}
        className="card space-y-3 border-l-4 border-l-gold"
      >
        <div className="flex items-baseline justify-between">
          <div className="pill-gold">Shared Sign-In Password</div>
          <span className="text-[0.65rem] uppercase tracking-wider text-dust">
            Bypasses magic-link emails
          </span>
        </div>
        <p className="text-xs text-dust">
          Sets one password on every <strong className="text-bone">active</strong>{" "}
          judge and mentor. They sign in at <span className="text-gold">/judge</span>{" "}
          with their email + this password — no email is sent. Share the
          password directly with them (Slack/text). You can re-run this any
          time to rotate the password.
        </p>
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex-1 min-w-[220px]">
            <label className="field-label">Password (min 6 chars)</label>
            <input
              name="password"
              type="text"
              required
              minLength={6}
              autoComplete="off"
              className="field-input mt-1"
              placeholder="e.g. blackathon2026"
            />
          </div>
          <button className="btn-gold" disabled={pwdPending}>
            {pwdPending ? "Applying…" : "🔐 Set & Apply"}
          </button>
        </div>
        {pwdState && pwdState.ok && (
          <div className="space-y-2">
            <div className="rounded-md border border-jade/60 bg-jade/10 px-3 py-2 text-xs text-jade">
              ✓ Updated {pwdState.updated} user{pwdState.updated === 1 ? "" : "s"}
              {pwdState.failed > 0 && ` · ${pwdState.failed} failed`}. Share
              the password now — it's set.
            </div>
            {pwdState.failed > 0 && pwdState.details.length > 0 && (
              <div className="rounded-md border border-blood/60 bg-blood/10 px-3 py-2 text-[0.7rem] text-blood">
                <div className="mb-1 font-semibold uppercase tracking-wider">
                  Failures:
                </div>
                <ul className="list-disc space-y-0.5 pl-4">
                  {pwdState.details.map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
        {pwdState && !pwdState.ok && (
          <div className="rounded-md border border-blood/60 bg-blood/10 px-3 py-2 text-xs text-blood">
            {pwdState.error}
          </div>
        )}
      </form>

      {/* Test Account — quick one-off login for verifying the judge flow */}
      <form
        id="test-form"
        action={onCreateTest}
        className="card space-y-3 border-l-4 border-l-jade/60"
      >
        <div className="flex items-baseline justify-between">
          <span className="rounded-full border border-jade/40 bg-jade/10 px-3 py-1 text-[0.7rem] uppercase tracking-wider text-jade">
            Test Account
          </span>
          <span className="text-[0.65rem] uppercase tracking-wider text-dust">
            For verifying the sign-in flow
          </span>
        </div>
        <p className="text-xs text-dust">
          Creates a one-off judge or mentor with a known email + password —
          independent of the shared-password card. Use it to test the{" "}
          <span className="text-gold">/judge</span> sign-in flow yourself.
          Deactivate it from the roster after you're done.
        </p>
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto]">
          <div>
            <label className="field-label">Email</label>
            <input
              name="email"
              type="email"
              required
              className="field-input mt-1"
              placeholder="test@blackathon.local"
            />
          </div>
          <div>
            <label className="field-label">Password</label>
            <input
              name="password"
              type="text"
              required
              minLength={6}
              autoComplete="off"
              className="field-input mt-1"
              placeholder="≥ 6 chars"
            />
          </div>
          <div>
            <label className="field-label">Role</label>
            <select name="role" defaultValue="judge" className="field-input mt-1">
              <option value="judge">Judge</option>
              <option value="mentor">Mentor</option>
            </select>
          </div>
          <div className="flex items-end">
            <button className="btn" disabled={testPending}>
              {testPending ? "Creating…" : "+ Create"}
            </button>
          </div>
        </div>
        <input name="name" type="hidden" value="Test Account" />
        {testState && testState.ok && (
          <div className="rounded-md border border-jade/60 bg-jade/10 px-3 py-2 text-xs text-jade">
            ✓ Created <span className="font-mono">{testState.email}</span>. Sign
            in at <span className="text-gold">/judge</span> with that email +
            the password you just typed.
          </div>
        )}
        {testState && !testState.ok && (
          <div className="rounded-md border border-blood/60 bg-blood/10 px-3 py-2 text-xs text-blood">
            {testState.error}
          </div>
        )}
      </form>

      {/* Judges */}
      <div className="grid gap-4 md:grid-cols-[1fr_2fr]">
        <form
          id="judge-form"
          action={onAdd("judge", "judge-form")}
          className="card h-fit space-y-3"
        >
          <div className="pill-gold">Add Judge</div>
          <div>
            <label className="field-label">Name</label>
            <input name="name" required className="field-input mt-1" />
          </div>
          <div>
            <label className="field-label">Email</label>
            <input name="email" type="email" required className="field-input mt-1" />
          </div>
          {state?.role === "judge" && !state.ok && state.error && (
            <div className="rounded-md border border-blood/60 bg-blood/10 px-3 py-2 text-xs text-blood">
              {state.error}
            </div>
          )}
          <button className="btn-gold w-full" disabled={pending}>
            {pending ? "Adding…" : "+ Add Judge"}
          </button>
          <p className="text-[0.7rem] text-dust">
            Judges sign in at <span className="text-gold">/judge</span>, score
            submissions, and shape the top-6.
          </p>
        </form>

        <div className="card">
          <div className="field-label mb-3">
            Judges ({justJudges.filter((j) => j.is_active).length})
          </div>
          <ul className="divide-y divide-line">
            {justJudges.map((j) => (
              <li key={j.id} className="flex items-center justify-between py-2">
                <div>
                  <div className="font-semibold">{j.name}</div>
                  <div className="text-xs text-dust">{j.email}</div>
                </div>
                <div className="flex items-center gap-2">
                  {j.is_active ? <span className="pill-gold">Active</span> : <span className="pill">Inactive</span>}
                  {j.is_active && (
                    <button
                      onClick={() => removeJudge(j.id)}
                      className="pill hover:border-blood hover:text-blood"
                    >
                      Deactivate
                    </button>
                  )}
                </div>
              </li>
            ))}
            {justJudges.length === 0 && (
              <li className="py-6 text-center text-dust">No judges yet. Add some on the left.</li>
            )}
          </ul>
        </div>
      </div>

      {/* Mentors */}
      <div className="grid gap-4 md:grid-cols-[1fr_2fr]">
        <form
          id="mentor-form"
          action={onAdd("mentor", "mentor-form")}
          className="card h-fit space-y-3"
        >
          <div className="pill">Add Mentor</div>
          <div>
            <label className="field-label">Name</label>
            <input name="name" required className="field-input mt-1" />
          </div>
          <div>
            <label className="field-label">Email</label>
            <input name="email" type="email" required className="field-input mt-1" />
          </div>
          {state?.role === "mentor" && !state.ok && state.error && (
            <div className="rounded-md border border-blood/60 bg-blood/10 px-3 py-2 text-xs text-blood">
              {state.error}
            </div>
          )}
          <button className="btn w-full" disabled={pending}>
            {pending ? "Adding…" : "+ Add Mentor"}
          </button>
          <p className="text-[0.7rem] text-dust">
            Mentors sign in at <span className="text-gold">/judge</span> and can
            view every submission, but cannot vote. Use this for advisors,
            partners, and observers.
          </p>
        </form>

        <div className="card">
          <div className="field-label mb-3">
            Mentors ({mentors.filter((j) => j.is_active).length})
          </div>
          <ul className="divide-y divide-line">
            {mentors.map((j) => (
              <li key={j.id} className="flex items-center justify-between py-2">
                <div>
                  <div className="font-semibold">{j.name}</div>
                  <div className="text-xs text-dust">{j.email}</div>
                </div>
                <div className="flex items-center gap-2">
                  {j.is_active ? <span className="pill-gold">Active</span> : <span className="pill">Inactive</span>}
                  {j.is_active && (
                    <button
                      onClick={() => removeJudge(j.id)}
                      className="pill hover:border-blood hover:text-blood"
                    >
                      Deactivate
                    </button>
                  )}
                </div>
              </li>
            ))}
            {mentors.length === 0 && (
              <li className="py-6 text-center text-dust">
                No mentors yet. Add advisors or partners on the left.
              </li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}

function SubmissionsPanel({ submissions }: { submissions: Submission[] }) {
  const [result, setResult] = useState<null | { inserted: number; skipped: number; flagged: number }>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  async function onImport(fd: FormData) {
    start(async () => {
      const r = await importCsv(null, fd);
      if (r.ok) {
        setResult(r);
        setErr(null);
      } else {
        setErr(r.error);
      }
    });
  }

  return (
    <div className="space-y-4">
      <form action={onImport} className="card space-y-3">
        <div className="pill-gold">Import from Airtable CSV</div>
        <input
          type="file"
          name="file"
          accept=".csv"
          required
          className="block w-full text-sm text-dust file:mr-3 file:rounded file:border-0 file:bg-gold file:px-4 file:py-2 file:font-semibold file:uppercase file:text-ink hover:file:brightness-110"
        />
        <p className="text-[0.7rem] text-dust">
          Upserts by project name. Rows where the Challenge Track landed in Team Name
          (an Airtable quirk) are auto-corrected and flagged for review.
        </p>
        {result && (
          <div className="rounded-md border border-gold/40 bg-gold/10 px-3 py-2 text-sm text-gold">
            Imported {result.inserted} · Skipped {result.skipped} · Flagged for review {result.flagged}
          </div>
        )}
        {err && (
          <div className="rounded-md border border-blood/60 bg-blood/10 px-3 py-2 text-sm text-blood">
            {err}
          </div>
        )}
        <button className="btn-gold" disabled={pending}>
          {pending ? "Importing…" : "📥 Import CSV"}
        </button>
      </form>

      <div className="card">
        <div className="field-label mb-3">Submissions ({submissions.length})</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-[0.7rem] uppercase tracking-wider text-gold">
              <tr>
                <th className="p-2 text-left">Project</th>
                <th className="p-2 text-left">Team</th>
                <th className="p-2 text-left">Track</th>
                <th className="p-2 text-center">Complete</th>
                <th className="p-2 text-center">Review</th>
                <th className="p-2 text-center">Hidden</th>
                <th className="p-2" />
              </tr>
            </thead>
            <tbody>
              {submissions.map((s) => (
                <tr key={s.id} className="border-t border-line">
                  <td className="p-2 font-semibold">{s.project_name}</td>
                  <td className="p-2 text-dust">{s.team_name || s.solo_or_team || "–"}</td>
                  <td className="p-2 text-dust">{s.challenge_track || "–"}</td>
                  <td className="p-2 text-center">{s.is_submission_complete ? "✓" : "–"}</td>
                  <td className="p-2 text-center">{s.needs_review ? "⚠" : ""}</td>
                  <td className="p-2 text-center">{s.hidden_from_judges ? "🚫" : ""}</td>
                  <td className="p-2 text-right">
                    <button
                      onClick={() => toggleHideSubmission(s.id, !s.hidden_from_judges)}
                      className="pill hover:border-gold hover:text-gold"
                    >
                      {s.hidden_from_judges ? "Show" : "Hide"}
                    </button>
                  </td>
                </tr>
              ))}
              {submissions.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-dust">
                    No submissions yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ResultsPanel({
  phase,
  submissions,
  lock,
}: {
  phase: Phase;
  submissions: Submission[];
  lock: Lock | null;
}) {
  const [pending, start] = useTransition();
  const byId = new Map(submissions.map((s) => [s.id, s]));

  async function compute(fd: FormData) {
    start(async () => {
      await computeAndLockTop6(fd);
    });
  }

  return (
    <div className="space-y-4">
      <form action={compute} className="card space-y-3">
        <div className="pill-gold">Compute Top 6</div>
        <p className="text-sm text-dust">
          Runs the Monte Carlo algorithm (1000 trials) on all current scores,
          selects auto-locks (&gt;70% top-6 probability) and fills the rest via
          weighted random draw from the bubble. Saves the result and flips the
          app to <span className="text-gold">results</span> phase.
        </p>
        <div>
          <label className="field-label">
            Seed (optional — leave blank for random, or use a specific number to
            reproduce a result)
          </label>
          <input
            name="seed"
            type="number"
            placeholder="Random"
            className="field-input mt-1 w-48"
            defaultValue={lock?.seed ?? ""}
          />
        </div>
        <button className="btn-gold" disabled={pending}>
          {pending ? "Running 1000 trials…" : "🎲 Compute + Lock"}
        </button>
      </form>

      {lock && (
        <div className="card">
          <div className="flex items-baseline justify-between">
            <div>
              <div className="pill-gold">Locked Top 6</div>
              <div className="mt-1 text-[0.7rem] text-dust">
                Seed: <span className="font-mono text-bone">{lock.seed}</span> ·
                Locked: {new Date(lock.locked_at).toLocaleString()}
              </div>
            </div>
            {phase === "results" && (
              <Link href="/results" className="btn">Public Results →</Link>
            )}
          </div>
          <ol className="mt-4 space-y-2">
            {lock.top6.map((t) => {
              const s = byId.get(t.submission_id);
              return (
                <li
                  key={t.submission_id}
                  className="flex items-center justify-between rounded-md border border-line bg-ink-4 px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-display text-3xl text-gold">{t.rank}</span>
                    <span className="font-semibold">{s?.project_name ?? t.submission_id}</span>
                  </div>
                  <span className="pill">
                    P(top6) = {(t.probability * 100).toFixed(0)}%
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </div>
  );
}

function Stat({ label, v }: { label: string; v: number }) {
  return (
    <div className="rounded border border-line bg-ink-4 px-2 py-1.5">
      <div className="text-[0.6rem] uppercase tracking-wider text-dust">{label}</div>
      <div className="font-display text-xl text-bone">{v}</div>
    </div>
  );
}
