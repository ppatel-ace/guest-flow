import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.aceelectronics.guestflow',
  appName: 'ACE GuestFlow',
  webDir: 'dist/public',
  server: {
    // Point this to your deployed backend URL (Replit Deploy, Railway, etc.)
    // Once set, any backend/UI update is reflected on the iPad without a rebuild.
    // Example: 'https://your-app.replit.app'
    url: 'https://YOUR-DEPLOYED-BACKEND-URL',
    cleartext: false,
    androidScheme: 'https',
  },
  ios: {
    contentInset: 'always',
    scrollEnabled: false,
  },
};

export default config;
