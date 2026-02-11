Objective:  1. Configure Color Palette (Tailwind), refer to the following Global Design System

import type { Config } from "tailwindcss";

const config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        
        // --- GLOBAL DESIGN SYSTEM PALETTE ---
        primary: {
          DEFAULT: "#4f46e5", // Indigo 600
          foreground: "#ffffff",
        },
        destructive: {
          DEFAULT: "#e11d48", // Rose 600
          foreground: "#ffffff",
        },
        success: {
          DEFAULT: "#059669", // Emerald 600
          foreground: "#ffffff",
        },
        warning: {
          DEFAULT: "#d97706", // Amber 600
          foreground: "#ffffff",
        },
        // -----------------------------------
        
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;

export default config;


Tech Stack: Refer to Architecture.md


## Contraints
- Skil Backend Stack and Persistent Layer initialization
- Follow all rules in CLAUDE.md, ARCHITECTURE.md, CODING_RULES.md, and TASKS.md.
