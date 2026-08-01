/** @type {import('tailwindcss').Config} */

// Commercial Bank of Ethiopia identity: deep purple as the primary brand
// color, warm gold as the accent (used on CTAs, highlights, active states).
// These are close approximations of CBE's well-known visual identity —
// swap in exact hex codes here if you have an official brand guide.
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Poppins", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        brand: {
          50: "#f4eefa", 100: "#e6d7f2", 200: "#cdaee5", 300: "#b085d8",
          400: "#8f5cc4", 500: "#6d3aa8", 600: "#5b2a83", 700: "#4a2169",
          800: "#3a1a53", 900: "#2a1339",
        },
        gold: {
          50: "#fffaeb", 100: "#fef0c7", 200: "#fde08a", 300: "#fbc94d",
          400: "#f9b826", 500: "#f2a900", 600: "#cc8b00", 700: "#a36e00",
          800: "#7a5300", 900: "#523700",
        },
      },
      boxShadow: {
        card: "0 1px 3px 0 rgb(0 0 0 / 0.08), 0 1px 2px -1px rgb(0 0 0 / 0.08)",
        glow: "0 8px 30px -8px rgb(91 42 131 / 0.35)",
      },
      backgroundImage: {
        "brand-gradient": "linear-gradient(135deg, #5b2a83 0%, #4a2169 60%, #2a1339 100%)",
      },
    },
  },
  plugins: [],
};
