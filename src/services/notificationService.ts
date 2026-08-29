/**
 * FC26 Career Mode Manager - Notification & Status Duration Service
 * Local notifications via expo-notifications + status duration expiration checks.
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { getDatabase } from '@/src/database';
import type { PlayerStatus, StatusDurasi } from '@/src/types';

// Configure foreground notification presentation
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Request notification permissions.
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === 'web') return false;

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    return finalStatus === 'granted';
  } catch (error) {
    console.log('[Notifications] Permission request error:', error);
    return false;
  }
}

/**
 * Schedule a local notification reminder for a player whose status (loan/injury) is ending.
 */
export async function schedulePlayerStatusNotification(
  playerName: string,
  status: PlayerStatus,
  durasi: StatusDurasi,
  secondsFromNow = 5
): Promise<string | null> {
  if (Platform.OS === 'web') return null;

  try {
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) return null;

    const statusTitle =
      status === 'injured'
        ? `🏥 Pemulihan Cedera Selesai: ${playerName}`
        : `✈️ Masa Pinjaman Berakhir: ${playerName}`;

    const statusBody =
      status === 'injured'
        ? `Durasi cedera (${durasi.replace('_', ' ')}) telah selesai. ${playerName} siap kembali bermain!`
        : `Masa pinjaman (${durasi.replace('_', ' ')}) telah selesai. ${playerName} kembali ke skuad.`;

    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: statusTitle,
        body: statusBody,
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: secondsFromNow,
      },
    });

    return notificationId;
  } catch (error) {
    console.log('[Notifications] Schedule error:', error);
    return null;
  }
}

/**
 * Automatically check and return expired injured players to 'aktif'.
 */
export async function checkExpiredStatusPlayers(profileId: string): Promise<number> {
  const db = await getDatabase();
  const now = new Date();

  const players = await db.getAllAsync<{
    id: string;
    nama: string;
    status: string;
    status_durasi: string | null;
    status_mulai: string | null;
  }>(
    `SELECT id, nama, status, status_durasi, status_mulai
     FROM players
     WHERE profile_id = ? AND (status = 'injured' OR status = 'loan_out')
     AND status_mulai IS NOT NULL AND status_durasi IS NOT NULL`,
    profileId
  );

  let updatedCount = 0;

  for (const p of players) {
    if (!p.status_mulai || !p.status_durasi) continue;

    const startDate = new Date(p.status_mulai);
    const months =
      p.status_durasi === '6_bulan' ? 6 : p.status_durasi === '1_tahun' ? 12 : 24;

    const expiryDate = new Date(startDate);
    expiryDate.setMonth(expiryDate.getMonth() + months);

    if (now >= expiryDate && p.status === 'injured') {
      // Auto-return injured player to 'aktif'
      await db.runAsync(
        `UPDATE players SET
          status = 'aktif',
          status_durasi = NULL,
          status_mulai = NULL,
          updated_at = ?
         WHERE id = ?`,
        now.toISOString(),
        p.id
      );
      updatedCount++;
    }
  }

  return updatedCount;
}
