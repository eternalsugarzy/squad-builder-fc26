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
  ScrollView,
} from 'react-native';
import { useProfile } from '@/src/contexts/ProfileContext';
import {
  exportProfileToJson,
  importProfileFromJson,
  formatTeamSheetsText,
} from '@/src/services/exportService';
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
    seedData,
    refresh,
  } = useProfile();

  const [showAddModal, setShowAddModal] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [renameTarget, setRenameTarget] = useState<Profile | null>(null);
  const [renameName, setRenameName] = useState('');

  // Export / Import Modals
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportContent, setExportContent] = useState('');
  const [exportTitle, setExportTitle] = useState('');

  const [showImportModal, setShowImportModal] = useState(false);
  const [importJsonText, setImportJsonText] = useState('');
  const [isImporting, setIsImporting] = useState(false);

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

  async function handleExportJson() {
    if (!activeProfile) return;
    try {
      const json = await exportProfileToJson(activeProfile.id);
      setExportTitle('EXPORT JSON PROFIL');
      setExportContent(json);
      setShowExportModal(true);
    } catch (e) {
      Alert.alert('Error', 'Gagal mengekspor profil ke JSON');
    }
  }

  async function handleExportTeamSheetsText() {
    if (!activeProfile) return;
    try {
      const text = await formatTeamSheetsText(activeProfile.id);
      setExportTitle('EXPORT TEAM SHEETS (TEXT)');
      setExportContent(text);
      setShowExportModal(true);
    } catch (e) {
      Alert.alert('Error', 'Gagal mengekspor Team Sheets');
    }
  }

  async function handleExecuteImport() {
    const trimmed = importJsonText.trim();
    if (!trimmed) {
      Alert.alert('Error', 'Paste teks JSON profil terlebih dahulu');
      return;
    }

    setIsImporting(true);
    try {
      await importProfileFromJson(trimmed);
      Alert.alert('Sukses 🎉', 'Profil berhasil diimpor!');
      setImportJsonText('');
      setShowImportModal(false);
      await refresh();
    } catch (e: any) {
      Alert.alert('Error Import', e.message ?? 'Format JSON tidak valid');
    } finally {
      setIsImporting(false);
    }
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
          {profiles.length} profil tersimpan • Multi-profile terisolasi
        </Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
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
          <View style={styles.listWrapper}>
            {profiles.map((p) => (
              <React.Fragment key={p.id}>{renderProfileItem({ item: p })}</React.Fragment>
            ))}
          </View>
        )}

        {/* Add Profile Button */}
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => {
            setNewName('');
            setShowAddModal(true);
          }}
          activeOpacity={0.8}>
          <Text style={styles.addButtonText}>+ BUAT PROFIL BARU</Text>
        </TouchableOpacity>

        {/* Export / Import Tools Section */}
        {activeProfile && (
          <View style={styles.toolsCard}>
            <Text style={styles.toolsTitle}>BACKUP & EKSPOR ({activeProfile.nama_save})</Text>

            <TouchableOpacity style={styles.toolBtn} onPress={handleExportTeamSheetsText}>
              <Text style={styles.toolBtnText}>📋 Ekspor Team Sheets (Format Teks)</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.toolBtn} onPress={handleExportJson}>
              <Text style={styles.toolBtnText}>💾 Backup Profil Ini (JSON)</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.toolBtn, { backgroundColor: '#F0F4FF' }]}
              onPress={async () => {
                Alert.alert(
                  'Muat Data Awal',
                  'Muat ulang data profil "Save 1" (44 pemain, formasi 4-3-3, 4 tim, watchlist)?',
                  [
                    { text: 'Batal', style: 'cancel' },
                    {
                      text: 'Muat',
                      onPress: async () => {
                        await seedData();
                        Alert.alert('Sukses', 'Data Save 1 berhasil dimuat!');
                      },
                    },
                  ]
                );
              }}>
              <Text style={[styles.toolBtnText, { color: '#0A1128' }]}>
                ⚡ Muat Ulang Data Awal (Save 1)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.toolBtn, styles.toolBtnImport]}
              onPress={() => setShowImportModal(true)}>
              <Text style={[styles.toolBtnText, { color: '#0A1128' }]}>
                📥 Impor Profil dari JSON
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ─── Developer Credit Card ────────────── */}
        <View style={styles.devCard}>
          <View style={styles.devHeaderRow}>
            <Text style={styles.devTag}>APP CREATOR & DEVELOPER</Text>
            <View style={styles.devVerBadge}>
              <Text style={styles.devVerText}>v1.0</Text>
            </View>
          </View>
          <Text style={styles.devName}>Irwan Firmanto</Text>
          <Text style={styles.devSub}>FC 26 Career Mode Manager • Personal iOS Edition</Text>
        </View>
      </ScrollView>

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
                <TouchableOpacity style={styles.modalConfirmBtn} onPress={handleAdd}>
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
                <TouchableOpacity style={styles.modalConfirmBtn} onPress={handleRename}>
                  <Text style={styles.modalConfirmText}>SIMPAN</Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>

      {/* Export Display Modal */}
      <Modal
        visible={showExportModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowExportModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowExportModal(false)}>
          <View style={styles.exportModalCard} onStartShouldSetResponder={() => true}>
            <Text style={styles.modalTitle}>{exportTitle}</Text>
            <ScrollView style={styles.exportTextBox} showsVerticalScrollIndicator>
              <TextInput
                style={styles.exportTextInput}
                value={exportContent}
                multiline
                editable={false}
                selectTextOnFocus
              />
            </ScrollView>
            <TouchableOpacity
              style={styles.modalConfirmBtn}
              onPress={() => setShowExportModal(false)}>
              <Text style={styles.modalConfirmText}>TUTUP</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* Import Modal */}
      <Modal
        visible={showImportModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowImportModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowImportModal(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalCenter}>
            <Pressable style={styles.exportModalCard} onPress={(e) => e.stopPropagation()}>
              <Text style={styles.modalTitle}>IMPOR PROFIL (JSON)</Text>
              <Text style={styles.importHint}>
                Paste seluruh isi teks JSON cadangan profil di bawah ini:
              </Text>
              <TextInput
                style={styles.importInput}
                placeholder='Paste JSON di sini (misal: {"version": 1, ...})'
                placeholderTextColor="#999"
                value={importJsonText}
                onChangeText={setImportJsonText}
                multiline
                autoCapitalize="none"
                autoCorrect={false}
              />
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setShowImportModal(false)}>
                  <Text style={styles.modalCancelText}>BATAL</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalConfirmBtn, isImporting && { opacity: 0.6 }]}
                  disabled={isImporting}
                  onPress={handleExecuteImport}>
                  <Text style={styles.modalConfirmText}>
                    {isImporting ? 'MENGIMPOR...' : 'IMPOR SEKARANG'}
                  </Text>
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

  scrollContent: {
    padding: 16,
    paddingBottom: 130,
  },
  listWrapper: {
    marginBottom: 12,
  },

  // Developer Card
  devCard: {
    marginTop: 16,
    borderWidth: 3,
    borderColor: '#000',
    backgroundColor: '#0A1128',
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  devHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  devTag: {
    fontSize: 10,
    fontWeight: '900',
    color: '#D4AF37',
    letterSpacing: 1.5,
  },
  devVerBadge: {
    backgroundColor: '#D4AF37',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  devVerText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#000',
  },
  devName: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  devSub: {
    fontSize: 12,
    fontWeight: '700',
    color: '#E0E0E0',
    marginTop: 4,
  },

  // Profile card
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
    borderWidth: 2,
    borderColor: '#000',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  profileCardActive: {
    borderColor: '#0A1128',
    borderWidth: 3,
    backgroundColor: '#F0F4FF',
  },
  profileMain: {
    flex: 1,
    padding: 14,
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
    fontSize: 17,
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
    borderWidth: 1.5,
    borderColor: '#000',
  },
  activeBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#000',
    letterSpacing: 1,
  },
  profileDate: {
    fontSize: 11,
    color: '#888',
    marginTop: 4,
  },
  profileActions: {
    flexDirection: 'row',
    borderLeftWidth: 2,
    borderLeftColor: '#000',
  },
  actionBtn: {
    padding: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderLeftWidth: 1,
    borderLeftColor: '#DDD',
  },
  actionBtnText: {
    fontSize: 16,
  },
  deleteBtn: {},

  // Empty state
  emptyState: {
    padding: 40,
    alignItems: 'center',
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
    backgroundColor: '#0A1128',
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#000',
    shadowColor: '#000',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
    marginBottom: 20,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 2,
  },

  // Tools Card
  toolsCard: {
    borderWidth: 2,
    borderColor: '#000',
    backgroundColor: '#FAFAFA',
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  toolsTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: '#0A1128',
    letterSpacing: 1,
    marginBottom: 10,
  },
  toolBtn: {
    borderWidth: 1.5,
    borderColor: '#000',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#FFF',
    marginBottom: 8,
  },
  toolBtnImport: {
    backgroundColor: '#D4AF37',
    marginBottom: 0,
  },
  toolBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0A1128',
  },

  // Modals
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
    padding: 20,
    width: '85%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 8,
  },
  exportModalCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 3,
    borderColor: '#000',
    padding: 18,
    width: '90%',
    maxWidth: 440,
    maxHeight: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#0A1128',
    letterSpacing: 1,
    marginBottom: 12,
  },
  modalInput: {
    borderWidth: 2,
    borderColor: '#000',
    padding: 10,
    fontSize: 15,
    fontWeight: '600',
    color: '#0A1128',
    backgroundColor: '#FAFAFA',
    marginBottom: 16,
  },
  exportTextBox: {
    borderWidth: 2,
    borderColor: '#000',
    backgroundColor: '#FAFAFA',
    maxHeight: 320,
    padding: 10,
    marginBottom: 12,
  },
  exportTextInput: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 11,
    color: '#0A1128',
  },
  importHint: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  importInput: {
    borderWidth: 2,
    borderColor: '#000',
    backgroundColor: '#FAFAFA',
    height: 180,
    padding: 10,
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    textAlignVertical: 'top',
    marginBottom: 12,
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
    fontSize: 13,
    fontWeight: '800',
    color: '#333',
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
    fontSize: 13,
    fontWeight: '800',
    color: '#000',
  },
});
