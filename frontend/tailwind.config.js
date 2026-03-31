/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Funnel Sans"', 'system-ui', '-apple-system', 'sans-serif'],
        heading: ['"Funnel Sans"', 'system-ui', '-apple-system', 'sans-serif'],
      },
      colors: {
        // Neutrals from design guide (950=deepest body bg, 900=card surfaces)
        neutral: {
          50: '#ffffff',
          100: '#f3f4f6',
          200: '#e5e7eb',
          300: '#c0c5cb',
          400: '#848586',
          500: '#5e6366',
          600: '#47494a',
          700: '#35393b',
          800: '#292b2c',
          850: '#1e2022',
          900: '#151819',
          950: '#0a0c0d',
        },
        // Brand: Blue - Growth/Marketing
        blue: {
          100: '#cbe1ff',
          200: '#a1cbff',
          300: '#72adff',
          400: '#4a93f7',
          500: '#247af2',
          600: '#1560c7',
          700: '#074191',
          800: '#042655',
          900: '#021a3a',
        },
        // Brand: Purple - Websites
        purple: {
          100: '#f2d8ff',
          200: '#e7b8ff',
          300: '#dc96ff',
          400: '#cc6af7',
          500: '#b53df2',
          600: '#932cc7',
          700: '#7317a2',
          800: '#530f74',
          900: '#370c4c',
        },
        // Brand: Red - Creative
        red: {
          100: '#ffd8d0',
          200: '#ffb3a1',
          300: '#ff8971',
          400: '#f25c3a',
          500: '#e5300b',
          600: '#b5260a',
          700: '#7d1c08',
          800: '#581306',
          900: '#481106',
        },
        // Semantic colors
        success: {
          100: '#dcfae6',
          500: '#17b26a',
          900: '#074d31',
        },
        warning: {
          100: '#fef0c7',
          500: '#f79009',
          900: '#7a2e0e',
        },
        error: {
          100: '#fee4e2',
          500: '#f04438',
          900: '#7a271a',
        },
        // Keep pastel aliases for backward compatibility
        pastel: {
          mint: '#17b26a',
          lavender: '#b53df2',
          peach: '#ff8971',
          sky: '#247af2',
          rose: '#ff8971',
          lemon: '#f79009',
          coral: '#e5300b',
        },
        // Keep 'dark' for backward compatibility
        dark: {
          50: '#ffffff',
          100: '#f3f4f6',
          200: '#e5e7eb',
          300: '#c0c5cb',
          400: '#848586',
          500: '#5e6366',
          600: '#47494a',
          700: '#35393b',
          800: '#292b2c',
          900: '#151819',
          950: '#0a0c0d',
        },
        // Primary maps to blue (growth/marketing)
        primary: {
          50: '#e8f2ff',
          100: '#cbe1ff',
          200: '#a1cbff',
          300: '#72adff',
          400: '#4a93f7',
          500: '#247af2',
          600: '#1560c7',
          700: '#074191',
          800: '#042655',
          900: '#021a3a',
        },
        // Secondary maps to purple (websites)
        secondary: {
          50: '#faf0ff',
          100: '#f2d8ff',
          200: '#e7b8ff',
          300: '#dc96ff',
          400: '#cc6af7',
          500: '#b53df2',
          600: '#932cc7',
          700: '#7317a2',
          800: '#530f74',
          900: '#370c4c',
        },
      },
      backgroundImage: {
        'gradient-subtle': 'linear-gradient(to bottom, #0a0c0d, #060708)',
        'gradient-blue': 'linear-gradient(135deg, #247af2, #074191)',
        'gradient-purple': 'linear-gradient(135deg, #b53df2, #7317a2)',
        'gradient-red': 'linear-gradient(135deg, #e5300b, #7d1c08)',
        'gradient-brand': 'linear-gradient(90deg, #247af2, #b53df2, #e5300b)',
      },
      boxShadow: {
        'soft': '0 2px 8px rgba(0, 0, 0, 0.25)',
        'soft-lg': '0 4px 16px rgba(0, 0, 0, 0.35)',
        'inner-soft': 'inset 0 1px 2px rgba(0, 0, 0, 0.15)',
        'blue': '0 4px 16px rgba(36, 122, 242, 0.15)',
        'purple': '0 4px 16px rgba(181, 61, 242, 0.15)',
        'red': '0 4px 16px rgba(229, 48, 11, 0.15)',
      },
      borderRadius: {
        'xl': '1rem',
        '2xl': '1.25rem',
      }
    },
  },
  plugins: [],
}
