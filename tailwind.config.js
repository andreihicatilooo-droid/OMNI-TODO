/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        theme: {
          bg: 'var(--bg-primary)',
          panel: 'var(--bg-secondary)',
          text: 'var(--text-primary)',
          muted: 'var(--text-secondary)',
          accent: 'var(--accent-color)',
          'accent-hover': 'var(--accent-hover)',
          border: 'var(--border-color)',
        }
      }
    },
  },
  plugins: [],
}
