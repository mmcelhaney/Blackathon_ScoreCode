import Link from "next/link";
import { redirect } from "next/navigation";
import { Breadcrumbs, HeaderBar, PageShell, SectionTitle } from "@/components/shell";
import { getPhase } from "@/lib/phase";
import { createClient } from "@/lib/supabase/server";
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

  const { data: judge } = await supabase
    .from("judges")
    .select("id, name, is_active")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (!judge?.is_active) redirect("/judge");

  const { data: subs } = await supabase
    .from("submissions_public")
    .select(
      "id, project_name, team_name, solo_or_team, challenge_track, project_description_summary",
    )
    .order("project_name");

  const { data: myScores } = await supabase
    .from("scores")
    .select("submission_id")
    .eq("judge_id", judge.id);
  const scoredIds = (myScores ?? []).map((s) => s.submission_id);

  const rows = (subs as SubRow[] | null) ?? [];
  const done = scoredIds.length;
  const pct = rows.length ? Math.round((done / rows.length) * 100) : 0;

  return (
    <>
      <HeaderBar
        rightSlot={
          <>
            <span className="hidden text-dust md:inline">
              Signed in as <span className="text-bone">{judge.name}</span>
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
          eyebrow={`Phase: ${phase}`}
          title="Judge Dashboard"
          subtitle={
            phase === "judging"
              ? "Score each submission across six categories. Impact is the ice-breaker — it only matters for ties."
              : phase === "results"
                ? "Voting is closed. Head to the results page."
                : "Submissions are still open. Come back when judging opens."
          }
        />

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

        <SubmissionList
          rows={rows}
          scoredIds={scoredIds}
          canScore={phase === "judging"}
        />
      </PageShell>
    </>
  );
}
