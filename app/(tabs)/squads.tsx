import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function SquadsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>SQUAD</Text>
      <Text style={styles.hint}>Team Sheet & Pitch View akan ditampilkan di Tahap 5</Text>
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
