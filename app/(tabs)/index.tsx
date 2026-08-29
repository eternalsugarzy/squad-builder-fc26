import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { getDatabase } from '@/src/database';

export default function HomeScreen() {
  const [dbReady, setDbReady] = useState(false);

  useEffect(() => {
    initDb();
  }, []);

  async function initDb() {
    try {
      await getDatabase();
      setDbReady(true);
      console.log('[Home] Database initialized successfully');
    } catch (error) {
      console.error('[Home] Database init error:', error);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>FC 26 CAREER MODE</Text>
      <Text style={styles.subtitle}>MANAGER</Text>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>
          {dbReady ? '● DB READY' : '○ LOADING DB...'}
        </Text>
      </View>
      <Text style={styles.hint}>Dashboard akan ditampilkan di Tahap 8</Text>
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
    fontSize: 13,
    color: '#999',
    marginTop: 8,
  },
});
