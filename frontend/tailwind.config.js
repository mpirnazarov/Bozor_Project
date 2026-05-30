/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#0066ff",
          dark: "#0a2540",
          hover: "#0052cc",
          50: "#eaf2ff",
          100: "#d6e6ff",
          600: "#0052cc",
          700: "#0040a0",
        },
        status: {
          paid: "#16a34a",
          partial: "#eab308",
          unpaid: "#dc2626",
          nodata: "#9ca3af",
        },
        ink: { DEFAULT: "#0a1628", soft: "#475569", faint: "#94a3b8" },
        surface: { DEFAULT: "#ffffff", muted: "#f6f8fc", sunken: "#eef2f9" },
      },
      fontFamily: {
        sans: ["Plus Jakarta Sans", "Inter", "system-ui", "sans-serif"],
        display: ["Sora", "Plus Jakarta Sans", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      boxShadow: {
        soft: "0 1px 2px rgba(10,22,40,0.04), 0 4px 16px rgba(10,22,40,0.06)",
        card: "0 2px 4px rgba(10,22,40,0.04), 0 12px 32px -8px rgba(10,22,40,0.10)",
        float: "0 8px 24px -6px rgba(10,22,40,0.16), 0 24px 48px -12px rgba(10,22,40,0.14)",
        glow: "0 0 0 1px rgba(0,102,255,0.12), 0 8px 28px -6px rgba(0,102,255,0.35)",
        inset: "inset 0 1px 0 rgba(255,255,255,0.6)",
      },
      borderRadius: { xl: "0.875rem", "2xl": "1.25rem", "3xl": "1.75rem" },
      backgroundImage: {
        "brand-grad": "linear-gradient(135deg, #0066ff 0%, #00a3ff 100%)",
        "brand-mesh":
          "radial-gradient(at 0% 0%, rgba(0,102,255,0.12) 0px, transparent 50%), radial-gradient(at 100% 0%, rgba(0,163,255,0.10) 0px, transparent 50%), radial-gradient(at 100% 100%, rgba(10,37,64,0.08) 0px, transparent 50%)",
        "dark-mesh":
          "radial-gradient(at 0% 0%, #0a2540 0px, transparent 55%), radial-gradient(at 100% 100%, #0a3a6b 0px, transparent 55%)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
        "scale-in": {
          "0%": { opacity: "0", transform: "scale(0.96)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        float: {
          "0%,100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.5s cubic-bezier(0.16,1,0.3,1) both",
        "fade-in": "fade-in 0.4s ease both",
        "scale-in": "scale-in 0.35s cubic-bezier(0.16,1,0.3,1) both",
        shimmer: "shimmer 2s linear infinite",
        float: "float 6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
