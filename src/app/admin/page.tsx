import Image from "next/image";
import Link from "next/link";
import { Breadcrumbs, HeaderBar, PageShell, SectionTitle } from "@/components/shell";
import { isAdminSignedIn } from "./auth";
import { AdminSignIn } from "./sign-in";
import { AdminHome } from "./admin-home";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const signedIn = await isAdminSignedIn();

  return (
    <>
      <HeaderBar
        rightSlot={
          <Link href="/" className="pill hover:border-gold hover:text-gold">
            ← Home
          </Link>
        }
      />
      <PageShell>
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Admin" },
          ]}
        />
        {!signedIn ? (
          <div className="mx-auto max-w-md">
            <div className="mb-4 flex justify-center">
              <Image
                src="/blackathon_text_final.png"
                alt="Blackathon"
                width={700}
                height={83}
                priority
                className="h-6 w-auto md:h-8"
              />
            </div>
            <SectionTitle
              eyebrow="Restricted"
              title="Admin Sign In"
              subtitle="Shared password required."
            />
            <AdminSignIn />
          </div>
        ) : (
          <AdminContent />
        )}
      </PageShell>
    </>
  );
}

async function AdminContent() {
  const admin = createAdminClient();
  const [
    { data: state },
    { data: judges },
    { data: subs },
    { data: progress },
    { data: scores },
    { data: lock },
  ] = await Promise.all([
    admin.from("event_state").select("phase, updated_at").eq("id", 1).maybeSingle(),
    admin.from("judges").select("id, name, email, is_active, created_at").order("name"),
    admin
      .from("submissions")
      .select(
        "id, project_name, team_name, solo_or_team, challenge_track, is_submission_complete, needs_review, hidden_from_judges, created_at",
      )
      .order("created_at", { ascending: false }),
    admin.from("judging_progress").select("submission_id, project_name, votes"),
    admin.from("scores").select("judge_id, submission_id, updated_at"),
    admin.from("results_lock").select("seed, top6, locked_at").eq("id", 1).maybeSingle(),
  ]);

  // Build per-judge voting progress
  const scoresByJudge = new Map<
    string,
    { count: number; lastAt: string | null }
  >();
  (scores ?? []).forEach((s: { judge_id: string; updated_at: string | null }) => {
    const prev = scoresByJudge.get(s.judge_id) ?? { count: 0, lastAt: null };
    prev.count += 1;
    if (!prev.lastAt || (s.updated_at && s.updated_at > prev.lastAt)) {
      prev.lastAt = s.updated_at;
    }
    scoresByJudge.set(s.judge_id, prev);
  });

  const visibleCount = (subs ?? []).filter(
    (s) => !s.hidden_from_judges && s.is_submission_complete,
  ).length;

  const judgeProgress = (judges ?? []).map((j) => {
    const stats = scoresByJudge.get(j.id);
    return {
      id: j.id,
      name: j.name,
      email: j.email,
      is_active: j.is_active,
      scored: stats?.count ?? 0,
      total: visibleCount,
      last_scored_at: stats?.lastAt ?? null,
    };
  });

  return (
    <AdminHome
      phase={(state?.phase as "submissions" | "judging" | "results") ?? "submissions"}
      judges={judges ?? []}
      submissions={subs ?? []}
      progress={progress ?? []}
      judgeProgress={judgeProgress}
      lock={lock ?? null}
    />
  );
}
