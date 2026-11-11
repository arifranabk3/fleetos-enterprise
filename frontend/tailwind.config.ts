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
        // Master Prompt Visual Direction
        navy: {
          sidebar: '#17263C', // Deep Navy
          800: '#1A2D47',
          900: '#17263C',
          950: '#0E1724',
        },
        graphite: {
          accent: '#283544', // Graphite
          50: '#F4F6F8',    // Soft background
          100: '#E8ECF0',
          200: '#D1D7DE',
          300: '#94A3B8',
          600: '#64748B',   // Secondary text
          700: '#475569',
          900: '#1F2937',   // Primary text
        },
        fleet: {
          orange: '#F28C45',      // Orange accent
          orangeHover: '#DE7830',
          orangeSoft: '#FEF3EB',
        },
        status: {
          success: '#198754',
          warning: '#D99A28',
          danger: '#D9534F',
          info: '#0D6EFD',
        },
      },
      boxShadow: {
        card: '0 1px 3px 0 rgba(23, 38, 60, 0.05), 0 1px 2px 0 rgba(23, 38, 60, 0.03)',
        elevated: '0 10px 25px -5px rgba(23, 38, 60, 0.08), 0 8px 10px -6px rgba(23, 38, 60, 0.03)',
      },
    },
  },
  plugins: [],
};
export default config;
