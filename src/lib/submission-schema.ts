import { z } from "zod";

const url = z
  .string()
  .trim()
  .url({ message: "Must be a valid URL" })
  .or(z.literal(""));

export const submissionSchema = z.object({
  // contestant
  member1_name: z.string().trim().min(2, "Full name required"),
  member1_email: z.string().trim().email("Valid email required"),
  submitter_linkedin_url: url.optional().default(""),
  affiliated_org: z.string().trim().default(""),
  submitter_role: z.string().trim().default(""),

  solo_or_team: z.enum(["Solo", "Team"]),
  team_name: z.string().trim().default(""),

  member2_name: z.string().trim().default(""),
  member2_email: z
    .string()
    .trim()
    .email("Invalid email")
    .or(z.literal(""))
    .default(""),
  member3_name: z.string().trim().default(""),
  member3_email: z
    .string()
    .trim()
    .email("Invalid email")
    .or(z.literal(""))
    .default(""),
  member4_name: z.string().trim().default(""),
  member4_email: z
    .string()
    .trim()
    .email("Invalid email")
    .or(z.literal(""))
    .default(""),

  // project
  project_name: z.string().trim().min(2, "Project name required"),
  challenge_track: z.string().trim().default(""),
  project_category: z.string().trim().default(""),
  project_description: z.string().trim().min(30, "Please write at least 30 characters"),
  project_description_summary: z.string().trim().max(280, "Keep it under 280 chars").default(""),
  technologies_used: z.string().trim().default(""),

  github_url: url.optional().default(""),
  live_demo_url: url.optional().default(""),
  demo_video_url: url.optional().default(""),
  linkedin_post_url: url.optional().default(""),
  all_members_in_video: z.string().trim().default(""),
  team_size: z.coerce.number().int().min(1).max(10).default(1),
});

export type SubmissionInput = z.infer<typeof submissionSchema>;
