import { COLLECTIONS } from '@/constants';
import { db } from '@/firebase/config';
import { createBackup } from '@/utils/backupService';
import { collection, onSnapshot, query, QuerySnapshot, where } from 'firebase/firestore';
import { useCallback, useEffect, useRef } from 'react';
import { useAuth } from './useAuth';
import { useNetworkStatus } from './useNetworkStatus';


export function useAutoBackup() {
  const { user } = useAuth();
  const { isOffline } = useNetworkStatus();
  const backupTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isBackingUpRef = useRef(false);
  const lastBackupTimeRef = useRef<number>(0);
  const previousSnapshotRef = useRef<string | null>(null);

  const performBackup = useCallback(async (source: string = 'auto') => {
    if (!user?.uid || isBackingUpRef.current) return;

    if (isOffline) {
      return;
    }

    const now = Date.now();
    if (now - lastBackupTimeRef.current < 10000) {
      return;
    }

    isBackingUpRef.current = true;

    try {
      await createBackup(user.uid);
      lastBackupTimeRef.current = now;
    } catch (error) {
      console.error(`[BACKUP] Auto-backup failed:`, error);
    } finally {
      isBackingUpRef.current = false;
    }
  }, [user?.uid, isOffline]);

  const scheduleBackup = useCallback((source: string = 'change') => {
    if (backupTimeoutRef.current) {
      clearTimeout(backupTimeoutRef.current);
    }

    backupTimeoutRef.current = setTimeout(() => {
      performBackup(source);
    }, 10000);
  }, [performBackup]);

  useEffect(() => {
    if (!user?.uid) return;

    if (!isOffline) {
      scheduleBackup('network-restored');
    }
  }, [isOffline, user?.uid, scheduleBackup]);

  useEffect(() => {
    if (!user?.uid) return;

    const unsubscribeGroups = onSnapshot(
      query(
        collection(db, COLLECTIONS.GROUPS),
        where('members', 'array-contains', user.uid)
      ),
      (snapshot: QuerySnapshot) => {
        const currentSnapshot = JSON.stringify(
          snapshot.docs.map(doc => ({ id: doc.id, data: doc.data() }))
        );

        if (previousSnapshotRef.current === null) {
          previousSnapshotRef.current = currentSnapshot;
          return;
        }

        if (currentSnapshot !== previousSnapshotRef.current) {
          previousSnapshotRef.current = currentSnapshot;

          const fromCache = snapshot.metadata.fromCache;

          if (!fromCache && snapshot.docs.length > 0) {
            scheduleBackup('online-sync');
          }
        }
      },
      (error) => {
        if (error.code === 'permission-denied') {
          return;
        }
        console.error('Error listening to groups:', error);
      }
    );

    return () => {
      unsubscribeGroups();

      if (backupTimeoutRef.current) {
        clearTimeout(backupTimeoutRef.current);
      }
    };
  }, [user?.uid, scheduleBackup]);
}
