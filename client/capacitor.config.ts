import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.epson.quizlive',
  appName: 'Epson Quiz Live',
  webDir: 'dist',
  backgroundColor: '#ffffff',
  android: {
    allowMixedContent: false,
  },
  server: {
    androidScheme: 'https',
  },
};

export default config;
