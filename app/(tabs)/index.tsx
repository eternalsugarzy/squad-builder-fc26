import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useProfile } from '@/src/contexts/ProfileContext';

export default function HomeScreen() {
  const { activeProfile, loading } = useProfile();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>FC 26 CAREER MODE</Text>
      <Text style={styles.subtitle}>MANAGER</Text>

      <View style={styles.badge}>
        <Text style={styles.badgeText}>
          {loading
            ? '○ LOADING...'
            : activeProfile
              ? `● ${activeProfile.nama_save.toUpperCase()}`
              : '○ BELUM ADA PROFIL'}
        </Text>
      </View>

      {!loading && !activeProfile && (
        <Text style={styles.hint}>
          Buka tab Profil untuk membuat profil baru
        </Text>
      )}

      <Text style={styles.dashboardHint}>Dashboard akan ditampilkan di Tahap 8</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    color: '#0A1128',
    letterSpacing: 2,
  },
  subtitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#D4AF37',
    letterSpacing: 4,
    marginBottom: 24,
  },
  badge: {
    borderWidth: 3,
    borderColor: '#000',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F0F0F0',
    marginBottom: 16,
  },
  badgeText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0A1128',
  },
  hint: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 8,
  },
  dashboardHint: {
    fontSize: 13,
    color: '#999',
    marginTop: 24,
  },
});
