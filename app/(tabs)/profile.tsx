import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function ProfileScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>PROFIL</Text>
      <Text style={styles.hint}>Manajemen profile akan ditampilkan di Tahap 1</Text>
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
    fontSize: 28,
    fontWeight: '900',
    color: '#0A1128',
    letterSpacing: 2,
    marginBottom: 8,
  },
  hint: {
    fontSize: 13,
    color: '#999',
  },
});
