// tailwind.config.js – DOĞRU TAM HALİ
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"], // BUNUN olduğundan emin ol
  safelist: ['dragging-letter'],
  theme: {
    extend: {
      height: {
        'screen-dvh': '100dvh', // 🔥 BURASI EKLENDİ
      },
      animation: {
        slideDown: 'slideDown 0.2s ease-out',
        fadeIn: 'fadeIn 0.2s ease-in',
        slideUp: 'slideUp 0.4s ease-out',
      },
      keyframes: {
        slideDown: {
          '0%': { opacity: 0, transform: 'translateY(-10%)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: 0 },
          '100%': { opacity: 1 },
        },
        slideUp: { // ✅ BURASI EKLENDİ
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};
