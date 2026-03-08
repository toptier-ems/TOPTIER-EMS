/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        toptier: {
          primary: '#FE5A1D',
          'primary-hover': '#E54E0A',
          'flesh-ochre': '#FE5A1D',
          pumpkin: '#FE7316',
          'west-side': '#FF8D0F',
          'yellow-sea': '#FFA607',
          amber: '#FFBF00',
          surface: '#ffffff',
          sidebar: '#f8fafc',
          'sidebar-border': '#e2e8f0',
          muted: '#64748b',
          foreground: '#0f172a',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        'card': '8px',
      },
      boxShadow: {
        'card': '0 1px 3px 0 rgb(0 0 0 / 0.05)',
        'modal': '0 4px 6px -1px rgb(0 0 0 / 0.08), 0 2px 4px -2px rgb(0 0 0 / 0.05)',
      },
    },
  },
  plugins: [],
}
