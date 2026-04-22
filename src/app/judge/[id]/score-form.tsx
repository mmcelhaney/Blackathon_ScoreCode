"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { RUBRIC, type RubricCategory } from "@/lib/rubric";

type ScoreValues = Record<RubricCategory, number | null> & { comment: string };

export function ScoreForm({
  submissionId,
  judgeId,
  existing,
}: {
  submissionId: string;
  judgeId: string;
  existing: Partial<Record<RubricCategory, number>> & { comment?: string | null } | null;
}) {
  const router = useRouter();
  const [values, setValues] = useState<ScoreValues>({
    idea: existing?.idea ?? null,
    creativity: existing?.creativity ?? null,
    build_quality: existing?.build_quality ?? null,
    ux: existing?.ux ?? null,
    presentation: existing?.presentation ?? null,
    impact: existing?.impact ?? null,
    comment: existing?.comment ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const coreTotal = useMemo(() => {
    return RUBRIC.filter((r) => !r.iceBreaker).reduce(
      (t, r) => t + (values[r.key] ?? 0),
      0,
    );
  }, [values]);

  const allFilled = RUBRIC.every((r) => values[r.key] !== null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!allFilled) {
      setErr("Score every category before submitting.");
      return;
    }
    setSaving(true);
    setErr(null);
    const supabase = createClient();
    const { error } = await supabase.from("scores").upsert(
      {
        judge_id: judgeId,
        submission_id: submissionId,
        idea: values.idea!,
        creativity: values.creativity!,
        build_quality: values.build_quality!,
        ux: values.ux!,
        presentation: values.presentation!,
        impact: values.impact!,
        comment: values.comment || null,
      },
      { onConflict: "judge_id,submission_id" },
    );
    setSaving(false);
    if (error) {
      setErr(error.message);
      return;
    }
    router.push("/judge/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={save} className="card h-fit space-y-4">
      <div className="flex items-baseline justify-between">
        <div className="pill-gold">Your Score</div>
        <div className="font-display text-4xl text-gold">
          {coreTotal} <span className="text-base text-dust">/ 50</span>
        </div>
      </div>

      <div className="space-y-4">
        {RUBRIC.map((r) => (
          <div key={r.key}>
            <div className="flex items-baseline justify-between">
              <label className="font-cond text-sm font-bold uppercase tracking-[0.15em] text-bone">
                {r.label}
                {r.iceBreaker && (
                  <span className="ml-2 text-[0.6rem] text-gold">
                    ICE-BREAKER
                  </span>
                )}
              </label>
              <span className="font-display text-xl text-bone">
                {values[r.key] ?? "–"}
              </span>
            </div>
            <p className="mb-1.5 text-[0.72rem] text-bone/70">{r.blurb}</p>
            <div className="grid grid-cols-10 gap-1">
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
                const on = values[r.key] === n;
                return (
                  <button
                    type="button"
                    key={n}
                    onClick={() =>
                      setValues((v) => ({ ...v, [r.key]: n }))
                    }
                    className={`h-9 rounded text-xs font-cond font-semibold transition ${
                      on
                        ? "border border-gold bg-gold/20 text-gold"
                        : "border border-line bg-ink-4 text-dust hover:border-gold/60 hover:text-bone"
                    }`}
                  >
                    {n}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div>
        <label className="field-label">Comments (optional, private to admin)</label>
        <textarea
          rows={3}
          className="field-input mt-1"
          value={values.comment}
          onChange={(e) => setValues((v) => ({ ...v, comment: e.target.value }))}
        />
      </div>

      {err && (
        <div className="rounded-md border border-blood/60 bg-blood/10 px-3 py-2 text-xs text-blood">
          {err}
        </div>
      )}

      <button className="btn-gold w-full" disabled={saving}>
        {saving ? "Saving…" : existing ? "↻ Update Score" : "✔ Submit Score"}
      </button>
    </form>
  );
}
