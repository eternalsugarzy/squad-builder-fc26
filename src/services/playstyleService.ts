import { getDatabase, generateId } from '@/src/database';
import type { Playstyle } from '@/src/types';

/**
 * Standard complete FC 26 Tactical Visions & Playstyles.
 */
export interface FC26PlaystylePreset {
  nama: string;
  catatan: string;
}

export const FC26_DEFAULT_PLAYSTYLES: FC26PlaystylePreset[] = [
  {
    nama: 'Standard (Seimbang)',
    catatan: 'Pendekatan seimbang tanpa fokus berlebihan pada satu gaya bermain tertentu.',
  },
  {
    nama: 'Wing Play (Permainan Sayap)',
    catatan: 'Fokus menyerang melalui lebar lapangan dengan umpan silang akurat ke kotak penalti.',
  },
  {
    nama: 'Tiki-Taka',
    catatan: 'Penguasaan bola dominan dengan operan pendek cepat, segitiga umpan, dan pergerakan konstan.',
  },
  {
    nama: 'Gegenpressing (High Press)',
    catatan: 'Tekanan intensitas tinggi saat kehilangan bola untuk merebut bola kembali secepat mungkin di area lawan.',
  },
  {
    nama: 'Park the Bus (Tembok)',
    catatan: 'Struktur pertahanan sangat rapat dan disiplin di sekeliling kotak penalti sendiri.',
  },
  {
    nama: 'Counter Attack (Serangan Balik)',
    catatan: 'Bertahan rapat dan melancarkan serangan kilat cepat begitu bola berhasil direbut.',
  },
  {
    nama: 'Kick and Rush (Direct Play)',
    catatan: 'Operan panjang direct ke lini depan memanfaatkan duel udara dan kecepatan target man.',
  },
  {
    nama: 'Catenaccio (Pertahanan Total)',
    catatan: 'Sistem pertahanan berlapis dengan sapuan bersih dan transisi terorganisir.',
  },
];

/**
 * Ensure all standard FC 26 playstyles exist for a profile.
 */
export async function ensureDefaultPlaystyles(profileId: string): Promise<void> {
  const db = await getDatabase();
  const existing = await db.getAllAsync<Playstyle>(
    'SELECT * FROM playstyles WHERE profile_id = ?',
    profileId
  );
  const existingNames = new Set(existing.map((p) => p.nama.toLowerCase()));

  for (const preset of FC26_DEFAULT_PLAYSTYLES) {
    if (!existingNames.has(preset.nama.toLowerCase())) {
      const id = generateId();
      await db.runAsync(
        'INSERT INTO playstyles (id, profile_id, nama, catatan) VALUES (?, ?, ?, ?)',
        id,
        profileId,
        preset.nama,
        preset.catatan
      );
    }
  }
}

/**
 * List all playstyles for a profile (auto-populates default FC 26 visions).
 */
export async function listPlaystyles(profileId: string): Promise<Playstyle[]> {
  const db = await getDatabase();
  await ensureDefaultPlaystyles(profileId);

  return db.getAllAsync<Playstyle>(
    'SELECT * FROM playstyles WHERE profile_id = ? ORDER BY nama ASC',
    profileId
  );
}


/**
 * Get a single playstyle by ID.
 */
export async function getPlaystyleById(id: string): Promise<Playstyle | null> {
  const db = await getDatabase();
  const ps = await db.getFirstAsync<Playstyle>(
    'SELECT * FROM playstyles WHERE id = ?', id
  );
  return ps ?? null;
}
