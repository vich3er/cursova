import { COLLECTIONS } from '@/constants';
import { db } from '@/firebase/config';
import { ShoppingList } from '@/types';
import { getLastListVisit } from '@/utils/readStatus';
import { doc, onSnapshot } from 'firebase/firestore';
import { useEffect, useState } from 'react';


export function useUnreadList(listId: string | undefined, currentUserId: string | undefined): boolean {
    const [hasUnread, setHasUnread] = useState(false);

    useEffect(() => {
        if (!listId || !currentUserId) {
            setHasUnread(false);
            return;
        }

        let isSubscribed = true;

        (async () => {
            try {
                const lastVisit = await getLastListVisit(listId);

                const listRef = doc(db, COLLECTIONS.SHOPPING_LISTS, listId);

                const unsubscribe = onSnapshot(
                    listRef,
                    (snapshot) => {
                        if (!isSubscribed) return;

                        if (!snapshot.exists()) {
                            setHasUnread(false);
                            return;
                        }

                        const list = snapshot.data() as ShoppingList;

                        const updatedTime = list.updatedAt?.toMillis() || list.createdAt?.toMillis() || 0;
                        const updatedBy = list.lastUpdatedBy || list.createdBy;

                        const hasChanges = updatedTime > lastVisit && updatedBy !== currentUserId;
                        setHasUnread(hasChanges);
                    },
                    (error) => {
                        if (error.code === 'permission-denied') {
                            if (isSubscribed) setHasUnread(false);
                            return;
                        }
                        console.error('Error listening to list for unread:', error);
                        if (isSubscribed) setHasUnread(false);
                    }
                );

                return () => {
                    isSubscribed = false;
                    unsubscribe();
                };
            } catch (error) {
                console.error('Error setting up list unread listener:', error);
                if (isSubscribed) setHasUnread(false);
            }
        })();
    }, [listId, currentUserId]);

    return hasUnread;
}
