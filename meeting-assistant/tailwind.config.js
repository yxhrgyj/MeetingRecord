/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{vue,js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Display"', '"PingFang SC"', '"Microsoft YaHei"', 'sans-serif']
      },
      colors: {
        canvas: '#F5F5F7',
        surface: '#FFFFFF',
        ink: '#1D1D1F',
        secondary: '#6E6E73',
        muted: '#8E8E93',
        line: '#E5E5E7',
        recording: '#FF3B30',
        success: '#34C759',
        warning: '#FF9500',
        primary: {
          50: '#EAF4FF',
          100: '#D8EBFF',
          200: '#B9D9FA',
          300: '#78B7F4',
          400: '#2990EA',
          500: '#0071E3',
          600: '#0066CC',
          700: '#0055B3',
          800: '#00468F',
          900: '#00376F'
        }
      },
      borderRadius: {
        control: '6px',
        panel: '8px'
      },
      boxShadow: {
        document: '0 8px 30px rgba(0, 0, 0, 0.055)'
      }
    }
  },
  plugins: []
}
