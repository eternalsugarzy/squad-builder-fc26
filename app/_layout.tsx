import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { ProfileProvider } from '@/src/contexts/ProfileContext';

export default function RootLayout() {
  return (
    <ProfileProvider>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="watchlist" options={{ headerShown: true, title: 'WATCHLIST' }} />
      </Stack>
      <StatusBar style="dark" />
    </ProfileProvider>
  );
}
