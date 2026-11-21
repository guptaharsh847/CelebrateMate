/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f6f2fd',
          100: '#ede5fa',
          200: '#dccdf4',
          300: '#c2a9ea',
          400: '#a07fdb',
          500: '#7954C8',
          600: '#6844b4',
          700: '#573893',
          800: '#472f77',
          900: '#3b2862',
        },
        ink: {
          DEFAULT: '#1d1b26',
          muted: '#5f5b6d',
          subtle: '#8d8a99',
        },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 1px 2px rgba(29, 27, 38, 0.04), 0 4px 16px rgba(29, 27, 38, 0.05)',
        lift: '0 2px 4px rgba(29, 27, 38, 0.05), 0 12px 32px rgba(29, 27, 38, 0.09)',
        nav: '0 -4px 24px rgba(29, 27, 38, 0.06)',
      },
      borderRadius: {
        '2xl': '1.125rem',
        '3xl': '1.5rem',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'slide-up': { from: { transform: 'translateY(16px)', opacity: '0' }, to: { transform: 'translateY(0)', opacity: '1' } },
      },
      animation: {
        'fade-in': 'fade-in 150ms ease-out',
        'slide-up': 'slide-up 200ms cubic-bezier(0.2, 0.8, 0.2, 1)',
      },
    },
  },
  plugins: [],
};
