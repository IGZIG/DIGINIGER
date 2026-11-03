import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        night: {
          DEFAULT: "#101B3D",
          50: "#EEF1F9",
          100: "#D8DEED",
          200: "#AEB9D6",
          300: "#7C8CB6",
          400: "#4A5C8C",
          500: "#2B3A63",
          600: "#1B2748",
          700: "#141F3E",
          800: "#101B3D",
          900: "#0B1330",
          950: "#070D22",
        },
        electric: {
          DEFAULT: "#2563EB",
          50: "#EFF4FF",
          100: "#DBE6FE",
          200: "#BED0FE",
          300: "#91B1FD",
          400: "#5D88FA",
          500: "#2563EB",
          600: "#1D4FD8",
          700: "#1A3FB0",
          800: "#1B378C",
          900: "#1B3170",
        },
        gold: {
          DEFAULT: "#F59E0B",
          50: "#FFF8EB",
          100: "#FFEFC6",
          200: "#FFDC88",
          300: "#FFC44A",
          400: "#FBAE20",
          500: "#F59E0B",
          600: "#D97C06",
          700: "#B45C09",
          800: "#93480E",
          900: "#793C0F",
        },
        mist: "#F5F7FB",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        display: ["Poppins", "Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        soft: "0 1px 2px rgba(16,27,61,0.04), 0 8px 24px -8px rgba(16,27,61,0.10)",
        card: "0 2px 4px rgba(16,27,61,0.04), 0 18px 40px -24px rgba(16,27,61,0.28)",
        lift: "0 24px 60px -28px rgba(16,27,61,0.42)",
        glow: "0 18px 40px -18px rgba(37,99,235,0.55)",
      },
      borderRadius: { "4xl": "2rem" },
      keyframes: {
        float: {
          "0%,100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-12px)" },
        },
        fadeUp: {
          from: { opacity: "0", transform: "translateY(16px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: { "100%": { transform: "translateX(100%)" } },
        marquee: { from: { transform: "translateX(0)" }, to: { transform: "translateX(-50%)" } },
      },
      animation: {
        float: "float 6s ease-in-out infinite",
        "fade-up": "fadeUp 0.5s cubic-bezier(0.22,1,0.36,1) both",
        shimmer: "shimmer 1.6s infinite",
        marquee: "marquee 32s linear infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
