/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Neutral grays - slightly brighter
        neutral: {
          50: '#fafafa',
          100: '#f4f4f5',
          200: '#e4e4e7',
          300: '#d4d4d8',
          400: '#a1a1aa',
          500: '#78788c',
          600: '#5c5c6e',
          700: '#484858',
          800: '#32323e',
          850: '#292934',
          900: '#1e1e26',
          950: '#141418',
        },
        // Modern pastel accents - slightly more vibrant
        pastel: {
          mint: '#86efac',      // brighter green
          lavender: '#c4b5fd',  // soft purple
          peach: '#fda4af',     // brighter coral
          sky: '#7dd3fc',       // brighter blue
          rose: '#fda4af',      // brighter pink
          lemon: '#fde047',     // brighter yellow
          coral: '#fb7185',     // vibrant coral
        },
        // Primary accent (muted sage/mint)
        primary: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#a7f3d0',
          400: '#6ee7b7',
          500: '#4ade80',
          600: '#22c55e',
          700: '#16a34a',
          800: '#166534',
          900: '#14532d',
        },
        // Secondary accent (muted lavender)
        secondary: {
          50: '#faf5ff',
          100: '#f3e8ff',
          200: '#e9d5ff',
          300: '#c4b5fd',
          400: '#a78bfa',
          500: '#8b5cf6',
          600: '#7c3aed',
          700: '#6d28d9',
          800: '#5b21b6',
          900: '#4c1d95',
        },
        // Keep 'dark' for backward compatibility
        dark: {
          50: '#fafafa',
          100: '#f4f4f5',
          200: '#e4e4e7',
          300: '#d4d4d8',
          400: '#a1a1aa',
          500: '#78788c',
          600: '#5c5c6e',
          700: '#484858',
          800: '#32323e',
          900: '#1e1e26',
          950: '#141418',
        },
      },
      backgroundImage: {
        'gradient-subtle': 'linear-gradient(to bottom, #18181b, #0f0f12)',
      },
      boxShadow: {
        'soft': '0 2px 8px rgba(0, 0, 0, 0.15)',
        'soft-lg': '0 4px 16px rgba(0, 0, 0, 0.2)',
        'inner-soft': 'inset 0 1px 2px rgba(0, 0, 0, 0.1)',
      },
      borderRadius: {
        'xl': '1rem',
        '2xl': '1.25rem',
      }
    },
  },
  plugins: [],
}
