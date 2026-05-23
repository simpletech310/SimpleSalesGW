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
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-jetbrains)", "ui-monospace", "monospace"],
      },
      colors: {
        // Gateway brand tokens
        "gtn-navy": "var(--gtn-navy)",
        "gtn-navy-2": "var(--gtn-navy-2)",
        "gtn-purple": "var(--gtn-purple)",
        "gtn-purple-2": "var(--gtn-purple-2)",
        "gtn-purple-3": "var(--gtn-purple-3)",
        "gtn-lavender": "var(--gtn-lavender)",
        "gtn-lavender-2": "var(--gtn-lavender-2)",
        "gtn-grey": "var(--gtn-grey)",
        "gtn-grey-2": "var(--gtn-grey-2)",
        "gtn-grey-3": "var(--gtn-grey-3)",
        "gtn-green": "var(--gtn-green)",
        "gtn-green-bg": "var(--gtn-green-bg)",
        "gtn-amber": "var(--gtn-amber)",
        "gtn-red": "var(--gtn-red)",
        "gtn-text": "var(--gtn-text)",

        // shadcn semantic mapped to Gateway
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
        lg: "8px",
        md: "6px",
        sm: "4px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(15, 14, 46, 0.04), 0 4px 12px rgba(15, 14, 46, 0.06)",
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
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [animate],
};

export default config;
