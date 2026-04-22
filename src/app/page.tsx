import Image from "next/image";
import Link from "next/link";
import { HeaderBar, PageShell } from "@/components/shell";
import { getPhase } from "@/lib/phase";

export const dynamic = "force-dynamic";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const phase = await getPhase();
  const sp = await searchParams;
  const errorCode = typeof sp.error_code === "string" ? sp.error_code : null;
  const errorDesc =
    typeof sp.error_description === "string" ? sp.error_description : null;

  const phaseCopy = {
    submissions: {
      eyebrow: "Phase 1 · Submissions Open",
      action: "Submit Your Project",
      href: "/submit",
      blurb:
        "Teams, it's your time. Drop your project, your demo, and your name in the ring.",
    },
    judging: {
      eyebrow: "Phase 2 · Judging In Progress",
      action: "Judge Sign In",
      href: "/judge",
      blurb:
        "Submissions are locked. Judges are scoring across six categories.",
    },
    results: {
      eyebrow: "Phase 3 · Results Revealed",
      action: "View Top 6",
      href: "/results",
      blurb: "The top 6 have been crowned. See the full leaderboard.",
    },
  }[phase];

  return (
    <>
      <HeaderBar
        rightSlot={
          <Link href="/admin" className="pill hover:border-gold hover:text-gold">
            Admin
          </Link>
        }
      />
      <PageShell maxWidth="max-w-3xl">
        {errorCode && (
          <div className="mb-6 rounded-md border border-blood/60 bg-blood/10 p-4 text-sm text-blood animate-fade-up">
            <div className="font-cond font-bold uppercase tracking-wider">
              Sign-in link issue
            </div>
            <p className="mt-1 text-bone/90">
              {errorDesc ?? "The magic link couldn't be used."} Request a fresh
              link at{" "}
              <Link href="/judge" className="text-gold underline">
                /judge
              </Link>{" "}
              and click it within a few minutes.
            </p>
          </div>
        )}
        <div className="flex flex-col items-center py-10 text-center md:py-20">
          <div className="mb-6 animate-fade-up">
            BlackWPT Hackathon · April 24, 2026
          </div>
          <div className="relative mb-6 flex h-24 w-24 items-center justify-center animate-fade-up">
            <div className="absolute inset-0 animate-pulse rounded-full border border-gold/30" />
            <div className="absolute -inset-3 rounded-full border border-gold/10" />
          </div>
          <Image
            src="/blackathon_text_final.png"
            alt="Blackathon"
            width={700}
            height={83}
            priority
            className="h-16 w-auto animate-fade-up drop-shadow-[0_0_30px_rgba(245,197,24,.25)] md:h-24"
          />
          <div className="mt-5 flex items-center gap-3 text-xs uppercase tracking-[0.35em] text-dust animate-fade-up">
            <span className="h-px w-10 bg-line" />
            <span>Score Card System</span>
            <span className="h-px w-10 bg-line" />
          </div>
          <p className="mt-8 max-w-lg animate-fade-up text-dust">
            {phaseCopy.blurb}
          </p>
          <div className="mt-3 animate-fade-up font-cond text-[0.7rem] uppercase tracking-[0.3em] text-gold">
            {phaseCopy.eyebrow}
          </div>
          <Link
            href={phaseCopy.href}
            className="btn-gold mt-8 h-14 px-10 text-base animate-fade-up"
          >
            {phaseCopy.action} →
          </Link>
          <div className="mt-10 h-[2px] w-32 rounded bg-gradient-to-r from-blood via-gold to-jade opacity-70" />
        </div>
      </PageShell>
    </>
  );
}
