import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.smartedt.app',
  appName: 'Smart EDT',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
