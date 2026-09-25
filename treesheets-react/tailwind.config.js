/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        dark: {
          bg: 'var(--color-bg)',
          surface: 'var(--color-surface)',
          surfaceHover: 'var(--color-surfaceHover)',
          border: 'var(--color-border)',
          text: 'var(--color-text)',
          muted: 'var(--color-muted)',
        },
      },
    },
  },
  plugins: [],
};
