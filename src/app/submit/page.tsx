import Link from "next/link";
import { Breadcrumbs, HeaderBar, PageShell, SectionTitle } from "@/components/shell";
import { getPhase } from "@/lib/phase";
import { SubmitForm } from "./submit-form";

export const dynamic = "force-dynamic";

export default async function SubmitPage() {
  const phase = await getPhase();

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
            { label: "Submit" },
          ]}
        />
        {phase !== "submissions" ? (
          <div className="mx-auto max-w-xl text-center">
            <SectionTitle
              eyebrow="Submissions Closed"
              title="You're Past The Buzzer"
              subtitle="Submissions are no longer being accepted. If you're a registered judge, head to your scoring dashboard."
            />
            <div className="flex justify-center gap-3">
              <Link href="/" className="btn">← Home</Link>
              <Link href="/judge" className="btn-gold">Judge Sign In</Link>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-8 animate-fade-up">
              <div className="pill-gold mb-3">Phase 1 · Submissions Open</div>
              <h1 className="hex-title text-4xl md:text-5xl">
                Blackathon Project Submission Form
              </h1>
              <div className="mt-4 h-[2px] w-28 rounded bg-gradient-to-r from-blood via-gold to-jade opacity-70" />
            </div>

            <div className="card mb-6 space-y-3 border-l-4 border-l-gold">
              <div className="flex flex-wrap items-center gap-3">
                <span className="pill-gold">⏰ Deadline</span>
                <span className="font-cond text-base font-semibold uppercase tracking-wider text-bone">
                  Submissions close 4/26 at 10:00 AM PST
                </span>
              </div>
              <p className="text-sm leading-relaxed text-bone/90">
                All required fields must be complete for your entry to be
                reviewed. <strong className="text-gold">One submission per team
                or solo participant.</strong> Please ensure all participant, team,
                project demo, and LinkedIn post details are included.
              </p>
              <p className="text-xs text-dust">
                Need help? Email{" "}
                <a
                  href="mailto:info@blackwpt.com"
                  className="text-gold underline"
                >
                  info@blackwpt.com
                </a>
                .
              </p>
            </div>

            <SubmitForm />
          </>
        )}
      </PageShell>
    </>
  );
}
