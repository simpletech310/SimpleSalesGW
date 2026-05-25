import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "1rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: ["var(--font-carlito)", "var(--font-inter)", "system-ui", "sans-serif"],
        carlito: ["var(--font-carlito)", "system-ui", "sans-serif"],
        inter: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-jetbrains)", "ui-monospace", "monospace"],
      },
      fontSize: {
        // v3.0 — refined-SaaS type scale (Carlito throughout)
        // [size, { lineHeight, letterSpacing }]
        "2xs":  ["11px", { lineHeight: "1.3", letterSpacing: "0.02em" }],
        xs:    ["12px", { lineHeight: "1.4" }],
        sm:    ["13px", { lineHeight: "1.5" }],
        base:  ["14px", { lineHeight: "1.55" }],
        lg:    ["16px", { lineHeight: "1.5" }],
        xl:    ["20px", { lineHeight: "1.35", letterSpacing: "-0.005em" }],
        "2xl": ["24px", { lineHeight: "1.25", letterSpacing: "-0.01em" }],
        "3xl": ["30px", { lineHeight: "1.2",  letterSpacing: "-0.015em" }],
        "4xl": ["36px", { lineHeight: "1.15", letterSpacing: "-0.02em" }],
        "5xl": ["44px", { lineHeight: "1.1",  letterSpacing: "-0.022em" }],
      },
      colors: {
        // ---- Gateway brand tokens (v2.4 — kept verbatim for print) ----
        "gtn-navy": "var(--gtn-navy)",
        "gtn-navy-2": "var(--gtn-navy-2)",
        "gtn-navy-3": "var(--gtn-navy-3)",
        "gtn-purple": "var(--gtn-purple)",
        "gtn-purple-2": "var(--gtn-purple-2)",
        "gtn-purple-3": "var(--gtn-purple-3)",
        "gtn-lilac": "var(--gtn-lilac)",
        "gtn-eyebrow": "var(--gtn-eyebrow)",
        "gtn-lavender": "var(--gtn-lavender)",
        "gtn-lavender-2": "var(--gtn-lavender-2)",
        "gtn-callout-bg": "var(--gtn-callout-bg)",
        "gtn-grey": "var(--gtn-grey)",
        "gtn-grey-2": "var(--gtn-grey-2)",
        "gtn-grey-3": "var(--gtn-grey-3)",
        "gtn-green": "var(--gtn-green)",
        "gtn-green-bg": "var(--gtn-green-bg)",
        "gtn-amber": "var(--gtn-amber)",
        "gtn-amber-bg": "var(--gtn-amber-bg)",
        "gtn-red": "var(--gtn-red)",
        "gtn-red-bg": "var(--gtn-red-bg)",
        "gtn-text": "var(--gtn-text)",

        // ---- v3.0 semantic neutrals (refined SaaS surface system) ----
        surface: {
          DEFAULT: "var(--surface)",
          2: "var(--surface-2)",
          3: "var(--surface-3)",
          sunken: "var(--surface-sunken)",
        },
        ink: {
          strong: "var(--text-strong)",
          DEFAULT: "var(--text)",
          muted: "var(--text-muted)",
          faint: "var(--text-faint)",
          inverse: "var(--text-inverse)",
        },
        line: {
          subtle: "var(--border-subtle)",
          DEFAULT: "var(--border)",
          strong: "var(--border-strong)",
        },
        brand: {
          DEFAULT: "var(--brand-accent)",
          soft: "var(--brand-accent-soft)",
        },
        success: { DEFAULT: "var(--success)", soft: "var(--success-bg)" },
        warn:    { DEFAULT: "var(--warn)",    soft: "var(--warn-bg)" },
        danger:  { DEFAULT: "var(--danger)",  soft: "var(--danger-bg)" },
        info:    { DEFAULT: "var(--info)",    soft: "var(--info-bg)" },

        // ---- shadcn semantic — HSL channels mapped to v3.0 ----
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
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
        sm: "4px",
        md: "6px",
        lg: "8px",
        xl: "12px",
        "2xl": "16px",
      },
      boxShadow: {
        // v3.0 — two-step elevation
        card: "0 1px 0 rgba(15, 14, 46, 0.03), 0 1px 2px rgba(15, 14, 46, 0.04)",
        pop:  "0 6px 20px rgba(15, 14, 46, 0.08), 0 2px 6px rgba(15, 14, 46, 0.06)",
        ring: "0 0 0 4px rgba(91, 79, 207, 0.18)",
      },
      transitionTimingFunction: {
        smooth: "cubic-bezier(.2,.8,.2,1)",
      },
      transitionDuration: {
        120: "120ms",
        220: "220ms",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(.96)" },
          to:   { opacity: "1", transform: "scale(1)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in":  "fade-in 220ms cubic-bezier(.2,.8,.2,1)",
        "scale-in": "scale-in 150ms cubic-bezier(.2,.8,.2,1)",
      },
    },
  },
  plugins: [animate],
};

export default config;
