/**
 * FC26 Career Mode Manager - Player Picker Modal
 * Used when tapping a pitch slot to pick or replace a player.
 */

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  TextInput,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import type { PlayerWithPositions } from '@/src/types';

interface PlayerPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectPlayer: (player: PlayerWithPositions | null) => void;
  players: PlayerWithPositions[];
  targetPositionName?: string;
  targetSlotLabel?: string;
  assignedPlayerIds: Set<string>; // Players already in starting XI or bench
  currentPlayerId?: string | null;
}

export function PlayerPickerModal({
  visible,
  onClose,
  onSelectPlayer,
  players,
  targetPositionName,
  targetSlotLabel,
  assignedPlayerIds,
  currentPlayerId,
}: PlayerPickerModalProps) {
  const [search, setSearch] = useState('');
  const [onlyMatchingPos, setOnlyMatchingPos] = useState(true);

  const eligiblePlayers = useMemo(() => {
    return players
      .filter((p) => {
        // Exclude completely unavailable statuses
        if (p.status === 'sudah_dijual' || p.status === 'loan_out' || p.status === 'injured') {
          return false;
        }

        // Search query
        if (search.trim()) {
          const q = search.toLowerCase();
          if (!p.nama.toLowerCase().includes(q)) return false;
        }

        // Position filter
        if (onlyMatchingPos && targetPositionName) {
          const matchesPos = p.positions.some(
            (pos) => pos.nama.toUpperCase() === targetPositionName.toUpperCase()
          );
          if (!matchesPos) return false;
        }

        return true;
      })
      .sort((a, b) => b.ovr_current - a.ovr_current);
  }, [players, search, onlyMatchingPos, targetPositionName]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>PILIH PEMAIN</Text>
              <Text style={styles.subtitle}>
                Slot: {targetSlotLabel ?? targetPositionName} (Posisi:{' '}
                {targetPositionName ?? 'Semua'})
              </Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Search & Matching Filter */}
          <View style={styles.searchBar}>
            <TextInput
              style={styles.searchInput}
              placeholder="Cari nama pemain..."
              placeholderTextColor="#888"
              value={search}
              onChangeText={setSearch}
            />
            {targetPositionName && (
              <TouchableOpacity
                style={[styles.posFilterBtn, onlyMatchingPos && styles.posFilterBtnActive]}
                onPress={() => setOnlyMatchingPos(!onlyMatchingPos)}>
                <Text
                  style={[
                    styles.posFilterText,
                    onlyMatchingPos && styles.posFilterTextActive,
                  ]}>
                  {targetPositionName} Saja
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Clear Slot Option */}
          <TouchableOpacity
            style={styles.clearSlotBtn}
            onPress={() => {
              onSelectPlayer(null);
              onClose();
            }}>
            <Text style={styles.clearSlotText}>⚪ KOSONGKAN SLOT INI</Text>
          </TouchableOpacity>

          {/* Player List */}
          <FlatList
            data={eligiblePlayers}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => {
              const isAssigned = assignedPlayerIds.has(item.id);
              const isCurrent = item.id === currentPlayerId;
              const primaryPos = item.positions[0]?.nama ?? '-';

              return (
                <TouchableOpacity
                  style={[
                    styles.playerItem,
                    isCurrent && styles.playerItemCurrent,
                    isAssigned && !isCurrent && styles.playerItemAssigned,
                  ]}
                  onPress={() => {
                    onSelectPlayer(item);
                    onClose();
                  }}>
                  {/* OVR Box */}
                  <View style={styles.ovrBox}>
                    <Text style={styles.ovrText}>{item.ovr_current}</Text>
                  </View>

                  {/* Info */}
                  <View style={styles.infoCol}>
                    <Text style={styles.playerName} numberOfLines={1}>
                      {item.nama}
                    </Text>
                    <View style={styles.posRow}>
                      <Text style={styles.primaryPos}>{primaryPos}</Text>
                      {item.positions.slice(1).map((sp) => (
                        <Text key={sp.id} style={styles.secPos}>
                          {sp.nama}
                        </Text>
                      ))}
                      {item.status === 'akan_dijual' && (
                        <Text style={styles.warnStatus}>⚠️ Akan Dijual</Text>
                      )}
                    </View>
                  </View>

                  {/* Badges */}
                  <View style={styles.badgeCol}>
                    {isCurrent && <Text style={styles.currentBadge}>DIPILIH</Text>}
                    {isAssigned && !isCurrent && (
                      <Text style={styles.assignedBadge}>SUDAH DI TIM</Text>
                    )}
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 3,
    borderColor: '#000',
    width: '100%',
    maxWidth: 440,
    height: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 2,
    borderBottomColor: '#000',
    backgroundColor: '#FAFAFA',
  },
  title: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0A1128',
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
    borderWidth: 2,
    borderColor: '#000',
    backgroundColor: '#FFF',
  },
  closeText: {
    fontSize: 14,
    fontWeight: '900',
  },
  searchBar: {
    flexDirection: 'row',
    padding: 10,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#DDD',
    backgroundColor: '#F8F9FA',
  },
  searchInput: {
    flex: 1,
    borderWidth: 2,
    borderColor: '#000',
    backgroundColor: '#FFF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 13,
    fontWeight: '600',
    color: '#0A1128',
  },
  posFilterBtn: {
    borderWidth: 1,
    borderColor: '#000',
    paddingHorizontal: 10,
    justifyContent: 'center',
    backgroundColor: '#FFF',
  },
  posFilterBtnActive: {
    backgroundColor: '#0A1128',
  },
  posFilterText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0A1128',
  },
  posFilterTextActive: {
    color: '#FFF',
  },
  clearSlotBtn: {
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
    borderBottomWidth: 1,
    borderBottomColor: '#DDD',
  },
  clearSlotText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#666',
  },
  listContent: {
    padding: 10,
  },
  playerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#000',
    backgroundColor: '#FAFAFA',
    marginBottom: 6,
    padding: 8,
  },
  playerItemCurrent: {
    backgroundColor: '#FFF9E6',
    borderColor: '#D4AF37',
  },
  playerItemAssigned: {
    opacity: 0.6,
  },
  ovrBox: {
    width: 38,
    height: 38,
    backgroundColor: '#0A1128',
    borderWidth: 1.5,
    borderColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  ovrText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#D4AF37',
  },
  infoCol: {
    flex: 1,
  },
  playerName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0A1128',
  },
  posRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  primaryPos: {
    fontSize: 10,
    fontWeight: '900',
    color: '#0A1128',
    backgroundColor: '#E0E0E0',
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  secPos: {
    fontSize: 10,
    fontWeight: '600',
    color: '#666',
  },
  warnStatus: {
    fontSize: 9,
    fontWeight: '800',
    color: '#B06000',
  },
  badgeCol: {
    alignItems: 'flex-end',
  },
  currentBadge: {
    fontSize: 9,
    fontWeight: '900',
    color: '#D4AF37',
    backgroundColor: '#0A1128',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  assignedBadge: {
    fontSize: 9,
    fontWeight: '700',
    color: '#888',
  },
});
