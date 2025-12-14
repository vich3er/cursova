import { COLLECTIONS } from '@/constants';
import { db } from '@/firebase/config';
import { ShoppingList } from '@/types';
import { getLastListVisit } from '@/utils/readStatus';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';


export function useUnreadListsTab(groupId: string | undefined, currentUserId: string | undefined): boolean {
    const [hasUnread, setHasUnread] = useState(false);

    useEffect(() => {
        if (!groupId || !currentUserId) {
            setHasUnread(false);
            return;
        }

        let isSubscribed = true;

        (async () => {
            try {
                const listsRef = collection(db, COLLECTIONS.SHOPPING_LISTS);
                const q = query(listsRef, where('groupId', '==', groupId));

                const unsubscribe = onSnapshot(
                    q,
                    async (snapshot) => {
                        if (!isSubscribed) return;

                        const checks = await Promise.all(
                            snapshot.docs.map(async (doc) => {
                                const list = { id: doc.id, ...doc.data() } as ShoppingList;
                                const lastVisit = await getLastListVisit(list.id);

                                const updatedTime = list.updatedAt?.toMillis() || list.createdAt?.toMillis() || 0;
                                const updatedBy = list.lastUpdatedBy || list.createdBy;

                                return updatedTime > lastVisit && updatedBy !== currentUserId;
                            })
                        );

                        const hasAnyUnread = checks.some((hasChanges) => hasChanges);
                        setHasUnread(hasAnyUnread);
                    },
                    (error) => {
                        if (error.code === 'permission-denied') {
                            if (isSubscribed) setHasUnread(false);
                            return;
                        }
                        console.error('Error listening to lists for unread:', error);
                        if (isSubscribed) setHasUnread(false);
                    }
                );

                return () => {
                    isSubscribed = false;
                    unsubscribe();
                };
            } catch (error) {
                console.error('Error setting up lists unread listener:', error);
                if (isSubscribed) setHasUnread(false);
            }
        })();
    }, [groupId, currentUserId]);

    return hasUnread;
}
