import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        gold: {
          DEFAULT: "#F5C518",
          dark: "#D4A017",
          deep: "#A37810",
        },
        blood: "#C0392B",
        jade: "#27AE60",
        ink: {
          DEFAULT: "#0D0D0D",
          2: "#141414",
          3: "#1A1A1A",
          4: "#222222",
          5: "#2A2A2A",
        },
        bone: "#F0E6CC",
        dust: "#7A7060",
        line: "#333333",
      },
      fontFamily: {
        display: ["var(--font-bebas)", "Impact", "sans-serif"],
        cond: ["var(--font-barlow-cond)", "system-ui", "sans-serif"],
        body: ["var(--font-barlow)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 4px 24px rgba(0,0,0,.45)",
        gold: "0 0 30px rgba(245,197,24,.25)",
      },
      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(12px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-up": "fade-up .6s cubic-bezier(.16,1,.3,1) both",
      },
    },
  },
  plugins: [],
} satisfies Config;
