import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Breadcrumbs, HeaderBar, PageShell, SectionTitle } from "@/components/shell";
import { getPhase } from "@/lib/phase";
import { createClient } from "@/lib/supabase/server";
import { JudgeSignIn } from "./sign-in";

export const dynamic = "force-dynamic";

export default async function JudgePage() {
  const phase = await getPhase();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    // Confirm they're on the judges roster
    const { data: judge } = await supabase
      .from("judges")
      .select("id, name, is_active")
      .eq("auth_user_id", user.id)
      .maybeSingle();
    if (judge?.is_active) redirect("/judge/dashboard");
    // Signed in but not on roster: kick them back with a message
  }

  return (
    <>
      <HeaderBar
        rightSlot={
          <Link href="/" className="pill hover:border-gold hover:text-gold">
            ← Home
          </Link>
        }
      />
      <PageShell maxWidth="max-w-md">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Judge Sign In" },
          ]}
        />
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
          eyebrow={phase === "judging" ? "Phase 2 · Judging Open" : `Phase: ${phase}`}
          title="Judge Sign In"
          subtitle="We'll email you a one-time link. Only emails on the judges roster will work."
        />
        <JudgeSignIn unauthorized={!!user} />
      </PageShell>
    </>
  );
}
