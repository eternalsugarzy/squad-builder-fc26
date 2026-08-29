import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useProfile } from '@/src/contexts/ProfileContext';
import type { Profile } from '@/src/types';

export default function ProfileScreen() {
  const {
    profiles,
    activeProfile,
    loading,
    switchProfile,
    addProfile,
    editProfileName,
    removeProfile,
  } = useProfile();

  const [showAddModal, setShowAddModal] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [renameTarget, setRenameTarget] = useState<Profile | null>(null);
  const [renameName, setRenameName] = useState('');

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0A1128" />
        <Text style={styles.loadingText}>Memuat profil...</Text>
      </View>
    );
  }

  async function handleAdd() {
    const trimmed = newName.trim();
    if (!trimmed) {
      Alert.alert('Error', 'Nama save tidak boleh kosong');
      return;
    }
    try {
      await addProfile(trimmed);
      setNewName('');
      setShowAddModal(false);
    } catch (error) {
      Alert.alert('Error', 'Gagal membuat profil');
      console.error(error);
    }
  }

  async function handleRename() {
    if (!renameTarget) return;
    const trimmed = renameName.trim();
    if (!trimmed) {
      Alert.alert('Error', 'Nama save tidak boleh kosong');
      return;
    }
    try {
      await editProfileName(renameTarget.id, trimmed);
      setRenameTarget(null);
      setRenameName('');
      setShowRenameModal(false);
    } catch (error) {
      Alert.alert('Error', 'Gagal mengganti nama profil');
      console.error(error);
    }
  }

  function handleDeleteConfirm(profile: Profile) {
    Alert.alert(
      'Hapus Profil',
      `Yakin ingin menghapus "${profile.nama_save}"?\n\nSemua data pemain, formasi, squad, dan riwayat yang terkait akan dihapus permanen.`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeProfile(profile.id);
            } catch (error) {
              Alert.alert('Error', 'Gagal menghapus profil');
              console.error(error);
            }
          },
        },
      ]
    );
  }

  function openRenameModal(profile: Profile) {
    setRenameTarget(profile);
    setRenameName(profile.nama_save);
    setShowRenameModal(true);
  }

  function renderProfileItem({ item }: { item: Profile }) {
    const isActive = item.id === activeProfile?.id;

    return (
      <View style={[styles.profileCard, isActive && styles.profileCardActive]}>
        <TouchableOpacity
          style={styles.profileMain}
          onPress={() => switchProfile(item.id)}
          activeOpacity={0.7}>
          <View style={styles.profileInfo}>
            <View style={styles.profileNameRow}>
              <Text style={[styles.profileName, isActive && styles.profileNameActive]}>
                {item.nama_save}
              </Text>
              {isActive && (
                <View style={styles.activeBadge}>
                  <Text style={styles.activeBadgeText}>AKTIF</Text>
                </View>
              )}
            </View>
            <Text style={styles.profileDate}>
              Dibuat: {new Date(item.created_at).toLocaleDateString('id-ID', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </Text>
          </View>
        </TouchableOpacity>

        <View style={styles.profileActions}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => openRenameModal(item)}>
            <Text style={styles.actionBtnText}>✏️</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.deleteBtn]}
            onPress={() => handleDeleteConfirm(item)}>
            <Text style={styles.actionBtnText}>🗑️</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>PROFIL SAVE</Text>
        <Text style={styles.headerSubtitle}>
          {profiles.length} profil tersimpan
        </Text>
      </View>

      {/* Profile list */}
      {profiles.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📂</Text>
          <Text style={styles.emptyTitle}>Belum Ada Profil</Text>
          <Text style={styles.emptyHint}>
            Buat profil baru untuk memulai Career Mode Manager
          </Text>
        </View>
      ) : (
        <FlatList
          data={profiles}
          renderItem={renderProfileItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Add button */}
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => {
          setNewName('');
          setShowAddModal(true);
        }}
        activeOpacity={0.8}>
        <Text style={styles.addButtonText}>+ BUAT PROFIL BARU</Text>
      </TouchableOpacity>

      {/* Add Modal */}
      <Modal
        visible={showAddModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAddModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowAddModal(false)}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalCenter}>
            <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
              <Text style={styles.modalTitle}>PROFIL BARU</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Nama save (misal: Save 1)"
                placeholderTextColor="#999"
                value={newName}
                onChangeText={setNewName}
                autoFocus
                maxLength={50}
                returnKeyType="done"
                onSubmitEditing={handleAdd}
              />
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setShowAddModal(false)}>
                  <Text style={styles.modalCancelText}>BATAL</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalConfirmBtn}
                  onPress={handleAdd}>
                  <Text style={styles.modalConfirmText}>BUAT</Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>

      {/* Rename Modal */}
      <Modal
        visible={showRenameModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRenameModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowRenameModal(false)}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalCenter}>
            <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
              <Text style={styles.modalTitle}>GANTI NAMA</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Nama save baru"
                placeholderTextColor="#999"
                value={renameName}
                onChangeText={setRenameName}
                autoFocus
                maxLength={50}
                returnKeyType="done"
                onSubmitEditing={handleRename}
              />
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setShowRenameModal(false)}>
                  <Text style={styles.modalCancelText}>BATAL</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalConfirmBtn}
                  onPress={handleRename}>
                  <Text style={styles.modalConfirmText}>SIMPAN</Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },

  // Header
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 3,
    borderBottomColor: '#000',
    backgroundColor: '#FAFAFA',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#0A1128',
    letterSpacing: 2,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },

  // List
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },

  // Profile card
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
    borderWidth: 2,
    borderColor: '#000',
    marginBottom: 12,
    padding: 0,
  },
  profileCardActive: {
    borderColor: '#0A1128',
    borderWidth: 3,
    backgroundColor: '#F0F4FF',
  },
  profileMain: {
    flex: 1,
    padding: 16,
  },
  profileInfo: {
    flex: 1,
  },
  profileNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0A1128',
  },
  profileNameActive: {
    color: '#0A1128',
  },
  activeBadge: {
    backgroundColor: '#D4AF37',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 2,
    borderColor: '#000',
  },
  activeBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#000',
    letterSpacing: 1,
  },
  profileDate: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
  },
  profileActions: {
    flexDirection: 'row',
    borderLeftWidth: 2,
    borderLeftColor: '#000',
  },
  actionBtn: {
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderLeftWidth: 1,
    borderLeftColor: '#DDD',
  },
  actionBtnText: {
    fontSize: 18,
  },
  deleteBtn: {},

  // Empty state
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0A1128',
    marginBottom: 8,
  },
  emptyHint: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
  },

  // Add button
  addButton: {
    position: 'absolute',
    bottom: 24,
    left: 20,
    right: 20,
    backgroundColor: '#0A1128',
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#000',
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 2,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCenter: {
    width: '100%',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderWidth: 3,
    borderColor: '#000',
    padding: 24,
    width: '85%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0A1128',
    letterSpacing: 2,
    marginBottom: 16,
  },
  modalInput: {
    borderWidth: 2,
    borderColor: '#000',
    padding: 12,
    fontSize: 16,
    fontWeight: '600',
    color: '#0A1128',
    backgroundColor: '#FAFAFA',
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#000',
    backgroundColor: '#F0F0F0',
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#333',
    letterSpacing: 1,
  },
  modalConfirmBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#000',
    backgroundColor: '#D4AF37',
  },
  modalConfirmText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#000',
    letterSpacing: 1,
  },
});
