import type { Config } from 'tailwindcss'

export default {
  darkMode: ['class'],
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        border: '#3a3f4a',
        background: '#1f1f23',
        foreground: '#f2f2f4',
        secondary: '#2b2f39',
        muted: '#a1a7b3'
      }
    }
  },
  plugins: []
} satisfies Config
