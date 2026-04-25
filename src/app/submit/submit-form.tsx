"use client";

import { useState, useTransition } from "react";
import { submitProject, type SubmitResult } from "./actions";

const TRACKS = ["AI for Coding", "Technology Solutions"];

const ORGS = [
  "BlackWPT",
  "NSBE BAP",
  "/dev/color",
  "Black Women in Tech",
  "Independent",
];

const ROLES = [
  "Software Engineer",
  "Designer",
  "Product / Founder",
  "Data Scientist",
  "Technologist",
  "Engineer",
  "Student",
];

const OTHER = "Other";

export function SubmitForm() {
  const [state, setState] = useState<SubmitResult | null>(null);
  const [pending, startTransition] = useTransition();

  const [mode, setMode] = useState<"Solo" | "Team">("Solo");
  const [orgChoice, setOrgChoice] = useState<string>("");
  const [roleChoice, setRoleChoice] = useState<string>("");

  // Captured FormData → modal preview (null means no modal)
  const [pending_fd, setPendingFd] = useState<FormData | null>(null);

  if (state?.ok) {
    return (
      <div className="card animate-fade-up">
        <div className="pill-gold mb-4">✓ Submitted</div>
        <h2 className="hex-title text-4xl">You&apos;re In.</h2>
        <p className="mt-3 text-dust">
          Your project has been locked in for judging. We&apos;ve emailed you an
          edit link in case you need to make changes before the submission
          deadline.
        </p>
        <p className="mt-2 text-xs uppercase tracking-wider text-dust">
          Submission ID:{" "}
          <span className="font-mono text-gold">{state.id}</span>
        </p>
      </div>
    );
  }

  const fe = state?.ok === false ? state.fieldErrors ?? {} : {};
  const err = (k: string) =>
    fe[k]?.[0] ? <p className="mt-1 text-xs text-blood">{fe[k]![0]}</p> : null;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // Browser already validated required fields before we got here.
    const fd = new FormData(e.currentTarget);
    setPendingFd(fd);
  }

  function cancelConfirm() {
    setPendingFd(null);
  }

  function confirmAndSend() {
    if (!pending_fd) return;
    const fd = pending_fd;
    startTransition(async () => {
      const result = await submitProject(null, fd);
      setState(result);
      // Only close the modal if it succeeded — on error, keep it open
      // briefly so the user sees what happened, then auto-close so the
      // inline field errors can render.
      setPendingFd(null);
    });
  }

  const preview: Record<string, string> | null = pending_fd
    ? (() => {
        const o: Record<string, string> = {};
        pending_fd.forEach((v, k) => {
          o[k] = String(v);
        });
        return o;
      })()
    : null;

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Contestant */}
        <fieldset className="card space-y-4">
          <legend className="pill-gold -mt-2 mb-2">1. About You</legend>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="field-label">Full Legal Name *</label>
              <input name="member1_name" required className="field-input mt-1" />
              {err("member1_name")}
            </div>
            <div>
              <label className="field-label">Email Address *</label>
              <input
                name="member1_email"
                type="email"
                required
                className="field-input mt-1"
              />
              {err("member1_email")}
            </div>
            <div>
              <label className="field-label">Affiliated Org</label>
              <select
                value={orgChoice}
                onChange={(e) => setOrgChoice(e.target.value)}
                name={orgChoice === OTHER ? undefined : "affiliated_org"}
                className="field-input mt-1"
              >
                <option value="">— Select —</option>
                {ORGS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
                <option value={OTHER}>Other…</option>
              </select>
              {orgChoice === OTHER && (
                <input
                  name="affiliated_org"
                  required
                  placeholder="Type your org"
                  className="field-input mt-2"
                  autoFocus
                />
              )}
            </div>
            <div>
              <label className="field-label">Role</label>
              <select
                value={roleChoice}
                onChange={(e) => setRoleChoice(e.target.value)}
                name={roleChoice === OTHER ? undefined : "submitter_role"}
                className="field-input mt-1"
              >
                <option value="">— Select —</option>
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
                <option value={OTHER}>Other…</option>
              </select>
              {roleChoice === OTHER && (
                <input
                  name="submitter_role"
                  required
                  placeholder="Type your role"
                  className="field-input mt-2"
                  autoFocus
                />
              )}
            </div>
            <div className="md:col-span-2">
              <label className="field-label">LinkedIn Profile URL</label>
              <input
                name="submitter_linkedin_url"
                placeholder="https://linkedin.com/in/..."
                className="field-input mt-1"
              />
              {err("submitter_linkedin_url")}
            </div>
          </div>
        </fieldset>

        {/* Team */}
        <fieldset className="card space-y-4">
          <legend className="pill-gold -mt-2 mb-2">2. Team</legend>
          <div className="flex gap-2">
            {(["Solo", "Team"] as const).map((opt) => (
              <label
                key={opt}
                className={`flex-1 cursor-pointer rounded-md border px-4 py-3 text-center font-cond text-sm uppercase tracking-wider transition ${
                  mode === opt
                    ? "border-gold bg-gold/10 text-gold"
                    : "border-line bg-ink-4 text-dust hover:border-gold/60"
                }`}
              >
                <input
                  type="radio"
                  name="solo_or_team"
                  value={opt}
                  checked={mode === opt}
                  onChange={() => setMode(opt)}
                  className="sr-only"
                />
                {opt}
              </label>
            ))}
          </div>

          {mode === "Team" && (
            <div className="space-y-4">
              <div>
                <label className="field-label">Team Name *</label>
                <input
                  name="team_name"
                  required
                  className="field-input mt-1"
                />
              </div>

              {[2, 3, 4].map((n) => (
                <div key={n} className="grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="field-label">Member {n} Name</label>
                    <input
                      name={`member${n}_name`}
                      className="field-input mt-1"
                    />
                  </div>
                  <div>
                    <label className="field-label">Member {n} Email</label>
                    <input
                      name={`member${n}_email`}
                      type="email"
                      className="field-input mt-1"
                    />
                    {err(`member${n}_email`)}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div>
            <label className="field-label">Team Size</label>
            <input
              name="team_size"
              type="number"
              min={1}
              max={10}
              defaultValue={mode === "Solo" ? 1 : 2}
              className="field-input mt-1 w-32"
            />
          </div>
        </fieldset>

        {/* Project */}
        <fieldset className="card space-y-4">
          <legend className="pill-gold -mt-2 mb-2">3. Project</legend>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="field-label">Project Name *</label>
              <input name="project_name" required className="field-input mt-1" />
              {err("project_name")}
            </div>
            <div>
              <label className="field-label">Challenge Track *</label>
              <select
                name="challenge_track"
                required
                className="field-input mt-1"
                defaultValue=""
              >
                <option value="">— Select —</option>
                {TRACKS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label">Project Category *</label>
              <input
                name="project_category"
                required
                placeholder="AI for Coding, Mental Health, …"
                className="field-input mt-1"
              />
              {err("project_category")}
            </div>
            <div>
              <label className="field-label">Technologies Used *</label>
              <input
                name="technologies_used"
                required
                placeholder="Python, React, OpenAI API, …"
                className="field-input mt-1"
              />
              {err("technologies_used")}
            </div>
          </div>

          <div>
            <label className="field-label">
              Project Description * <span className="text-dust">(min 30 chars)</span>
            </label>
            <textarea
              name="project_description"
              required
              rows={5}
              minLength={30}
              className="field-input mt-1"
            />
            {err("project_description")}
          </div>

          <div>
            <label className="field-label">One-Line Summary * (280 chars)</label>
            <input
              name="project_description_summary"
              required
              maxLength={280}
              className="field-input mt-1"
            />
            {err("project_description_summary")}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="field-label">GitHub URL</label>
              <input name="github_url" className="field-input mt-1" />
              {err("github_url")}
            </div>
            <div>
              <label className="field-label">Live Demo URL</label>
              <input name="live_demo_url" className="field-input mt-1" />
              {err("live_demo_url")}
            </div>
          </div>
        </fieldset>

        {/* Demo Video — prominent, red-accented */}
        <fieldset className="card space-y-4 border-blood/50 bg-gradient-to-br from-blood/5 to-transparent">
          <legend className="inline-flex items-center gap-2 rounded-full border border-blood/60 bg-blood/20 px-3 py-1 text-[0.7rem] font-bold uppercase tracking-[0.15em] text-blood">
            ▣ Required · Demo Video
          </legend>

          <div className="rounded-md border border-blood/40 bg-ink-4/60 p-3 text-sm leading-relaxed">
            <div className="mb-1 font-cond text-xs font-bold uppercase tracking-wider text-blood">
              ⚠ Disqualification Notice
            </div>
            <p className="text-bone/90">
              A demonstration video <strong>must</strong> accompany this
              submission.{" "}
              <span className="text-gold">Up to 10 minutes.</span> Show{" "}
              <strong>all team members at least once</strong> in the video.
              Submissions with no demo video will be{" "}
              <strong className="text-blood">disqualified</strong>.
            </p>
          </div>

          <div>
            <label className="field-label">
              Demonstration Video (YouTube URL / Vimeo / Loom) *
            </label>
            <input
              name="demo_video_url"
              type="url"
              required
              placeholder="https://youtu.be/…  ·  https://vimeo.com/…  ·  https://loom.com/share/…"
              className="field-input mt-1"
            />
            {err("demo_video_url")}
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-md border border-line bg-ink-4 p-3 hover:border-gold/60">
            <input
              type="checkbox"
              name="all_members_in_video"
              value="checked"
              required
              className="mt-0.5 h-5 w-5 accent-gold"
            />
            <span className="text-sm">
              <span className="font-semibold text-bone">
                I confirm all team members appear in the demo video. *
              </span>
              <span className="block text-xs text-dust">
                Required. If a member is unavailable, please re-record or
                contact the organizers before submitting.
              </span>
            </span>
          </label>
        </fieldset>

        {/* LinkedIn Announcement */}
        <fieldset className="card space-y-4">
          <legend className="pill-gold -mt-2 mb-2">4. LinkedIn Announcement</legend>

          <div className="rounded-md border border-gold/40 bg-gold/5 p-3 text-sm">
            <span className="font-semibold text-gold">Required.</span> You, the
            submitter, must post and follow on LinkedIn announcing your
            participation in the Blackathon, tagging all partners:{" "}
            <a
              href="https://www.linkedin.com/company/nsbe-sf-bay-area-professionals"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-bone underline decoration-gold/60 hover:text-gold"
            >
              NSBE SFBA
            </a>
            ,{" "}
            <a
              href="https://www.linkedin.com/groups/8873861/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-bone underline decoration-gold/60 hover:text-gold"
            >
              Algorythm
            </a>
            ,{" "}
            <a
              href="https://www.linkedin.com/company/blackwpt"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-bone underline decoration-gold/60 hover:text-gold"
            >
              BlackWPT
            </a>
            ,{" "}
            <a
              href="https://www.linkedin.com/company/black-women-in-technology"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-bone underline decoration-gold/60 hover:text-gold"
            >
              Black Women in Tech
            </a>
            , and{" "}
            <a
              href="https://www.linkedin.com/company/-dev-color"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-bone underline decoration-gold/60 hover:text-gold"
            >
              /dev/color
            </a>
            .
          </div>

          <div>
            <label className="field-label">LinkedIn Post URL *</label>
            <input
              name="linkedin_post_url"
              type="url"
              required
              placeholder="https://www.linkedin.com/posts/…"
              className="field-input mt-1"
            />
            {err("linkedin_post_url")}
          </div>
        </fieldset>

        {state?.ok === false && (
          <div className="rounded-md border border-blood/60 bg-blood/10 px-4 py-3 text-sm text-blood">
            {state.error}
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button type="reset" className="btn" disabled={pending}>
            Reset
          </button>
          <button type="submit" className="btn-gold" disabled={pending}>
            {pending ? "Submitting…" : "Review & Submit →"}
          </button>
        </div>
      </form>

      {preview && (
        <ConfirmModal
          values={preview}
          mode={mode}
          onCancel={cancelConfirm}
          onConfirm={confirmAndSend}
          pending={pending}
        />
      )}
    </>
  );
}

function ConfirmModal({
  values,
  mode,
  onCancel,
  onConfirm,
  pending,
}: {
  values: Record<string, string>;
  mode: "Solo" | "Team";
  onCancel: () => void;
  onConfirm: () => void;
  pending: boolean;
}) {
  const row = (k: string, label: string) => {
    const v = values[k];
    if (!v || v.trim() === "") return null;
    return (
      <div className="grid grid-cols-[140px_1fr] gap-3 py-1.5">
        <dt className="text-[0.7rem] uppercase tracking-wider text-dust">
          {label}
        </dt>
        <dd className="text-sm text-bone break-words">{v}</dd>
      </div>
    );
  };

  const members = [2, 3, 4]
    .map((n) => values[`member${n}_name`])
    .filter((v) => v && v.trim() !== "");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-ink/85 p-4 backdrop-blur-sm animate-fade-up"
      role="dialog"
      aria-modal="true"
    >
      <div className="card w-full max-w-2xl border-gold/60">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <div className="pill-gold">Review Your Submission</div>
            <h2 className="hex-title mt-2 text-3xl">One Last Look</h2>
          </div>
          <div className="font-display text-5xl text-gold/30">⬡</div>
        </div>

        <p className="mb-4 text-sm text-dust">
          Once confirmed, your submission is locked in. You can request an edit
          link from the organizers before the deadline if needed.
        </p>

        <div className="max-h-[50vh] space-y-4 overflow-y-auto rounded-md border border-line bg-ink-4 p-4">
          <section>
            <div className="mb-2 font-cond text-xs font-bold uppercase tracking-wider text-gold">
              Submitter
            </div>
            <dl className="divide-y divide-line/60">
              {row("member1_name", "Name")}
              {row("member1_email", "Email")}
              {row("affiliated_org", "Org")}
              {row("submitter_role", "Role")}
              {row("submitter_linkedin_url", "LinkedIn")}
            </dl>
          </section>

          <section>
            <div className="mb-2 font-cond text-xs font-bold uppercase tracking-wider text-gold">
              Team · {mode}
            </div>
            <dl className="divide-y divide-line/60">
              {mode === "Team" && row("team_name", "Team Name")}
              {row("team_size", "Size")}
              {members.length > 0 && (
                <div className="grid grid-cols-[140px_1fr] gap-3 py-1.5">
                  <dt className="text-[0.7rem] uppercase tracking-wider text-dust">
                    Members
                  </dt>
                  <dd className="text-sm text-bone">{members.join(", ")}</dd>
                </div>
              )}
            </dl>
          </section>

          <section>
            <div className="mb-2 font-cond text-xs font-bold uppercase tracking-wider text-gold">
              Project
            </div>
            <dl className="divide-y divide-line/60">
              {row("project_name", "Name")}
              {row("challenge_track", "Track")}
              {row("project_category", "Category")}
              {row("technologies_used", "Tech")}
              {row("project_description_summary", "Summary")}
              {row("project_description", "Description")}
              {row("github_url", "GitHub")}
              {row("live_demo_url", "Live Demo")}
            </dl>
          </section>

          <section>
            <div className="mb-2 font-cond text-xs font-bold uppercase tracking-wider text-blood">
              ▣ Demo Video
            </div>
            <dl className="divide-y divide-line/60">
              {row("demo_video_url", "Video URL")}
              <div className="grid grid-cols-[140px_1fr] gap-3 py-1.5">
                <dt className="text-[0.7rem] uppercase tracking-wider text-dust">
                  All Members
                </dt>
                <dd className="text-sm">
                  {values["all_members_in_video"] === "checked" ? (
                    <span className="text-jade">✓ Confirmed in video</span>
                  ) : (
                    <span className="text-blood">
                      ✗ Not confirmed (may be flagged for review)
                    </span>
                  )}
                </dd>
              </div>
            </dl>
          </section>

          <section>
            <div className="mb-2 font-cond text-xs font-bold uppercase tracking-wider text-gold">
              LinkedIn Announcement
            </div>
            <dl className="divide-y divide-line/60">
              {row("linkedin_post_url", "Post URL")}
            </dl>
          </section>
        </div>

        <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="btn"
          >
            ← Keep Editing
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className="btn-gold"
          >
            {pending ? "Submitting…" : "✔ Confirm & Submit"}
          </button>
        </div>
      </div>
    </div>
  );
}
