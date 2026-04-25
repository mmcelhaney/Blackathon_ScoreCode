import Link from "next/link";
import { redirect } from "next/navigation";
import { Breadcrumbs, HeaderBar, PageShell, SectionTitle } from "@/components/shell";
import { getJudgeByAuthUser } from "@/lib/judge-lookup";
import { getPhase } from "@/lib/phase";
import { createClient } from "@/lib/supabase/server";
import { shuffleForUser } from "@/lib/shuffle";
import { SignOutButton } from "./sign-out";
import { SubmissionList, type SubRow } from "./submission-list";

export const dynamic = "force-dynamic";

export default async function JudgeDashboard() {
  const phase = await getPhase();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/judge");

  const judge = await getJudgeByAuthUser(supabase, user.id);
  if (!judge?.is_active) redirect("/judge");

  const isMentor = judge.role === "mentor";

  const { data: subs } = await supabase
    .from("submissions_public")
    .select(
      "id, project_name, team_name, solo_or_team, challenge_track, project_description_summary",
    );

  // Per-user randomized order so the bottom of the queue gets attention even
  // if a judge runs out of time. Stable across refreshes for the same user.
  const rawRows = (subs as SubRow[] | null) ?? [];
  const rows = shuffleForUser(rawRows, judge.id, (s) => s.id);

  const { data: myScores } = isMentor
    ? { data: [] as { submission_id: string }[] }
    : await supabase
        .from("scores")
        .select("submission_id")
        .eq("judge_id", judge.id);
  const scoredIds = (myScores ?? []).map((s) => s.submission_id);

  const done = scoredIds.length;
  const pct = rows.length ? Math.round((done / rows.length) * 100) : 0;

  return (
    <>
      <HeaderBar
        rightSlot={
          <>
            <span className="hidden text-dust md:inline">
              Signed in as <span className="text-bone">{judge.name}</span>
              {isMentor && (
                <span className="ml-2 rounded-full border border-line bg-ink-4 px-2 py-0.5 text-[0.65rem] uppercase tracking-wider text-dust">
                  Mentor
                </span>
              )}
            </span>
            <SignOutButton />
          </>
        }
      />
      <PageShell>
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Judge", href: "/judge" },
            { label: "Dashboard" },
          ]}
        />
        <SectionTitle
          eyebrow={isMentor ? "Mentor · View Only" : `Phase: ${phase}`}
          title={isMentor ? "Mentor Dashboard" : "Judge Dashboard"}
          subtitle={
            isMentor
              ? "You have read-only access to every submission. You can't vote — that's by design."
              : phase === "judging"
                ? "Score each submission across six categories. Impact is the ice-breaker — it only matters for ties."
                : phase === "results"
                  ? "Voting is closed. Head to the results page."
                  : "Submissions are still open. Come back when judging opens."
          }
        />

        {!isMentor && (
          <div className="card mb-4 flex flex-wrap items-center gap-4">
            <div>
              <div className="field-label">Your Progress</div>
              <div className="font-display text-3xl text-gold">
                {done} <span className="text-base text-dust">/ {rows.length}</span>
              </div>
            </div>
            <div className="h-3 flex-1 overflow-hidden rounded-full border border-line bg-ink-5">
              <div
                className="h-full bg-gradient-to-r from-blood via-gold to-jade transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="font-cond text-sm font-semibold uppercase tracking-wider text-bone">
              {pct}%
            </div>
            {phase === "results" && (
              <Link href="/results" className="btn-gold">
                View Results →
              </Link>
            )}
          </div>
        )}

        <SubmissionList
          rows={rows}
          scoredIds={scoredIds}
          canScore={!isMentor && phase === "judging"}
          mentorMode={isMentor}
        />
      </PageShell>
    </>
  );
}
