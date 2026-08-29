# ⚽ FC 26 Career Mode Manager

<p align="center">
  <img src="./assets/images/icon.png" width="120" height="120" alt="FC 26 Career Mode Manager Logo" style="border-radius: 24px;" />
</p>

<p align="center">
  <strong>Aplikasi Manajemen Skuad, Rotasi Tim, dan Team Sheet Taktis untuk EA SPORTS FC 26 Career Mode.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Expo-SDK%2054-000020?style=for-the-badge&logo=expo&logoColor=white" alt="Expo SDK 54" />
  <img src="https://img.shields.io/badge/React%20Native-0.76-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React Native" />
  <img src="https://img.shields.io/badge/TypeScript-5.3-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/SQLite-Local%20DB-003B57?style=for-the-badge&logo=sqlite&logoColor=white" alt="SQLite" />
  <img src="https://img.shields.io/badge/EAS-Cloud%20Ready-000000?style=for-the-badge&logo=expo&logoColor=white" alt="EAS" />
</p>

---

## 👨‍💻 Developer & Creator

- **Lead Developer**: **Irwan Firmanto**
- **Project**: *FC 26 Career Mode Manager Mobile App*
- **EAS Project**: `@eternalsugarzy/fc26-career-manager`
- **GitHub Repository**: [eternalsugarzy/squad-builder-fc26](https://github.com/eternalsugarzy/squad-builder-fc26)

---

## 🌟 Fitur Utama

### 1. ⚡ Auto-Generate Team Sheets Cerdas (Tim 1 – 4)
- **Hierarki Tim Otomatis**: Menyusun Starting XI dan Bench secara otomatis berdasarkan peringkat OVR dan kecocokan posisi.
  - **Tim 1**: Skuad Utama (Best Starting XI).
  - **Tim 2**: Skuad Rotasi / Piala Domestik.
  - **Tim 3**: Skuad Muda / Prospek Masa Depan.
  - **Tim 4**: Tim Hybrid / Gabungan All-Star.
- **Smart Filtering**: Pemain yang berstatus *Injured*, *Loan Out*, atau *Sudah Dijual* otomatis dilewati dari Starting XI dan digantikan oleh pemain fit terbaik.

### 2. 📋 24 Formasi Resmi FC 26 & 8 Tactical Visions
- Tersedia **24 formasi resmi** lengkap (4-3-3 Attack/Defend/Holding/False 9, 4-2-3-1, 3-5-2, 5-3-2, dsb.).
- **8 Visi Taktis**: *Tiki-Taka, Gegenpressing, Counter-Attack, Park the Bus, Wing Play, Kick and Rush, Total Football, Balanced*.

### 3. 🧪 Simulator Taktis & Uji Kecocokan Formasi (Tactical Fit)
- **Interactive Pitch Canvas**: Visualisasi lapangan hijau 2D dengan token pemain, kartu OVR, dan peran taktis.
- **Simulator Uji Formasi**: Coba formasi baru dan lakukan simulasi *Auto-Fill Lineup* untuk melihat skor kecocokan taktis dan rekomendasi pemain yang pas.

### 4. 📊 Monitor Kebutuhan Kuota Posisi (Dual-Mode)
- **Mode Skuad Aktual**: Memantau kebutuhan kuota posisi riil dari 3 Tim Inti Mandiri (Tim 1–3) berdasarkan Posisi Utama (*Primary Position*).
- **Mode Simulasi Formasi**: Dropdown 24 formasi untuk mensimulasikan kebutuhan posisi jika mengubah gaya bermain tim.

### 5. 👥 Manajemen Pemain Komprehensif
- **Filter Modern & Cepat**: Tombol filter dropdown besar per kategori posisi (*Kiper, Bek, Gelandang, Penyerang*) dan status tanpa scroll samping yang melelahkan.
- **Bulk OVR Update**: Ubah OVR banyak pemain sekaligus dalam 1 sentuhan.
- **Riwayat OVR**: Pencatatan riwayat kenaikan dan penurunan OVR pemain sepanjang musim Career Mode.
- **Multi-Posisi**: Dukungan posisi primer dan sekunder untuk setiap pemain.

### 6. 📁 Multi-Save Career Mode Profile Manager
- Buat dan kelola banyak save profile (misal: Save Arsenal S1, Real Madrid S3, dsb.) dalam satu aplikasi dengan database terisolasi.

### 7. 🎯 Transfer Watchlist & Pemain Pengganti
- Pantau target transfer pemain berdasarkan posisi, range target OVR (Min–Max), catatan scout, dan pemain yang ingin digantikan.

### 8. 💾 Backup & Restore (JSON & Teks)
- Ekspor susunan Team Sheet ke format teks rapi untuk dicatat atau dibagikan.
- Backup dan restore seluruh database profil ke file format JSON terstruktur.

---

## 🏗️ Struktur Arsitektur & Teknologi

```text
fc26-career-manager/
├── app/                        # Expo Router Navigation (Tabs & Screens)
│   ├── (tabs)/
│   │   ├── index.tsx           # Home Dashboard & Quota Monitor
│   │   ├── squads.tsx          # Team Sheet & Pitch Builder
│   │   ├── players.tsx         # Players Management & Categorized Filter
│   │   ├── formations.tsx      # Formations, Tactical Visions & Simulator
│   │   └── profile.tsx         # Hub Menu Lainnya (Profiles, Watchlist, Backup, Dev)
│   ├── _layout.tsx             # Root Layout & SQLite Provider
│   └── +not-found.tsx
├── src/
│   ├── components/             # Reusable UI (PitchCanvas, PlayerPickerModal, etc.)
│   ├── contexts/               # ProfileContext & Active State Provider
│   ├── database/               # SQLite Initialization, Schema & Seed Data
│   ├── services/               # Pure Business Logic & CRUD Services
│   │   ├── autoGenerateService.ts
│   │   ├── dashboardService.ts
│   │   ├── formationService.ts
│   │   ├── playerService.ts
│   │   ├── playstyleService.ts
│   │   ├── positionService.ts
│   │   ├── squadService.ts
│   │   ├── watchlistService.ts
│   │   └── exportService.ts
│   └── types/                  # TypeScript Data Models & Interfaces
├── eas.json                    # EAS Build & Update Configuration
├── metro.config.js             # Metro Bundler with WebAssembly Support
└── app.json                    # Expo Configuration
```

---

## 🚀 Cara Menjalankan Secara Lokal

### Prasyarat:
- [Node.js](https://nodejs.org/) (versi 18 atau lebih baru)
- Aplikasi **Expo Go** pada perangkat Android atau iOS Anda.

### Langkah Instalasi:

1. **Clone repository ini**:
   ```bash
   git clone https://github.com/eternalsugarzy/squad-builder-fc26.git
   cd squad-builder-fc26
   ```

2. **Install dependensi**:
   ```bash
   npm install
   ```

3. **Jalankan development server**:
   ```bash
   npx expo start
   ```

4. **Buka di HP Anda**:
   - Buka aplikasi **Expo Go** di Android (Scan QR Code) atau Kamera iOS (Scan QR Code).

---

## ☁️ Deployment EAS Cloud (Expo Go)

Aplikasi ini sudah dipublikasikan ke EAS Cloud:
- **EAS Project ID**: `3fb1d7ee-8ec1-4002-aab1-3a2bd169aa82`
- **Dashboard**: [expo.dev/accounts/eternalsugarzy/projects/fc26-career-manager](https://expo.dev/accounts/eternalsugarzy/projects/fc26-career-manager)

Untuk mempublikasikan pembaruan ke EAS Cloud:
```bash
$env:EAS_SKIP_AUTO_FINGERPRINT="1"; npx eas update --branch main --message "Update Deskripsi" --platform all
```

---

## 📄 Lisensi

Dibuat untuk keperluan manajemen pribadi EA SPORTS FC 26 Career Mode.  
Dikembangkan oleh **Irwan Firmanto**.
