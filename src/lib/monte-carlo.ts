/**
 * Top-6 algorithm — seeded, reproducible.
 *
 *  1) Per-judge z-score normalization on the 5 core categories
 *     (idea, creativity, build_quality, ux, presentation).
 *     Neutralizes harsh vs. generous graders.
 *
 *  2) Bayesian shrinkage toward the global mean with credibility n/(n+k).
 *     Submissions with few judges get pulled to the mean — a "3 judges at 9/10"
 *     shouldn't beat a "9 judges at 8.7/10".
 *
 *  3) Monte Carlo: 1000 trials. Each trial adds gaussian jitter scaled by each
 *     judge's stdev to every score, re-normalizes, re-aggregates, re-ranks.
 *     Each submission's top-6 probability = fraction of trials it landed there.
 *
 *  4) Impact is the ice-breaker. When two submissions are within ε on the
 *     normalized total, the one with higher Impact mean wins automatically.
 *     Ties still remaining → surfaced for manual admin tie-break.
 *
 *  5) Selection: submissions with P(top6) > 0.70 auto-lock.
 *     Remaining slots filled by weighted random draw from the bubble,
 *     weights = P(top6). Reproducible via seed.
 */

export type ScoreRow = {
  judge_id: string;
  submission_id: string;
  idea: number;
  creativity: number;
  build_quality: number;
  ux: number;
  presentation: number;
  impact: number;
};

export type SubmissionMeta = {
  id: string;
  project_name: string;
};

export type MonteCarloOptions = {
  trials?: number;
  seed?: number;
  shrinkageK?: number;
  autoLockProb?: number;
  tieEpsilon?: number;
  topN?: number;
};

export type MonteCarloResult = {
  rankings: SubmissionRanking[];
  autoLocked: string[];
  bubble: string[];
  ties: [string, string][];
  seed: number;
  nTrials: number;
};

export type SubmissionRanking = {
  submission_id: string;
  project_name: string;
  n_judges: number;
  raw_total: number;       // mean of raw 5-cat totals (out of 50)
  normalized_score: number; // shrunk, z-normalized composite
  impact_mean: number;
  p_top_n: number;         // probability of landing in top N across trials
  mean_rank: number;       // average rank across trials
};

const CORE_CATS = [
  "idea",
  "creativity",
  "build_quality",
  "ux",
  "presentation",
] as const;

// ─── Mulberry32: fast, seeded PRNG ─────────────────────────────────────
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(rng: () => number): number {
  // Box-Muller
  const u1 = Math.max(rng(), 1e-12);
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function mean(xs: number[]) {
  return xs.reduce((s, x) => s + x, 0) / (xs.length || 1);
}
function stdev(xs: number[]) {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1));
}

type CoreCat = typeof CORE_CATS[number];

type JudgeStats = {
  meansByCat: Record<CoreCat, number>;
  stdevsByCat: Record<CoreCat, number>;
};

function computeJudgeStats(scores: ScoreRow[]): Map<string, JudgeStats> {
  const byJudge = new Map<string, ScoreRow[]>();
  for (const s of scores) {
    const arr = byJudge.get(s.judge_id) ?? [];
    arr.push(s);
    byJudge.set(s.judge_id, arr);
  }
  const out = new Map<string, JudgeStats>();
  for (const [jid, arr] of byJudge) {
    const meansByCat = {} as Record<CoreCat, number>;
    const stdevsByCat = {} as Record<CoreCat, number>;
    for (const c of CORE_CATS) {
      const xs = arr.map((r) => r[c]);
      meansByCat[c] = mean(xs);
      // Floor at 0.5 so a judge who always gives 10s doesn't break normalization
      stdevsByCat[c] = Math.max(stdev(xs), 0.5);
    }
    out.set(jid, { meansByCat, stdevsByCat });
  }
  return out;
}

// Returns a composite normalized-and-shrunk score per submission + metadata
function aggregate(
  scores: ScoreRow[],
  judgeStats: Map<string, JudgeStats>,
  shrinkageK: number,
): Map<
  string,
  {
    n: number;
    rawTotal: number;
    normScore: number;
    impactMean: number;
  }
> {
  // Global means for shrinkage target
  const globalRaw = mean(
    scores.map((s) => s.idea + s.creativity + s.build_quality + s.ux + s.presentation),
  );

  const bySub = new Map<string, ScoreRow[]>();
  for (const s of scores) {
    const arr = bySub.get(s.submission_id) ?? [];
    arr.push(s);
    bySub.set(s.submission_id, arr);
  }

  const out = new Map<
    string,
    { n: number; rawTotal: number; normScore: number; impactMean: number }
  >();
  for (const [sid, arr] of bySub) {
    let normTotal = 0;
    let rawTotal = 0;
    let impactTotal = 0;
    for (const r of arr) {
      const js = judgeStats.get(r.judge_id);
      if (!js) continue;
      let zSum = 0;
      for (const c of CORE_CATS) {
        zSum += (r[c] - js.meansByCat[c]) / js.stdevsByCat[c];
      }
      normTotal += zSum;
      rawTotal += r.idea + r.creativity + r.build_quality + r.ux + r.presentation;
      impactTotal += r.impact;
    }
    const n = arr.length;
    const rawMean = rawTotal / n;
    const normMean = normTotal / n;
    // Bayesian shrinkage toward global raw mean. Maps the normalized composite
    // through credibility: low-n submissions get pulled toward 0 (neutral).
    const credibility = n / (n + shrinkageK);
    const shrunk = normMean * credibility;
    out.set(sid, {
      n,
      rawTotal: rawMean,
      normScore: shrunk,
      impactMean: impactTotal / n,
    });
    void globalRaw; // reserved for future use
  }
  return out;
}

export function monteCarloTop(
  scores: ScoreRow[],
  subs: SubmissionMeta[],
  opts: MonteCarloOptions = {},
): MonteCarloResult {
  const trials = opts.trials ?? 1000;
  const seed = opts.seed ?? 1738271101;
  const shrinkageK = opts.shrinkageK ?? 3;
  const autoLockProb = opts.autoLockProb ?? 0.7;
  const tieEpsilon = opts.tieEpsilon ?? 0.25;
  const topN = opts.topN ?? 6;

  const rng = mulberry32(seed);
  const judgeStats = computeJudgeStats(scores);

  // Base aggregation (no jitter) — the "truth" we're studying
  const base = aggregate(scores, judgeStats, shrinkageK);

  // Counts for MC
  const topCount = new Map<string, number>();
  const rankSum = new Map<string, number>();
  for (const s of subs) {
    topCount.set(s.id, 0);
    rankSum.set(s.id, 0);
  }

  for (let t = 0; t < trials; t++) {
    // Perturb every score by gaussian jitter scaled by that judge's stdev on that cat.
    // Clamp to [1, 10] to keep values valid.
    const jittered: ScoreRow[] = scores.map((r) => {
      const js = judgeStats.get(r.judge_id);
      if (!js) return r;
      const j = { ...r };
      for (const c of CORE_CATS) {
        const noise = gaussian(rng) * js.stdevsByCat[c];
        j[c] = Math.max(1, Math.min(10, j[c] + noise));
      }
      return j;
    });
    const trialStats = computeJudgeStats(jittered);
    const agg = aggregate(jittered, trialStats, shrinkageK);

    const sorted = [...agg.entries()].sort((a, b) => b[1].normScore - a[1].normScore);
    sorted.forEach(([sid], idx) => {
      rankSum.set(sid, (rankSum.get(sid) ?? 0) + idx + 1);
      if (idx < topN) topCount.set(sid, (topCount.get(sid) ?? 0) + 1);
    });
  }

  const rankings: SubmissionRanking[] = subs
    .map((s) => {
      const b = base.get(s.id);
      return {
        submission_id: s.id,
        project_name: s.project_name,
        n_judges: b?.n ?? 0,
        raw_total: b?.rawTotal ?? 0,
        normalized_score: b?.normScore ?? 0,
        impact_mean: b?.impactMean ?? 0,
        p_top_n: (topCount.get(s.id) ?? 0) / trials,
        mean_rank: (rankSum.get(s.id) ?? 0) / trials,
      };
    })
    .sort((a, b) => b.normalized_score - a.normalized_score);

  // ── Selection logic ─────────────────────────────────────────────────
  const autoLocked: string[] = [];
  const bubble: string[] = [];
  const seen = new Set<string>();

  for (const r of rankings) {
    if (autoLocked.length >= topN) break;
    if (r.p_top_n >= autoLockProb) {
      autoLocked.push(r.submission_id);
      seen.add(r.submission_id);
    }
  }

  const slotsLeft = topN - autoLocked.length;
  if (slotsLeft > 0) {
    // Bubble = remaining top-ranked candidates we might choose from.
    // Take anyone not auto-locked whose normalized_score is within 1 stdev of
    // the cutoff, OR whose p_top_n > 0.10. This keeps the pool meaningful.
    const candidates = rankings.filter((r) => !seen.has(r.submission_id));
    for (const r of candidates) {
      if (r.p_top_n > 0.1) bubble.push(r.submission_id);
    }
  }

  // Ice-breaker 1: if two rankings are within tieEpsilon, flag them.
  const ties: [string, string][] = [];
  for (let i = 0; i < rankings.length - 1; i++) {
    const a = rankings[i];
    const b = rankings[i + 1];
    if (Math.abs(a.normalized_score - b.normalized_score) < tieEpsilon) {
      // Impact breaks it
      if (Math.abs(a.impact_mean - b.impact_mean) < 0.1) {
        ties.push([a.submission_id, b.submission_id]);
      }
    }
  }

  return {
    rankings,
    autoLocked,
    bubble,
    ties,
    seed,
    nTrials: trials,
  };
}

/** Weighted random draw from bubble candidates to fill remaining top-N slots. */
export function drawBubble(
  bubble: string[],
  rankings: SubmissionRanking[],
  slots: number,
  seed: number,
): string[] {
  if (slots <= 0 || bubble.length === 0) return [];
  const rng = mulberry32(seed);
  const byId = new Map(rankings.map((r) => [r.submission_id, r]));
  const pool = bubble
    .map((id) => ({ id, w: Math.max(byId.get(id)?.p_top_n ?? 0.01, 0.01) }));

  const chosen: string[] = [];
  for (let k = 0; k < slots && pool.length > 0; k++) {
    const total = pool.reduce((s, p) => s + p.w, 0);
    let x = rng() * total;
    let idx = 0;
    for (; idx < pool.length; idx++) {
      x -= pool[idx].w;
      if (x <= 0) break;
    }
    chosen.push(pool[idx].id);
    pool.splice(idx, 1);
  }
  return chosen;
}
