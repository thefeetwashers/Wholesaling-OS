import type { CapacitorConfig } from '@capacitor/cli';

// PLACEHOLDER — REPLACE before any store build.
// The app id below is NOT a registered bundle id / application id.
// Use the real id from App Store Connect / Google Play Console.
const config: CapacitorConfig = {
  appId: 'com.example.wholesalingos',
  appName: 'WholesalingOS',
  webDir: 'out',
  server: {
    androidScheme: 'https',
  },
};

export default config;
