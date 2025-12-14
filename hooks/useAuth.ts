import { useState, useEffect, useRef } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, db } from '../firebase/config';
import { doc, onSnapshot } from 'firebase/firestore';
import { UserProfile } from '../types/index';
import { loadBackup } from '../utils/backupService';

export function useAuth() {
    const [user, setUser] = useState<User | null>(null);
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const loadedFromBackupRef = useRef(false);

    useEffect(() => {
        let mounted = true;
        let profileUnsubscribe: (() => void) | null = null;

        const timeout = setTimeout(() => {
            if (mounted && loading) {
                console.warn('Auth initialization timeout, setting loading to false');
                setLoading(false);
            }
        }, 10000);

        const authUnsubscribe = onAuthStateChanged(auth, async (user) => {
            if (!mounted) return;

            try {
                setUser(user);

                if (profileUnsubscribe) {
                    profileUnsubscribe();
                    profileUnsubscribe = null;
                }

                if (user) {
                    if (!loadedFromBackupRef.current) {
                        try {
                            const backup = await loadBackup();
                            if (backup && backup.userProfile && backup.userId === user.uid) {
                                setUserProfile(backup.userProfile);
                                loadedFromBackupRef.current = true;
                            }
                        } catch (backupError) {
                        }
                    }
                    const userDocRef = doc(db, 'users', user.uid);
                    profileUnsubscribe = onSnapshot(
                        userDocRef,
                        { includeMetadataChanges: true },
                        (docSnap) => {
                            if (mounted) {
                                if (docSnap.exists()) {
                                    setUserProfile(docSnap.data() as UserProfile);
                                } else {
                                    if (!loadedFromBackupRef.current) {
                                        setUserProfile(null);
                                    }
                                }
                                setLoading(false);
                                clearTimeout(timeout);
                            }
                        },
                        (error: any) => {
                            if (error?.code !== 'permission-denied' &&
                                !error?.message?.includes('insufficient permissions') &&
                                error?.code !== 'unavailable') {
                                console.error('Error listening to user profile:', error);
                            }
                            if (mounted) {
                                setLoading(false);
                                clearTimeout(timeout);
                            }
                        }
                    );
                } else {
                    setUserProfile(null);
                    loadedFromBackupRef.current = false;
                    if (mounted) {
                        setLoading(false);
                        clearTimeout(timeout);
                    }
                }
            } catch (error: any) {
                if (error?.code !== 'permission-denied' && !error?.message?.includes('insufficient permissions')) {
                    console.error('Error in auth state change:', error);
                }
                if (mounted) {
                    setLoading(false);
                    clearTimeout(timeout);
                }
            }
        });

        return () => {
            mounted = false;
            clearTimeout(timeout);
            authUnsubscribe();
            if (profileUnsubscribe) {
                profileUnsubscribe();
            }
        };
    }, []);

    return { user, userProfile, loading };
}