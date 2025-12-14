import { COLLECTIONS } from '@/constants';
import { db } from '@/firebase/config';
import { ChatMessage, ShoppingList } from '@/types';
import { getLastChatVisit, getLastListVisit } from '@/utils/readStatus';
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';


export function useUnreadGroup(groupId: string | undefined, currentUserId: string | undefined): boolean {
    const [hasUnread, setHasUnread] = useState(false);

    useEffect(() => {
        if (!groupId || !currentUserId) {
            setHasUnread(false);
            return;
        }

        let isSubscribed = true;

        const checkAllUnread = async () => {
            try {
                const lastChatVisit = await getLastChatVisit(groupId);

                const messagesRef = collection(db, COLLECTIONS.CHATS, groupId, 'messages');
                const messagesQuery = query(messagesRef, orderBy('createdAt', 'desc'));

                const listsRef = collection(db, COLLECTIONS.SHOPPING_LISTS);
                const listsQuery = query(listsRef, where('groupId', '==', groupId));

                const unsubscribeMessages = onSnapshot(
                    messagesQuery,
                    async (messagesSnapshot) => {
                        if (!isSubscribed) return;
                        const currentLastChatVisit = await getLastChatVisit(groupId);

                        const hasUnreadChat = messagesSnapshot.docs.some((doc) => {
                            const message = doc.data() as ChatMessage;
                            const messageTime = message.createdAt?.toMillis() || 0;
                            return messageTime > currentLastChatVisit && message.userId !== currentUserId;
                        });

                        const listsSnapshot = await new Promise<any>((resolve) => {
                            onSnapshot(listsQuery, resolve, () => resolve({ docs: [] }));
                        });

                        const listChecks = await Promise.all(
                            listsSnapshot.docs.map(async (doc: any) => {
                                const list = { id: doc.id, ...doc.data() } as ShoppingList;
                                const lastVisit = await getLastListVisit(list.id);

                                const updatedTime = list.updatedAt?.toMillis() || list.createdAt?.toMillis() || 0;
                                const updatedBy = list.lastUpdatedBy || list.createdBy;

                                return updatedTime > lastVisit && updatedBy !== currentUserId;
                            })
                        );

                        const hasUnreadLists = listChecks.some((hasChanges) => hasChanges);

                        setHasUnread(hasUnreadChat || hasUnreadLists);
                    },
                    (error) => {
                        if (error.code === 'permission-denied') {
                            if (isSubscribed) setHasUnread(false);
                            return;
                        }
                        console.error('Error listening to group updates:', error);
                        if (isSubscribed) setHasUnread(false);
                    }
                );

                const unsubscribeLists = onSnapshot(
                    listsQuery,
                    async (listsSnapshot) => {
                        if (!isSubscribed) return;

                        const currentLastChatVisit = await getLastChatVisit(groupId);
                        const messagesSnapshotNow = await new Promise<any>((resolve) => {
                            onSnapshot(messagesQuery, resolve, () => resolve({ docs: [] }));
                        });

                        const hasUnreadChat = messagesSnapshotNow.docs.some((doc: any) => {
                            const message = doc.data() as ChatMessage;
                            const messageTime = message.createdAt?.toMillis() || 0;
                            return messageTime > currentLastChatVisit && message.userId !== currentUserId;
                        });

                        const listChecks = await Promise.all(
                            listsSnapshot.docs.map(async (doc) => {
                                const list = { id: doc.id, ...doc.data() } as ShoppingList;
                                const lastVisit = await getLastListVisit(list.id);

                                const updatedTime = list.updatedAt?.toMillis() || list.createdAt?.toMillis() || 0;
                                const updatedBy = list.lastUpdatedBy || list.createdBy;

                                return updatedTime > lastVisit && updatedBy !== currentUserId;
                            })
                        );

                        const hasUnreadLists = listChecks.some((hasChanges) => hasChanges);

                        setHasUnread(hasUnreadChat || hasUnreadLists);
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
                    unsubscribeMessages();
                    unsubscribeLists();
                };
            } catch (error: any) {
                if (error?.code !== 'permission-denied' && !error?.message?.includes('insufficient permissions') &&
                    !error?.message?.includes('offline') && error?.code !== 'unavailable') {
                    console.error('Error setting up group unread listener:', error);
                }
                if (isSubscribed) setHasUnread(false);
            }
        };

        checkAllUnread();
    }, [groupId, currentUserId]);

    return hasUnread;
}
