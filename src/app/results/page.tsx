import Link from "next/link";
import { Breadcrumbs, HeaderBar, PageShell, SectionTitle } from "@/components/shell";
import { isAdminSignedIn } from "@/app/admin/auth";
import { getPhase } from "@/lib/phase";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type Agg = {
  submission_id: string;
  project_name: string;
  n_judges: number;
  avg_idea: number | null;
  avg_creativity: number | null;
  avg_build_quality: number | null;
  avg_ux: number | null;
  avg_presentation: number | null;
  avg_impact: number | null;
  avg_total: number | null;
};

type Lock = {
  top6: { submission_id: string; rank: number; probability: number }[];
};

export default async function ResultsPage() {
  const phase = await getPhase();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const adminSignedIn = await isAdminSignedIn();

  // Is the signed-in user a registered active judge?
  let isJudge = false;
  if (user) {
    const { data: judge } = await supabase
      .from("judges")
      .select("is_active")
      .eq("auth_user_id", user.id)
      .maybeSingle();
    isJudge = !!judge?.is_active;
  }

  // Gate: only judges and admin can see results
  if (!isJudge && !adminSignedIn) {
    return (
      <>
        <HeaderBar
          rightSlot={
            <Link href="/" className="pill hover:border-gold hover:text-gold">
              ← Home
            </Link>
          }
        />
        <PageShell maxWidth="max-w-lg">
          <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Results" }]} />
          <SectionTitle
            eyebrow="Restricted"
            title="Judges Only"
            subtitle="Results are only visible to judges and event organizers."
          />
          <div className="flex gap-3">
            <Link href="/judge" className="btn-gold">Judge Sign In →</Link>
            <Link href="/admin" className="btn">Admin</Link>
          </div>
        </PageShell>
      </>
    );
  }

  // Fetch aggregates. Judges use RPC (RLS-gated to phase=results or admin).
  // Admins use the service role so they can preview before the phase flip.
  const useAdminClient = adminSignedIn && !isJudge;
  const client = useAdminClient ? createAdminClient() : supabase;

  const [{ data: agg }, { data: lock }] = await Promise.all([
    client.rpc("submission_aggregates"),
    client.from("results_lock").select("top6").eq("id", 1).maybeSingle(),
  ]);

  if (phase !== "results" && !adminSignedIn) {
    return (
      <>
        <HeaderBar
          rightSlot={
            <Link href="/" className="pill hover:border-gold hover:text-gold">
              ← Home
            </Link>
          }
        />
        <PageShell maxWidth="max-w-xl">
          <Breadcrumbs
            items={[
              { label: "Home", href: "/" },
              { label: "Judge", href: "/judge" },
              { label: "Results" },
            ]}
          />
          <SectionTitle
            eyebrow={`Phase: ${phase}`}
            title="Results Locked"
            subtitle="Results will be revealed once the admin closes voting."
          />
        </PageShell>
      </>
    );
  }

  const rows = ((agg ?? []) as Agg[]).filter((r) => r.n_judges > 0);
  rows.sort((a, b) => (b.avg_total ?? 0) - (a.avg_total ?? 0));

  const top6 = (lock?.top6 as Lock["top6"]) ?? [];
  const byId = new Map(rows.map((r) => [r.submission_id, r]));

  const crumbs = adminSignedIn && !isJudge
    ? [
        { label: "Home", href: "/" },
        { label: "Admin", href: "/admin" },
        { label: "Results" },
      ]
    : [
        { label: "Home", href: "/" },
        { label: "Judge", href: "/judge/dashboard" },
        { label: "Results" },
      ];

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
        <Breadcrumbs items={crumbs} />

        <SectionTitle
          eyebrow="Phase 3 · Results"
          title="The Top 6"
          subtitle="Aggregated breakdown across all judges. Individual scores stay private — these are the team-wide averages. Click any card to review the submission before picking 1st–3rd."
        />

        {top6.length > 0 && (
          <div className="mb-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {top6
              .sort((a, b) => a.rank - b.rank)
              .map((t) => {
                const r = byId.get(t.submission_id);
                if (!r) return null;
                const rankColor =
                  t.rank === 1
                    ? "border-gold shadow-gold"
                    : t.rank === 2
                      ? "border-bone/40"
                      : t.rank === 3
                        ? "border-gold-dark/60"
                        : "border-line";
                return (
                  <Link
                    key={t.submission_id}
                    href={`/judge/${t.submission_id}`}
                    className={`card group relative block overflow-hidden transition hover:-translate-y-0.5 hover:shadow-gold ${rankColor}`}
                  >
                    <div className="absolute -right-3 -top-3 font-display text-8xl leading-none text-gold/10">
                      {t.rank}
                    </div>
                    <div className="mb-2 flex items-center justify-between">
                      <span className="pill-gold">Rank #{t.rank}</span>
                      <span className="text-[0.65rem] uppercase tracking-wider text-dust transition group-hover:text-gold">
                        Review →
                      </span>
                    </div>
                    <h3 className="hex-title text-3xl">{r.project_name}</h3>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <Stat label="Total" value={r.avg_total} max={50} />
                      <Stat label="Impact" value={r.avg_impact} max={10} />
                      <Stat label="Idea" value={r.avg_idea} max={10} />
                      <Stat label="Creativity" value={r.avg_creativity} max={10} />
                      <Stat label="Build" value={r.avg_build_quality} max={10} />
                      <Stat label="UX" value={r.avg_ux} max={10} />
                      <Stat label="Presentation" value={r.avg_presentation} max={10} />
                      <Stat label="Judges" value={r.n_judges} plain />
                    </div>
                    <div className="mt-3 text-[0.68rem] text-dust">
                      Top-6 probability: {(t.probability * 100).toFixed(0)}%
                    </div>
                  </Link>
                );
              })}
          </div>
        )}

        <h2 className="hex-title mb-4 text-2xl">Full Leaderboard</h2>
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full text-sm">
            <thead className="bg-ink-4 text-[0.7rem] uppercase tracking-wider text-gold">
              <tr>
                <th className="p-3 text-left">#</th>
                <th className="p-3 text-left">Project</th>
                <th className="p-3 text-right">Total/50</th>
                <th className="p-3 text-right">Idea</th>
                <th className="p-3 text-right">Creat</th>
                <th className="p-3 text-right">Build</th>
                <th className="p-3 text-right">UX</th>
                <th className="p-3 text-right">Pres</th>
                <th className="p-3 text-right">Impact</th>
                <th className="p-3 text-right">Judges</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr
                  key={r.submission_id}
                  className="cursor-pointer border-t border-line transition hover:bg-ink-4"
                >
                  <td className="p-3 font-display text-lg text-gold">
                    <Link href={`/judge/${r.submission_id}`} className="block">
                      {i + 1}
                    </Link>
                  </td>
                  <td className="p-3">
                    <Link
                      href={`/judge/${r.submission_id}`}
                      className="block transition hover:text-gold"
                    >
                      {r.project_name}
                    </Link>
                  </td>
                  <td className="p-3 text-right font-display text-xl">{num(r.avg_total)}</td>
                  <td className="p-3 text-right">{num(r.avg_idea)}</td>
                  <td className="p-3 text-right">{num(r.avg_creativity)}</td>
                  <td className="p-3 text-right">{num(r.avg_build_quality)}</td>
                  <td className="p-3 text-right">{num(r.avg_ux)}</td>
                  <td className="p-3 text-right">{num(r.avg_presentation)}</td>
                  <td className="p-3 text-right text-gold">{num(r.avg_impact)}</td>
                  <td className="p-3 text-right text-dust">{r.n_judges}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PageShell>
    </>
  );
}

function num(v: number | null | undefined) {
  if (v === null || v === undefined) return "–";
  return Number(v).toFixed(1);
}

function Stat({
  label,
  value,
  max,
  plain,
}: {
  label: string;
  value: number | null | undefined;
  max?: number;
  plain?: boolean;
}) {
  return (
    <div className="rounded border border-line bg-ink-4 px-2 py-1.5">
      <div className="text-[0.6rem] uppercase tracking-wider text-dust">{label}</div>
      <div className="font-display text-base text-bone">
        {num(value ?? null)}
        {!plain && max ? <span className="text-xs text-dust"> /{max}</span> : null}
      </div>
    </div>
  );
}
