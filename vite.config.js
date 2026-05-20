import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

// Multi-page app. Each HTML file is its own entry; the output filenames are
// preserved so the cross-page links (window.location.href = 'Employee.html',
// etc.) keep working in dev and in the production build.
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'index.html'),
        employee: resolve(__dirname, 'Employee.html'),
        onboarding: resolve(__dirname, 'onboarding.html'),
        onboarding_new: resolve(__dirname, 'onboarding_new.html'),
        signin: resolve(__dirname, 'signin.html'),
      },
    },
  },
});
