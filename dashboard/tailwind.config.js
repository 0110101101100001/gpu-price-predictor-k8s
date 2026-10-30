/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f0f9ff",
          100: "#e0f2fe",
          500: "#0ea5e9",
          600: "#0284c7",
          900: "#0c4a6e",
        },
        success: {
          500: "#22c55e",
          600: "#16a34a",
        },
        danger: {
          500: "#ef4444",
          600: "#dc2626",
        },
        warning: {
          500: "#f59e0b",
          600: "#d97706",
        },
        gray: {
          950: "#0f172a",
          900: "#1e293b",
          800: "#334155",
          700: "#475569",
          600: "#64748b",
          500: "#94a3b8",
          400: "#cbd5e1",
          300: "#e2e8f0",
          200: "#f1f5f9",
          100: "#f8fafc",
          50: "#f9fafb",
        },
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.5rem",
        "3xl": "2rem",
      },
      boxShadow: {
        soft: "0 4px 20px -4px rgba(0, 0, 0, 0.06)",
        card: "0 1px 3px 0 rgba(0, 0, 0, 0.08), 0 1px 2px -1px rgba(0, 0, 0, 0.08)",
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
        mono: ["Geist Mono", "monospace"],
      },
    },
  },
  plugins: [],
};
