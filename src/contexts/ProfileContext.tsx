/**
 * FC26 Career Mode Manager - Profile Context
 * Provides the active profile to all screens.
 * All data-fetching screens should use this context to scope queries.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { Profile } from '@/src/types';
import {
  getActiveProfile,
  listProfiles,
  setActiveProfile as setActiveProfileDb,
  createProfile,
  renameProfile,
  deleteProfile,
} from '@/src/services/profileService';

interface ProfileContextType {
  /** The currently active profile, or null if none exists */
  activeProfile: Profile | null;
  /** All profiles */
  profiles: Profile[];
  /** Whether the context is loading */
  loading: boolean;
  /** Switch active profile */
  switchProfile: (id: string) => Promise<void>;
  /** Create a new profile */
  addProfile: (namaSave: string) => Promise<Profile>;
  /** Rename a profile */
  editProfileName: (id: string, namaSave: string) => Promise<void>;
  /** Delete a profile */
  removeProfile: (id: string) => Promise<void>;
  /** Refresh profiles from database */
  refresh: () => Promise<void>;
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [activeProfile, setActiveProfile] = useState<Profile | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const [allProfiles, active] = await Promise.all([
        listProfiles(),
        getActiveProfile(),
      ]);
      setProfiles(allProfiles);
      setActiveProfile(active);
    } catch (error) {
      console.error('[ProfileContext] Error loading profiles:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const switchProfile = useCallback(async (id: string) => {
    await setActiveProfileDb(id);
    await refresh();
  }, [refresh]);

  const addProfile = useCallback(async (namaSave: string) => {
    const profile = await createProfile(namaSave);
    await refresh();
    return profile;
  }, [refresh]);

  const editProfileName = useCallback(async (id: string, namaSave: string) => {
    await renameProfile(id, namaSave);
    await refresh();
  }, [refresh]);

  const removeProfile = useCallback(async (id: string) => {
    await deleteProfile(id);
    await refresh();
  }, [refresh]);

  return (
    <ProfileContext.Provider
      value={{
        activeProfile,
        profiles,
        loading,
        switchProfile,
        addProfile,
        editProfileName,
        removeProfile,
        refresh,
      }}>
      {children}
    </ProfileContext.Provider>
  );
}

/**
 * Hook to access profile context.
 * Must be used within a ProfileProvider.
 */
export function useProfile(): ProfileContextType {
  const context = useContext(ProfileContext);
  if (!context) {
    throw new Error('useProfile must be used within a ProfileProvider');
  }
  return context;
}
