import { COLLECTIONS } from '@/constants';
import { db } from '@/firebase/config';
import { ChatMessage } from '@/types';
import { getLastChatVisit } from '@/utils/readStatus';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { useEffect, useState } from 'react';


export function useUnreadChat(
    groupId: string | undefined,
    currentUserId: string | undefined,
    refreshTrigger?: number
): boolean {
    const [hasUnread, setHasUnread] = useState(false);

    useEffect(() => {
        if (!groupId || !currentUserId) {
            setHasUnread(false);
            return;
        }

        let isSubscribed = true;

        const checkUnread = async (snapshot: any) => {
            if (!isSubscribed) return;

            const lastVisit = await getLastChatVisit(groupId);

            const unreadExists = snapshot.docs.some((doc: any) => {
                const message = doc.data() as ChatMessage;
                const messageTime = message.createdAt?.toMillis() || 0;
                return messageTime > lastVisit && message.userId !== currentUserId;
            });

            setHasUnread(unreadExists);
        };
        
        const messagesRef = collection(db, COLLECTIONS.CHATS, groupId, 'messages');
        const q = query(messagesRef, orderBy('createdAt', 'desc'));

        const unsubscribe = onSnapshot(
            q,
            checkUnread,
            (error) => {
                if (error.code === 'permission-denied') {
                    if (isSubscribed) setHasUnread(false);
                    return;
                }
                console.error('Error listening to chat messages for unread:', error);
                if (isSubscribed) setHasUnread(false);
            }
        );

        return () => {
            isSubscribed = false;
            unsubscribe();
        };
    }, [groupId, currentUserId, refreshTrigger]);

    return hasUnread;
}
