import type { Config } from 'tailwindcss';

export default <Partial<Config>>{
  theme: {
    extend: {
      colors: {
        bg: {
          0: '#0c1219',
          1: '#121a24',
          2: '#1a2433',
        },
        line: 'rgba(148, 163, 184, 0.16)',
        ink: '#e8eef6',
        muted: '#8b9bb0',
        accent: {
          DEFAULT: '#3d9cf0',
          2: '#2dd4bf',
        },
        danger: '#f07178',
        ok: '#7fd962',
      },
      fontFamily: {
        sans: ['Vazirmatn', 'Tahoma', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        panel: '14px',
      },
      maxWidth: {
        shell: '920px',
      },
    },
  },
};
