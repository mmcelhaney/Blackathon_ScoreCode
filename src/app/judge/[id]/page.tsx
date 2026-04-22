import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Breadcrumbs, HeaderBar, PageShell } from "@/components/shell";
import { getPhase } from "@/lib/phase";
import { isAdminSignedIn } from "@/app/admin/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { ScoreForm } from "./score-form";

export const dynamic = "force-dynamic";

export default async function JudgeSubmissionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const phase = await getPhase();
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Determine viewer: judge, admin, or kick out
  let judge: { id: string; name: string; is_active: boolean } | null = null;
  if (user) {
    const { data } = await supabase
      .from("judges")
      .select("id, name, is_active")
      .eq("auth_user_id", user.id)
      .maybeSingle();
    judge = data?.is_active ? data : null;
  }
  const adminOnly = !judge && (await isAdminSignedIn());
  if (!judge && !adminOnly) redirect("/judge");

  // Admins use the service role to fetch all submission data; judges use the
  // sanitized public view (no member emails).
  let sub: Record<string, string | number | null> | null = null;
  if (judge) {
    const { data } = await supabase
      .from("submissions_public")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    sub = data ?? null;
  } else {
    const admin = createAdminClient();
    const { data } = await admin
      .from("submissions")
      .select(
        "id, project_name, team_name, solo_or_team, challenge_track, project_category, project_description, project_description_summary, technologies_used, team_size, github_url, live_demo_url, demo_video_url, linkedin_post_url, member1_name, member2_name, member3_name, member4_name",
      )
      .eq("id", id)
      .maybeSingle();
    sub = data ?? null;
  }
  if (!sub) notFound();

  const existing = judge
    ? (
        await supabase
          .from("scores")
          .select(
            "idea, creativity, build_quality, ux, presentation, impact, comment",
          )
          .eq("judge_id", judge.id)
          .eq("submission_id", id)
          .maybeSingle()
      ).data
    : null;

  // In results phase (or for admins viewing), fetch all non-empty judge
  // comments for this submission. Shown anonymously as "Judge 1/2/3…" to
  // preserve the "aggregated only, no per-judge breakdown" rule.
  let judgeNotes: { label: string; text: string }[] = [];
  if (phase === "results" || adminOnly) {
    const admin = createAdminClient();
    const { data: notes } = await admin
      .from("scores")
      .select("comment, created_at")
      .eq("submission_id", id)
      .not("comment", "is", null)
      .order("created_at", { ascending: true });
    judgeNotes = (notes ?? [])
      .filter((n) => (n.comment ?? "").trim().length > 0)
      .map((n, i) => ({
        label: `Judge ${String.fromCharCode(65 + i)}`,
        text: String(n.comment),
      }));
  }

  const crumbs = judge
    ? [
        { label: "Home", href: "/" },
        { label: "Judge", href: "/judge" },
        { label: "Dashboard", href: "/judge/dashboard" },
        { label: String(sub.project_name ?? "Submission") },
      ]
    : [
        { label: "Home", href: "/" },
        { label: "Admin", href: "/admin" },
        { label: "Results", href: "/results" },
        { label: String(sub.project_name ?? "Submission") },
      ];

  return (
    <>
      <HeaderBar
        rightSlot={
          <Link
            href={judge ? "/judge/dashboard" : "/results"}
            className="pill hover:border-gold hover:text-gold"
          >
            ← Back
          </Link>
        }
      />
      <PageShell>
        <Breadcrumbs items={crumbs} />

        <div className="mb-6 animate-fade-up">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            {sub.solo_or_team && <span className="pill">{sub.solo_or_team}</span>}
            {sub.team_name && <span className="pill">{sub.team_name}</span>}
            {sub.challenge_track && (
              <span className="pill">{sub.challenge_track}</span>
            )}
            {sub.project_category &&
              sub.project_category !== sub.challenge_track && (
                <span className="pill">{sub.project_category}</span>
              )}
          </div>
          <h1 className="hex-title text-5xl">{sub.project_name}</h1>
          {sub.project_description_summary && (
            <p className="mt-3 text-dust">{sub.project_description_summary}</p>
          )}
          <div className="mt-4 h-[2px] w-28 rounded bg-gradient-to-r from-blood via-gold to-jade opacity-70" />
        </div>

        {/* Judge guidance — only shown during judging phase */}
        {judge && phase === "judging" && (
          <div className="card mb-6 border-l-4 border-l-gold">
            <div className="mb-2 flex items-center gap-2">
              <span className="pill-gold">How to Score</span>
              <span className="text-[0.7rem] uppercase tracking-wider text-dust">
                Read this before scoring
              </span>
            </div>
            <ol className="list-decimal space-y-2 pl-5 text-sm text-bone/90">
              <li>
                <strong className="text-gold">Watch the demo video first.</strong>{" "}
                Open the <span className="text-bone">▣ Video</span> link below —
                it's the primary source of truth for what was actually built.
              </li>
              <li>
                <strong className="text-gold">
                  Compare the video to the written description.
                </strong>{" "}
                If the demo clearly delivers on what they described, score
                confidently. If there's a gap, weight that against them —
                especially on Build Quality and Presentation.
              </li>
              <li>
                <strong className="text-gold">Score each category 1–10</strong>{" "}
                based on what the video and description actually show. Be fair,
                be consistent. Your personal harshness gets normalized out
                during tallying, so don't worry about "using the whole scale."
              </li>
              <li>
                <strong className="text-gold">Impact is the ice-breaker.</strong>{" "}
                It's separate from the main total and only matters if two teams
                finish neck-and-neck. Think <em>how much this could matter in
                the real world</em>.
              </li>
            </ol>
            <p className="mt-3 text-[0.7rem] text-dust">
              Not sure about a score? You can always come back and update it
              before voting closes. Submissions without a demo video are
              disqualified — flag them to the admin if one is missing.
            </p>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
          <div className="card space-y-4">
            <div>
              <div className="field-label">Description</div>
              <p className="mt-1 whitespace-pre-wrap text-sm">
                {sub.project_description || "—"}
              </p>
            </div>
            {sub.technologies_used && (
              <div>
                <div className="field-label">Tech</div>
                <p className="mt-1 text-sm">{sub.technologies_used}</p>
              </div>
            )}
            {(sub.member1_name || sub.member2_name) && (
              <div>
                <div className="field-label">Team</div>
                <p className="mt-1 text-sm">
                  {[
                    sub.member1_name,
                    sub.member2_name,
                    sub.member3_name,
                    sub.member4_name,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                </p>
              </div>
            )}
            <div className="flex flex-wrap gap-2 pt-2">
              {sub.demo_video_url && (
                <a
                  href={String(sub.demo_video_url)}
                  target="_blank"
                  className="btn-gold text-xs"
                >
                  ▣ Watch Demo Video First
                </a>
              )}
              {sub.github_url && (
                <a
                  href={String(sub.github_url)}
                  target="_blank"
                  className="btn text-xs"
                >
                  ⚙ GitHub
                </a>
              )}
              {sub.live_demo_url && (
                <a
                  href={String(sub.live_demo_url)}
                  target="_blank"
                  className="btn text-xs"
                >
                  ▶ Live Demo
                </a>
              )}
              {sub.linkedin_post_url && (
                <a
                  href={String(sub.linkedin_post_url)}
                  target="_blank"
                  className="btn text-xs"
                >
                  in Announcement
                </a>
              )}
            </div>
          </div>

          {judge && phase === "judging" ? (
            <ScoreForm
              submissionId={String(sub.id)}
              judgeId={judge.id}
              existing={existing ?? null}
            />
          ) : (
            <div className="space-y-4">
              <div className="card h-fit">
                <div className="pill mb-2">
                  {adminOnly ? "Admin View" : "Scoring closed"}
                </div>
                <p className="text-sm text-dust">
                  {adminOnly
                    ? "You're viewing this as the admin. Use this view during the results phase to review a top-6 candidate before assigning 1st–3rd place."
                    : phase === "results"
                      ? "Voting is closed. Review the judges' notes below to help decide 1st–3rd."
                      : "Scoring is only available during the judging phase."}
                </p>
              </div>

              {judgeNotes.length > 0 && (
                <div className="card h-fit">
                  <div className="mb-3 flex items-center gap-2">
                    <span className="pill-gold">✎ Judge Notes</span>
                    <span className="text-[0.65rem] uppercase tracking-wider text-dust">
                      {judgeNotes.length} note{judgeNotes.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  <ul className="space-y-3">
                    {judgeNotes.map((n, idx) => (
                      <li
                        key={idx}
                        className="border-l-2 border-l-gold/40 bg-ink-4/60 px-3 py-2"
                      >
                        <div className="mb-1 font-cond text-[0.65rem] font-bold uppercase tracking-[0.2em] text-gold">
                          {n.label}
                        </div>
                        <p className="whitespace-pre-wrap text-sm text-bone/90">
                          {n.text}
                        </p>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 text-[0.65rem] italic text-dust">
                    Judge names are anonymized to keep individual scoring
                    behavior private — only notes are shown here.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </PageShell>
    </>
  );
}
