/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: 'var(--bg-color)', 
        surface: 'var(--surface-color)',
        element: 'var(--element-bg)',
        elementHover: 'var(--element-hover)',
        danger: 'var(--danger-bg)',
        dangerText: 'var(--danger-text)',
        primary: 'var(--primary-color)',    
        primaryDark: 'var(--primary-dark-color)',
        primaryText: 'var(--primary-text)',
        secondary: 'var(--secondary-color)',  
        textMain: 'var(--text-main)',
        textMuted: 'var(--text-muted)',
        panelBorder: 'var(--border-color)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'gradient-x': 'gradient-x 15s ease infinite',
        'float': 'float 6s ease-in-out infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        'gradient-x': {
          '0%, 100%': {
            'background-size': '200% 200%',
            'background-position': 'left center'
          },
          '50%': {
            'background-size': '200% 200%',
            'background-position': 'right center'
          },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'glow': {
          '0%': { boxShadow: '0 0 10px var(--primary-color-transparent)' },
          '100%': { boxShadow: '0 0 30px var(--primary-color-glow)' },
        }
      }
    },
  },
  plugins: [],
}
