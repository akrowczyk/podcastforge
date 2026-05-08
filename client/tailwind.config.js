/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Pure monochrome scale — Grok-style
        ink: {
          0: "rgba(var(--color-ink-0), <alpha-value>)",
          50: "rgba(var(--color-ink-50), <alpha-value>)",
          100: "rgba(var(--color-ink-100), <alpha-value>)",
          200: "rgba(var(--color-ink-200), <alpha-value>)",
          300: "rgba(var(--color-ink-300), <alpha-value>)",
          400: "rgba(var(--color-ink-400), <alpha-value>)",
          500: "rgba(var(--color-ink-500), <alpha-value>)",
          600: "rgba(var(--color-ink-600), <alpha-value>)",
          700: "rgba(var(--color-ink-700), <alpha-value>)",
          800: "rgba(var(--color-ink-800), <alpha-value>)",
          900: "rgba(var(--color-ink-900), <alpha-value>)",
          950: "rgba(var(--color-ink-950), <alpha-value>)",
        },
        // Subtle accent for active states
        signal: "#FF3B00", // sharp orange-red, used VERY sparingly
      },
      fontFamily: {
        sans: ['"Söhne"', '"Inter"', "system-ui", "sans-serif"],
        display: ['"Söhne"', '"Inter Tight"', "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', '"IBM Plex Mono"', "ui-monospace", "monospace"],
      },
      letterSpacing: {
        tightest: "-0.04em",
        tighter: "-0.02em",
      },
      fontSize: {
        // Display sizes
        "display-xl": ["clamp(3rem, 7vw, 6rem)", { lineHeight: "0.95", letterSpacing: "-0.04em" }],
        "display-lg": ["clamp(2.25rem, 5vw, 4rem)", { lineHeight: "1.0", letterSpacing: "-0.03em" }],
        "display-md": ["clamp(1.75rem, 3.5vw, 2.5rem)", { lineHeight: "1.1", letterSpacing: "-0.025em" }],
      },
      animation: {
        "fade-up": "fadeUp 0.5s cubic-bezier(0.2, 0.8, 0.2, 1) both",
        "pulse-soft": "pulseSoft 2s ease-in-out infinite",
        "scan": "scan 2s linear infinite",
      },
      keyframes: {
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        pulseSoft: {
          "0%, 100%": { opacity: "0.4" },
          "50%": { opacity: "1" },
        },
        scan: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
      },
    },
  },
  plugins: [],
};
