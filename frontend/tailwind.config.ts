import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Deep navy
        navy: {
          50: '#F0F4F8',
          100: '#D9E2EC',
          200: '#BCCCDC',
          300: '#9FB3C8',
          400: '#829AB1',
          500: '#627D98',
          600: '#486581',
          700: '#334E68',
          800: '#102A43',
          900: '#0B1D33',
          950: '#071324',
        },
        // Graphite
        graphite: {
          50: '#F5F7FA',
          100: '#E4E7EB',
          200: '#CBD2D9',
          300: '#9AA5B1',
          400: '#7B8794',
          500: '#616E7C',
          600: '#52606D',
          700: '#3E4C59',
          800: '#323F4B',
          900: '#1F2933',
        },
        // Muted Orange Accent
        fleet: {
          orange: '#F97316',
          orangeHover: '#EA580C',
          orangeSoft: '#FFEDD5',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 3px 0 rgba(11, 29, 51, 0.06), 0 1px 2px 0 rgba(11, 29, 51, 0.04)',
        elevated: '0 10px 25px -5px rgba(11, 29, 51, 0.08), 0 8px 10px -6px rgba(11, 29, 51, 0.04)',
      },
    },
  },
  plugins: [],
};
export default config;

