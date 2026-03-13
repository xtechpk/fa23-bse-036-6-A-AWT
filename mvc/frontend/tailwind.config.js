/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        'primary': '#0A73BA',
        'primary-dark': '#005a9c',
        'secondary': '#f8fafc', // A very light gray for subtle background contrast
        'heading': '#1a202c',
        'body': '#4a5568',
      },
      fontFamily: {
        // Ensuring Poppins is available for Tailwind, as used in the landing page
        'sans': ['Poppins', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fade-in 0.3s ease-out forwards',
        'scale-in': 'scale-in 0.3s ease-out forwards',
        'logo-pulse': 'logo-pulse 2s ease-in-out infinite',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'logo-pulse': {
          '0%, 100%': {
            transform: 'scale(1)',
            opacity: '0.9'
          },
          '50%': {
            transform: 'scale(1.15)',
            opacity: '1'
          },
        },
      },
    },
  },
  plugins: [],
}
