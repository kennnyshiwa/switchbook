import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brown: {
          100: '#D7CCC8',
          800: '#5D4037',
        },
      },
    },
  },
  safelist: [
    // Ensure all switch type colors are included in the build
    'bg-red-100', 'text-red-800', 'dark:bg-red-800', 'dark:text-red-200',
    'bg-orange-100', 'text-orange-800', 'dark:bg-orange-800', 'dark:text-orange-200',
    'bg-blue-100', 'text-blue-800', 'dark:bg-blue-800', 'dark:text-blue-200',
    'bg-gray-100', 'text-gray-800', 'dark:bg-gray-700', 'dark:text-gray-200',
    'bg-purple-100', 'text-purple-800', 'dark:bg-purple-800', 'dark:text-purple-200',
  ],
  plugins: [],
}
export default config