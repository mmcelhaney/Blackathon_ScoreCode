export type RubricCategory =
  | "idea"
  | "creativity"
  | "build_quality"
  | "ux"
  | "presentation"
  | "impact";

export const RUBRIC: {
  key: RubricCategory;
  label: string;
  blurb: string;
  iceBreaker?: boolean;
}[] = [
  {
    key: "idea",
    label: "Idea",
    blurb: "Problem worth solving. Clear premise.",
  },
  {
    key: "creativity",
    label: "Creativity",
    blurb: "Original thinking, non-obvious approach.",
  },
  {
    key: "build_quality",
    label: "Build Quality",
    blurb: "Engineering craft. Works as advertised.",
  },
  {
    key: "ux",
    label: "User Experience",
    blurb: "Usable, polished, accessible.",
  },
  {
    key: "presentation",
    label: "Presentation",
    blurb: "Demo, pitch, and story land.",
  },
  {
    key: "impact",
    label: "Impact",
    blurb: "Ice-breaker — used for tie resolution only.",
    iceBreaker: true,
  },
];

export const SCORE_LABELS: Record<number, string> = {
  1: "Weak",
  2: "",
  3: "Fair",
  4: "",
  5: "Solid",
  6: "",
  7: "Strong",
  8: "",
  9: "",
  10: "Elite",
};
