import { COLLECTIONS } from '@/constants';
import { db } from '@/firebase/config';
import { useAuth } from '@/hooks/useAuth';
import { ChatMessage, ShoppingGroup, ShoppingList } from '@/types';
import { showLocalNotification } from '@/utils/notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    collection,
    limit,
    onSnapshot,
    orderBy,
    query,
    where
} from 'firebase/firestore';
import { useCallback, useEffect, useRef } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';

const STORAGE_KEYS = {
    NOTIFIED_MESSAGES: 'ios_notified_messages',
    NOTIFIED_LISTS: 'ios_notified_lists',
    NOTIFIED_LIST_UPDATES: 'ios_notified_list_updates',
    LAST_ACTIVE_TIME: 'ios_last_active_time',
};

const MAX_NOTIFIED_ITEMS = 500;

const groupNameCache = new Map<string, string>();

export function useIOSLocalNotifications(): void {
    if (Platform.OS !== 'ios') {
        return;
    }

    const { user, userProfile } = useAuth();
    const appState = useRef<AppStateStatus>(AppState.currentState);
    const isBackgroundRef = useRef(false);

    const notifiedMessages = useRef<Set<string>>(new Set());
    const notifiedLists = useRef<Set<string>>(new Set());
    const notifiedListUpdates = useRef<Set<string>>(new Set());

    const initTimeRef = useRef<number>(Date.now());

    const userGroupsRef = useRef<ShoppingGroup[]>([]);

    useEffect(() => {
        async function loadNotifiedItems() {
            try {
                const [messages, lists, updates] = await Promise.all([
                    AsyncStorage.getItem(STORAGE_KEYS.NOTIFIED_MESSAGES),
                    AsyncStorage.getItem(STORAGE_KEYS.NOTIFIED_LISTS),
                    AsyncStorage.getItem(STORAGE_KEYS.NOTIFIED_LIST_UPDATES),
                ]);

                if (messages) {
                    notifiedMessages.current = new Set(JSON.parse(messages));
                }
                if (lists) {
                    notifiedLists.current = new Set(JSON.parse(lists));
                }
                if (updates) {
                    notifiedListUpdates.current = new Set(JSON.parse(updates));
                }
            } catch (error) {
                console.error('[iOS-NOTIF] Error loading notified items:', error);
            }
        }

        loadNotifiedItems();
    }, []);

    const saveNotifiedItems = useCallback(async () => {
        try {
            const trimSet = (set: Set<string>): string[] => {
                const arr = Array.from(set);
                return arr.length > MAX_NOTIFIED_ITEMS
                    ? arr.slice(-MAX_NOTIFIED_ITEMS)
                    : arr;
            };

            await Promise.all([
                AsyncStorage.setItem(
                    STORAGE_KEYS.NOTIFIED_MESSAGES,
                    JSON.stringify(trimSet(notifiedMessages.current))
                ),
                AsyncStorage.setItem(
                    STORAGE_KEYS.NOTIFIED_LISTS,
                    JSON.stringify(trimSet(notifiedLists.current))
                ),
                AsyncStorage.setItem(
                    STORAGE_KEYS.NOTIFIED_LIST_UPDATES,
                    JSON.stringify(trimSet(notifiedListUpdates.current))
                ),
            ]);
        } catch (error) {
            console.error('[iOS-NOTIF] Error saving notified items:', error);
        }
    }, []);

    useEffect(() => {
        const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
            const wasBackground = isBackgroundRef.current;
            isBackgroundRef.current = nextAppState !== 'active';

            if (wasBackground && nextAppState === 'active') {
                AsyncStorage.setItem(STORAGE_KEYS.LAST_ACTIVE_TIME, Date.now().toString());
            }

            appState.current = nextAppState;
        });

        return () => {
            subscription.remove();
        };
    }, []);

    const getGroupName = useCallback((groupId: string): string => {
        if (groupNameCache.has(groupId)) {
            return groupNameCache.get(groupId)!;
        }

        const group = userGroupsRef.current.find(g => g.id === groupId);
        if (group) {
            groupNameCache.set(groupId, group.name);
            return group.name;
        }

        return 'Група';
    }, []);

    useEffect(() => {
        if (!user) {
            return;
        }

        const unsubscribers: (() => void)[] = [];

        const groupsQuery = query(
            collection(db, COLLECTIONS.GROUPS),
            where('members', 'array-contains', user.uid)
        );

        const groupsUnsubscribe = onSnapshot(
            groupsQuery,
            (snapshot) => {
                const groups: ShoppingGroup[] = [];
                snapshot.forEach((doc) => {
                    const data = doc.data();
                    groups.push({
                        id: doc.id,
                        name: data.name,
                        ownerId: data.ownerId,
                        members: data.members,
                        createdAt: data.createdAt,
                    });
                    groupNameCache.set(doc.id, data.name);
                });

                userGroupsRef.current = groups;
            },
            (error) => {
                console.error('[iOS-NOTIF] Error listening to groups:', error);
            }
        );
        unsubscribers.push(groupsUnsubscribe);

        const listsQuery = query(
            collection(db, COLLECTIONS.SHOPPING_LISTS),
            orderBy('createdAt', 'desc'),
            limit(100) 
        );

        const listsUnsubscribe = onSnapshot(
            listsQuery,
            (snapshot) => {
                if (!isBackgroundRef.current) {
                    return;
                }

                snapshot.docChanges().forEach((change) => {
                    if (change.type === 'added' || change.type === 'modified') {
                        const data = change.doc.data();
                        const list: ShoppingList = {
                            id: change.doc.id,
                            groupId: data.groupId,
                            name: data.name,
                            createdAt: data.createdAt,
                            createdBy: data.createdBy,
                            isComplete: data.isComplete,
                            updatedAt: data.updatedAt,
                            lastUpdatedBy: data.lastUpdatedBy,
                        };

                        const isMember = userGroupsRef.current.some(g => g.id === list.groupId);
                        if (!isMember) return;

                        if (list.createdBy === user.uid) return;
                        if (list.lastUpdatedBy === user.uid) return;

                        const listTime = list.createdAt?.toMillis() || 0;
                        const updateTime = list.updatedAt?.toMillis() || 0;
                        const relevantTime = Math.max(listTime, updateTime);

                        if (relevantTime < initTimeRef.current) return;

                        const groupName = getGroupName(list.groupId);

                        if (change.type === 'added') {
                            const notifKey = `list_${list.id}`;
                            if (!notifiedLists.current.has(notifKey)) {
                                notifiedLists.current.add(notifKey);
                                saveNotifiedItems();

                                showLocalNotification(
                                    groupName,
                                    `Новий список: "${list.name}"`,
                                    { groupId: list.groupId, type: 'new_list' }
                                );
                            }
                        } else if (change.type === 'modified' && list.updatedAt) {
                            const notifKey = `update_${list.id}_${updateTime}`;
                            if (!notifiedListUpdates.current.has(notifKey)) {
                                notifiedListUpdates.current.add(notifKey);
                                saveNotifiedItems();

                                if (list.isComplete) {
                                    showLocalNotification(
                                        groupName,
                                        `Список "${list.name}" завершено`,
                                        { groupId: list.groupId, type: 'list_completed' }
                                    );
                                } else {
                                    showLocalNotification(
                                        groupName,
                                        `Оновлено список "${list.name}"`,
                                        { groupId: list.groupId, type: 'list_updated' }
                                    );
                                }
                            }
                        }
                    }
                });
            },
            (error) => {
                console.error('[iOS-NOTIF] Error listening to lists:', error);
            }
        );
        unsubscribers.push(listsUnsubscribe);

        return () => {
            unsubscribers.forEach(unsub => unsub());
        };
    }, [user, getGroupName, saveNotifiedItems]);

    useEffect(() => {
        if (!user || userGroupsRef.current.length === 0) {
            return;
        }

        const timeoutId = setTimeout(() => {
            setupChatListeners();
        }, 1000);

        const chatUnsubscribers: (() => void)[] = [];

        function setupChatListeners() {
            userGroupsRef.current.forEach((group) => {
                const messagesQuery = query(
                    collection(db, COLLECTIONS.CHATS, group.id, COLLECTIONS.MESSAGES),
                    orderBy('createdAt', 'desc'),
                    limit(20) 
                );

                const unsubscribe = onSnapshot(
                    messagesQuery,
                    (snapshot) => {
                        if (!isBackgroundRef.current) {
                            return;
                        }

                        snapshot.docChanges().forEach((change) => {
                            if (change.type === 'added') {
                                const data = change.doc.data();
                                const message: ChatMessage = {
                                    id: change.doc.id,
                                    text: data.text,
                                    createdAt: data.createdAt,
                                    userId: data.userId,
                                    userName: data.userName,
                                    imageUrl: data.imageUrl,
                                    imageUrls: data.imageUrls,
                                };

                                if (message.userId === user.uid) return;

                                const messageTime = message.createdAt?.toMillis() || 0;
                                if (messageTime < initTimeRef.current) return;

                                const notifKey = `msg_${message.id}`;
                                if (notifiedMessages.current.has(notifKey)) return;

                                notifiedMessages.current.add(notifKey);
                                saveNotifiedItems();

                                let body: string;
                                if (message.text) {
                                    const truncated = message.text.length > 50
                                        ? message.text.substring(0, 50) + '...'
                                        : message.text;
                                    body = `${message.userName}: ${truncated}`;
                                } else if (message.imageUrls?.length || message.imageUrl) {
                                    const photoCount = message.imageUrls?.length || 1;
                                    body = `${message.userName}: [${photoCount > 1 ? `${photoCount} фото` : 'Фото'}]`;
                                } else {
                                    body = `${message.userName}: Нове повідомлення`;
                                }

                                showLocalNotification(
                                    group.name,
                                    body,
                                    { groupId: group.id, type: 'new_message' }
                                );
                            }
                        });
                    },
                    (error) => {
                        if (error?.code !== 'permission-denied') {
                            console.error(`[iOS-NOTIF] Error listening to chat ${group.id}:`, error);
                        }
                    }
                );

                chatUnsubscribers.push(unsubscribe);
            });
        }

        return () => {
            clearTimeout(timeoutId);
            chatUnsubscribers.forEach(unsub => unsub());
        };
    }, [user, saveNotifiedItems]);
}