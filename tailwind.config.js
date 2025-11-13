/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',                 // ← usaremos clase para activar modo oscuro
  content: ['./src/**/*.{html,ts}'], // ← escanea plantillas Angular
  theme: {
    extend: {
      colors: {
        surface: {
          900: '#0f1115', // fondo principal
          800: '#14161b', // paneles
          700: '#1b1e25', // hover
        },
        textc: {
          base: '#e5e7eb', // texto claro
          mute: '#9ca3af', // texto apagado
        },
        brand: {
          500: '#84cc16', // verde acento
          600: '#65a30d',
        }
      }
    },
  },
  plugins: [],
}
