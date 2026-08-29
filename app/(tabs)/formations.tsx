import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function FormationsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>FORMASI & PLAYSTYLE</Text>
      <Text style={styles.hint}>CRUD Posisi & Playstyle akan ditampilkan di Tahap 2</Text>
      <Text style={styles.hint}>Builder Formasi akan ditampilkan di Tahap 4</Text>
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
    marginTop: 4,
  },
});
