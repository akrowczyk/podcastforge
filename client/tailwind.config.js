/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Pure monochrome scale — Grok-style
        ink: {
          0: "#FFFFFF",
          50: "#FAFAFA",
          100: "#F4F4F4",
          200: "#E5E5E5",
          300: "#D4D4D4",
          400: "#A3A3A3",
          500: "#737373",
          600: "#525252",
          700: "#404040",
          800: "#262626",
          900: "#171717",
          950: "#0A0A0A",
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
