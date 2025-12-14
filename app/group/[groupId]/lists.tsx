
import { db } from '@/firebase/config';
import { ShoppingGroup, ShoppingList } from '@/types';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    getDocs,
    onSnapshot,
    orderBy,
    query,
    Timestamp,
    updateDoc,
    where
} from 'firebase/firestore';
import React, { useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import BottomNavigationBar from '@/components/BottomNavigationBar';
import ConfirmModal from '@/components/ConfirmModal';
import InputModal from '@/components/InputModal';
import SyncIndicator from '@/components/SyncIndicator';
import UnreadIndicator from '@/components/UnreadIndicator';
import { COLLECTIONS, COLORS } from '@/constants';
import { useToast } from '@/contexts/ToastContext';
import { useAuth } from '@/hooks/useAuth';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useUnreadList } from '@/hooks/useUnreadList';
import { loadBackup, toSafeDate } from '@/utils/backupService';
import { handleError } from '@/utils/errorHandler';
import { notifyNewList } from '@/utils/notifications';
import { sanitizeInput, validateItemName } from '@/utils/validation';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { format } from 'date-fns';
import { uk } from 'date-fns/locale';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

const PENDING_TOGGLES_KEY = 'pending_item_toggles';

interface ShoppingListItemProps {
    list: ShoppingList;
    groupId: string;
    isOwner: boolean;
    currentUserId: string;
    onEdit: (list: ShoppingList) => void;
    onDelete: (list: ShoppingList) => void;
    isOffline: boolean;
}

function ShoppingListItem({
    list,
    groupId,
    isOwner,
    currentUserId,
    onEdit,
    onDelete,
    isOffline
}: ShoppingListItemProps) {
    const router = useRouter();
    const { showError } = useToast();
    const canModify = isOwner || list.createdBy === currentUserId;
    const hasUnread = useUnreadList(list.id, currentUserId);

    const [hasPendingWrites, setHasPendingWrites] = useState(false);

    useEffect(() => {
        if (!list.id) {
            setHasPendingWrites(false);
            return;
        }

        const listRef = doc(db, COLLECTIONS.SHOPPING_LISTS, list.id);
        const unsubscribe = onSnapshot(
            listRef,
            { includeMetadataChanges: true },
            (snapshot) => {
                if (snapshot.exists()) {
                    setHasPendingWrites(snapshot.metadata.hasPendingWrites);
                } else {
                    setHasPendingWrites(false);
                }
            },
            (error) => {
                if (error.code === 'permission-denied') {
                    setHasPendingWrites(false);
                } else {
                    console.error('Error tracking list writes:', error);
                    setHasPendingWrites(false);
                }
            }
        );
        return () => unsubscribe();
    }, [list.id]);

    const onPress = () => {
        router.push({
            pathname: `/list/${list.id}`,
            params: { groupId: groupId }
        });
    };

    return (
        <Pressable
            style={styles.listItem}
            onPress={onPress}
            accessibilityLabel={`Список покупок: ${list.name}`}
            accessibilityRole="button"
            accessibilityHint={`Відкриває список покупок ${list.name}`}
            accessibilityState={{ disabled: list.isComplete }}
        >
            <View style={{ flex: 1, position: 'relative' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={list.isComplete ? styles.listNameDone : styles.listName}>
                        {list.name}
                    </Text>
                    <SyncIndicator show={hasPendingWrites} size="small" />
                    <UnreadIndicator show={hasUnread} size={8} />
                </View>
                <Text style={styles.listDate}>
                    Створено: {format(toSafeDate(list.createdAt), 'dd.MM.yyyy, HH:mm', { locale: uk })}
                </Text>
            </View>
            {canModify && (
                <View style={styles.listActions}>
                    <Pressable
                        onPress={(e) => {
                            e.stopPropagation();
                            if (isOffline) {
                                showError('Неможливо редагувати список без інтернету');
                                return;
                            }
                            onEdit(list);
                        }}
                        disabled={isOffline}
                        style={{ marginRight: 15 }}
                        accessibilityLabel="Редагувати список"
                        accessibilityRole="button"
                    >
                        <Ionicons
                            name="pencil-outline"
                            size={20}
                            color={isOffline ? COLORS.DISABLED : COLORS.SECONDARY}
                        />
                    </Pressable>
                    <Pressable
                        onPress={(e) => {
                            e.stopPropagation();
                            if (isOffline) {
                                showError('Неможливо видалити список без інтернету');
                                return;
                            }
                            onDelete(list);
                        }}
                        disabled={isOffline}
                        style={{ marginRight: 10 }}
                        accessibilityLabel="Видалити список"
                        accessibilityRole="button"
                    >
                        <Ionicons
                            name="trash-outline"
                            size={20}
                            color={isOffline ? COLORS.DISABLED : COLORS.ERROR}
                        />
                    </Pressable>
                </View>
            )}
            <Ionicons name="chevron-forward-outline" size={24} color={COLORS.TEXT_TERTIARY} />
        </Pressable>
    );
}

export default function GroupListsTab() {
    const { groupId } = useLocalSearchParams<{ groupId: string }>();
    const { user } = useAuth();
    const [group, setGroup] = useState<ShoppingGroup | null>(null);
    const [lists, setLists] = useState<ShoppingList[]>([]);
    const insets = useSafeAreaInsets();
    const [modalVisible, setModalVisible] = useState(false);
    const [defaultListName, setDefaultListName] = useState('');
    const [editingList, setEditingList] = useState<ShoppingList | null>(null);
    const [isEditModalVisible, setIsEditModalVisible] = useState(false);
    const [deleteListConfirm, setDeleteListConfirm] = useState<ShoppingList | null>(null);
    const { showError, showSuccess } = useToast();
    const loadedFromBackupRef = useRef(false);
    const { isOffline } = useNetworkStatus();

    const isOwner = user?.uid === group?.ownerId;

    useEffect(() => {
        if (!groupId || loadedFromBackupRef.current) return;

        const loadFromBackup = async () => {
            try {
                const backup = await loadBackup();
                if (backup && backup.lists && backup.lists.length > 0) {
                    let groupLists = backup.lists.filter(l => l.groupId === groupId);

                    if (groupLists.length > 0 && backup.items) {
                        let pendingToggles: { [itemId: string]: boolean } = {};
                        try {
                            const pendingJson = await AsyncStorage.getItem(PENDING_TOGGLES_KEY);
                            if (pendingJson) {
                                pendingToggles = JSON.parse(pendingJson);
                            }
                        } catch (e) {
                            console.error('[LISTS] Error loading pending toggles:', e);
                        }

                        groupLists = groupLists.map(list => {
                            let listItems = backup.items.filter(item => item.shoppingListId === list.id);

                            listItems = listItems.map(item => {
                                if (pendingToggles[item.id] !== undefined) {
                                    return { ...item, isDone: pendingToggles[item.id] };
                                }
                                return item;
                            });

                            const allDone = listItems.length > 0 && listItems.every(item => item.isDone);

                            return { ...list, isComplete: allDone };
                        });
                    }

                    if (groupLists.length > 0) {
                        setLists(groupLists);
                        loadedFromBackupRef.current = true;
                    }
                }
                if (backup && backup.groups) {
                    const backupGroup = backup.groups.find(g => g.id === groupId);
                    if (backupGroup) {
                        setGroup(backupGroup);
                    }
                }
            } catch (error) {
                console.error('[LISTS] Error loading from backup:', error);
            }
        };

        loadFromBackup();
    }, [groupId]);

    useEffect(() => {
        if (!groupId) return;

        const groupRef = doc(db, COLLECTIONS.GROUPS, groupId as string);
        const unsubscribe = onSnapshot(
            groupRef,
            { includeMetadataChanges: true },
            (docSnap) => {
                if (docSnap.exists()) {
                    setGroup({ id: docSnap.id, ...docSnap.data() } as ShoppingGroup);
                } else {
                    setGroup(null);
                }
            },
            (error) => {
                if (error.code === 'permission-denied') {
                    setGroup(null);
                    return;
                }
                if (error.code === 'unavailable') {
                    return;
                }
                handleError(error, { showAlert: false });
                showError('Помилка завантаження групи');
            }
        );

        return () => unsubscribe();
    }, [groupId]);

    useEffect(() => {
        if (!groupId || !user) return;

        const q = query(
            collection(db, COLLECTIONS.SHOPPING_LISTS),
            where('groupId', '==', groupId),
            orderBy('isComplete'),
            orderBy('createdAt', 'desc')
        );

        const unsubscribe = onSnapshot(
            q,
            { includeMetadataChanges: true },
            async (snapshot) => {
                let groupLists: ShoppingList[] = [];
                snapshot.forEach((doc) => {
                    const data = doc.data();
                    groupLists.push({ id: doc.id, ...data } as ShoppingList);
                });

                if (groupLists.length > 0) {
                    try {
                        const backup = await loadBackup();
                        const pendingJson = await AsyncStorage.getItem(PENDING_TOGGLES_KEY);
                        const pendingToggles: { [itemId: string]: boolean } = pendingJson ? JSON.parse(pendingJson) : {};

                        if (backup && backup.items && (Object.keys(pendingToggles).length > 0 || snapshot.metadata.fromCache)) {
                            groupLists = groupLists.map(list => {
                                let listItems = backup.items.filter(item => item.shoppingListId === list.id);

                                listItems = listItems.map(item => {
                                    if (pendingToggles[item.id] !== undefined) {
                                        return { ...item, isDone: pendingToggles[item.id] };
                                    }
                                    return item;
                                });

                                const allDone = listItems.length > 0 && listItems.every(item => item.isDone);

                                if (list.isComplete !== allDone) {
                                    return { ...list, isComplete: allDone };
                                }
                                return list;
                            });
                        }
                    } catch (e) {
                        console.error('[LISTS] Error recalculating completion:', e);
                    }
                }

                if (groupLists.length > 0 || !loadedFromBackupRef.current) {
                    setLists(groupLists);
                }
            },
            (error) => {
                if (error.code === 'permission-denied') {
                    if (!loadedFromBackupRef.current) {
                        setLists([]);
                    }
                    return;
                }
                if (error.code === 'unavailable') {
                    return;
                }
                console.error('Error loading shopping lists:', error);
                handleError(error, { showAlert: false });
                showError('Не вдалося завантажити списки покупок');
            }
        );

        return () => unsubscribe();
    }, [groupId, user]);

    const filteredLists = lists;

    const handleCreateList = () => {
        if (!user || !groupId) return;
        const listName = `Покупки ${format(new Date(), 'dd.MM', { locale: uk })}`;
        setDefaultListName(listName);
        setModalVisible(true);
    };

    const handleSubmitListName = async (customName: string) => {
        if (!user || !groupId) return;

        const trimmedName = customName.trim();

        if (!trimmedName) {
            showError('Назва списку не може бути порожньою');
            throw new Error('Empty list name'); 
        }

        const validation = validateItemName(trimmedName);

        if (!validation.isValid) {
            showError(validation.error || 'Некоректна назва списку');
            throw new Error('Invalid list name'); 
        }

        const sanitizedName = sanitizeInput(trimmedName);

        try {
            await addDoc(collection(db, COLLECTIONS.SHOPPING_LISTS), {
                groupId: groupId,
                name: sanitizedName,
                createdAt: Timestamp.now(),
                createdBy: user.uid,
                isComplete: false,
                updatedAt: Timestamp.now(),
                lastUpdatedBy: user.uid,
            });
            showSuccess('Список створено');

            notifyNewList(groupId, sanitizedName, user.uid).catch(err => {
                console.error('Failed to send notification:', err);
            });
        } catch (error) {
            handleError(error, { showAlert: false });
            showError('Не вдалося створити список');
            throw error; 
        }
    };

    const handleEditList = (list: ShoppingList) => {
        setEditingList(list);
        setIsEditModalVisible(true);
    };

    const handleSaveEdit = async (newName: string) => {
        if (!editingList) return;

        const trimmedName = newName.trim();

        if (!trimmedName) {
            showError('Назва списку не може бути порожньою');
            throw new Error('Empty list name');
        }

        const validation = validateItemName(trimmedName);

        if (!validation.isValid) {
            showError(validation.error || 'Некоректна назва списку');
            throw new Error('Invalid list name');
        }

        const sanitizedName = sanitizeInput(trimmedName);

        try {
            await updateDoc(doc(db, COLLECTIONS.SHOPPING_LISTS, editingList.id), {
                name: sanitizedName,
            });
            showSuccess('Список оновлено');
            setEditingList(null);
        } catch (error) {
            handleError(error, { showAlert: false });
            showError('Не вдалося оновити список');
            throw error;
        }
    };

    const handleDeleteList = (list: ShoppingList) => {
        setDeleteListConfirm(list);
    };

    const confirmDeleteList = async () => {
        if (!deleteListConfirm) return;

        setDeleteListConfirm(null);

        try {
            const itemsQuery = query(
                collection(db, COLLECTIONS.ITEMS),
                where('shoppingListId', '==', deleteListConfirm.id)
            );
            const itemsSnapshot = await getDocs(itemsQuery);

            for (const itemDoc of itemsSnapshot.docs) {
                await deleteDoc(doc(db, COLLECTIONS.ITEMS, itemDoc.id));
            }

            await deleteDoc(doc(db, COLLECTIONS.SHOPPING_LISTS, deleteListConfirm.id));
            showSuccess('Список видалено');
        } catch (error) {
            handleError(error, { showAlert: false });
            showError('Не вдалося видалити список');
        }
    };

    return (
        <View style={{ flex: 1 }}>
            <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
                <FlatList
                    data={filteredLists}
                    renderItem={({ item }) => (
                        <ShoppingListItem
                            list={item}
                            groupId={groupId || ''}
                            isOwner={isOwner}
                            currentUserId={user?.uid || ''}
                            onEdit={handleEditList}
                            onDelete={handleDeleteList}
                            isOffline={isOffline}
                        />
                    )}
                    keyExtractor={(item) => item.id}
                    accessibilityLabel="Списки покупок у групі"
                    ListEmptyComponent={
                        <Text style={styles.emptyText}>
                            Натисніть (+), щоб створити перший список покупок
                        </Text>
                    }
                />
                <Pressable
                    style={[
                        styles.fab,
                        { bottom: insets.bottom + 20 },
                        isOffline && styles.fabDisabled
                    ]}
                    onPress={() => {
                        if (isOffline) {
                            showError('Неможливо створити список без інтернету');
                            return;
                        }
                        handleCreateList();
                    }}
                    disabled={isOffline}
                    accessibilityLabel="Створити новий список покупок"
                    accessibilityRole="button"
                    accessibilityHint="Відкриває форму для створення нового списку покупок"
                >
                    <Ionicons name="add" size={30} color={COLORS.WHITE} />
                </Pressable>

                <InputModal
                    visible={modalVisible}
                    title="Створити список покупок"
                    placeholder="Введіть назву списку"
                    initialValue={defaultListName}
                    submitText="Створити"
                    onSubmit={handleSubmitListName}
                    onClose={() => setModalVisible(false)}
                />

                <InputModal
                    visible={isEditModalVisible}
                    title="Редагувати список"
                    placeholder="Введіть нову назву списку"
                    initialValue={editingList?.name || ''}
                    submitText="Зберегти"
                    onSubmit={handleSaveEdit}
                    onClose={() => {
                        setIsEditModalVisible(false);
                        setEditingList(null);
                    }}
                />

                <ConfirmModal
                    visible={!!deleteListConfirm}
                    title="Видалити список"
                    message={`Ви впевнені, що хочете видалити "${deleteListConfirm?.name}"? Це також видалить усі товари в цьому списку.`}
                    confirmText="Видалити"
                    cancelText="Скасувати"
                    onConfirm={confirmDeleteList}
                    onCancel={() => setDeleteListConfirm(null)}
                    destructive
                />
            </SafeAreaView>
            <BottomNavigationBar />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.WHITE,
    },
    listItem: {
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.BORDER_LIGHT,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    listName: {
        fontSize: 16,
        fontWeight: '500',
        color: COLORS.TEXT_PRIMARY,
    },
    listNameDone: {
        fontSize: 16,
        fontWeight: '500',
        color: COLORS.TEXT_SECONDARY,
        textDecorationLine: 'line-through',
    },
    listDate: {
        fontSize: 12,
        color: COLORS.TEXT_SECONDARY,
        marginTop: 4,
    },
    listActions: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    emptyText: {
        textAlign: 'center',
        marginTop: 50,
        fontSize: 16,
        color: COLORS.TEXT_SECONDARY,
    },
    fab: {
        position: 'absolute',
        right: 20,
        bottom: 20,
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: COLORS.PRIMARY,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 5,
        shadowColor: COLORS.BLACK,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 3,
    },
    fabDisabled: {
        backgroundColor: COLORS.DISABLED,
        opacity: 0.6,
    },
});