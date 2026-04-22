import { createClient } from "@/lib/supabase/server";

export type Phase = "submissions" | "judging" | "results";

export async function getPhase(): Promise<Phase> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("event_state")
      .select("phase")
      .eq("id", 1)
      .maybeSingle();
    return (data?.phase as Phase) ?? "submissions";
  } catch {
    return "submissions";
  }
}
