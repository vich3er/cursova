import BottomNavigationBar from '@/components/BottomNavigationBar';
import InputModal from '@/components/InputModal';
import PhotoPicker from '@/components/PhotoPicker';
import PhotoPreviewModal from '@/components/PhotoPreviewModal';
import SyncIndicator from '@/components/SyncIndicator';
import { COLLECTIONS, COLORS } from '@/constants';
import { useToast } from '@/contexts/ToastContext';
import { db } from '@/firebase/config';
import { useAuth } from '@/hooks/useAuth';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { ShoppingGroup, ShoppingItem, ShoppingList } from '@/types';
import { autoUpdateListCompletion } from "@/utils/autoUpdateListCompletion";
import { loadBackup, updateItemInBackup, updateListCompletionInBackup } from '@/utils/backupService';
import { handleError } from '@/utils/errorHandler';
import { deleteItemPhoto, uploadItemPhoto } from '@/utils/imageUpload';
import { updateListTimestamp } from '@/utils/listTimestamp';
import { notifyItemUpdate, notifyNewItem } from '@/utils/notifications';
import { markListAsRead } from '@/utils/readStatus';
import { sanitizeInput, validateItemName } from '@/utils/validation';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    getDoc,
    onSnapshot,
    orderBy,
    query,
    Timestamp,
    updateDoc,
    where,
} from 'firebase/firestore';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    Alert,
    BackHandler,
    FlatList,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const PENDING_TOGGLES_KEY = 'pending_item_toggles';

interface ItemRowProps {
    item: ShoppingItem;
    currentUserId: string | undefined;
    isGroupOwner: boolean;
    isListCreator: boolean;
    onEdit: (item: ShoppingItem) => void;
    onPhotoPress: (photoUrl: string) => void;
    onToggle: (itemId: string, newIsDone: boolean) => Promise<void>;
    listId: string;
    isOffline: boolean;
}

const ItemRow = React.memo(({ item, currentUserId, isGroupOwner, isListCreator, onEdit, onPhotoPress, onToggle, listId, isOffline }: ItemRowProps) => {
    const isAuthor = item.addedBy === currentUserId;
    const canModify = isAuthor || isGroupOwner || isListCreator;
    const { showError, showSuccess } = useToast();
    const [hasPendingWrites, setHasPendingWrites] = useState(false);

    useEffect(() => {
        if (!item.id) {
            setHasPendingWrites(false);
            return;
        }

        const itemRef = doc(db, COLLECTIONS.ITEMS, item.id);
        const unsubscribe = onSnapshot(
            itemRef,
            { includeMetadataChanges: true },
            (snapshot) => {
                if (snapshot.exists()) {
                    setHasPendingWrites(snapshot.metadata.hasPendingWrites);
                } else {
                    setHasPendingWrites(false);
                }
            },
            (error) => {
                if (error.code !== 'permission-denied' && error.code !== 'unavailable') {
                    console.error('Error tracking item writes:', error);
                }
                setHasPendingWrites(false);
            }
        );
        return () => unsubscribe();
    }, [item.id]);

    const toggleDone = useCallback(async () => {
        const newIsDone = !item.isDone;

        await onToggle(item.id, newIsDone);

        try {
            const pendingJson = await AsyncStorage.getItem(PENDING_TOGGLES_KEY);
            const pendingToggles: { [itemId: string]: boolean } = pendingJson ? JSON.parse(pendingJson) : {};
            pendingToggles[item.id] = newIsDone;
            await AsyncStorage.setItem(PENDING_TOGGLES_KEY, JSON.stringify(pendingToggles));

            await updateItemInBackup(item.id, newIsDone);
        } catch (storageError) {
            console.error('[TOGGLE] Failed to save locally:', storageError);
        }

        try {
            const itemRef = doc(db, COLLECTIONS.ITEMS, item.id);
            await updateDoc(itemRef, {
                isDone: newIsDone,
            });

            if (currentUserId) {
                await updateListTimestamp(listId, currentUserId);
            }
            await autoUpdateListCompletion(listId, currentUserId);

            try {
                const pendingJson = await AsyncStorage.getItem(PENDING_TOGGLES_KEY);
                if (pendingJson) {
                    const pendingToggles: { [itemId: string]: boolean } = JSON.parse(pendingJson);
                    delete pendingToggles[item.id];
                    if (Object.keys(pendingToggles).length === 0) {
                        await AsyncStorage.removeItem(PENDING_TOGGLES_KEY);
                    } else {
                        await AsyncStorage.setItem(PENDING_TOGGLES_KEY, JSON.stringify(pendingToggles));
                    }
                }
            } catch (e) {
                console.error('[TOGGLE] Failed to clear pending:', e);
            }

        } catch (error: any) {
            if (error?.code === 'unavailable' || error?.message?.includes('offline')) {
            } else {
                handleError(error, { showAlert: false });
                showError('Не вдалося оновити статус товару');
                await onToggle(item.id, item.isDone);

                try {
                    const pendingJson = await AsyncStorage.getItem(PENDING_TOGGLES_KEY);
                    if (pendingJson) {
                        const pendingToggles: { [itemId: string]: boolean } = JSON.parse(pendingJson);
                        delete pendingToggles[item.id];
                        await AsyncStorage.setItem(PENDING_TOGGLES_KEY, JSON.stringify(pendingToggles));
                    }
                    await updateItemInBackup(item.id, item.isDone); 
                } catch (e) {
                    console.error('[TOGGLE] Failed to revert:', e);
                }
            }
        }
    }, [item.id, item.isDone, listId, currentUserId, showError, onToggle]);

    const handleEdit = useCallback(() => {
        if (isOffline) {
            showError('Неможливо редагувати товар без інтернету');
            return;
        }
        if (!canModify) {
            showError('Недостатньо прав для редагування');
            return;
        }
        onEdit(item);
    }, [isOffline, canModify, item, onEdit, showError]);

    const handleDelete = useCallback(async () => {
        if (isOffline) {
            showError('Неможливо видалити товар без інтернету');
            return;
        }
        if (!canModify) {
            showError('Недостатньо прав для видалення');
            return;
        }

        const doDelete = async () => {
            try {
                if (item.photoURL) {
                    try {
                        await deleteItemPhoto(item.photoURL);
                    } catch (photoError) {
                        console.error('Error deleting photo:', photoError);
                    }
                }

                await deleteDoc(doc(db, COLLECTIONS.ITEMS, item.id));

                if (currentUserId) {
                    await updateListTimestamp(listId, currentUserId);
                }

                showSuccess('Товар видалено');
            } catch (error) {
                handleError(error, { showAlert: false });
                showError('Не вдалося видалити товар');
            }
        };

        if (Platform.OS === 'web') {
            if (window.confirm(`Видалити ${item.text}?`)) {
                await doDelete();
            }
        } else {
            Alert.alert('Видалення', `Видалити ${item.text}?`, [
                { text: 'Скасувати', style: 'cancel' },
                {
                    text: 'Видалити',
                    style: 'destructive',
                    onPress: doDelete,
                },
            ]);
        }
    }, [isOffline, canModify, item.id, item.text, item.photoURL, listId, currentUserId, showError, showSuccess]);

    return (
        <View style={styles.itemRow}>
            <Pressable
                onPress={toggleDone}
                style={styles.checkbox}
                accessibilityLabel={item.isDone ? 'Позначити як не виконане' : 'Позначити як виконане'}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: item.isDone }}
            >
                <Ionicons
                    name={item.isDone ? 'checkbox' : 'square-outline'}
                    size={24}
                    color={item.isDone ? COLORS.COMPLETED : COLORS.PRIMARY}
                />
            </Pressable>

            {item.photoURL && (
                <Pressable
                    onPress={() => onPhotoPress(item.photoURL!)}
                    style={styles.photoIndicator}
                    accessibilityLabel="Переглянути фото товару"
                    accessibilityRole="button"
                >
                    <Ionicons name="camera" size={20} color={COLORS.INFO} />
                </Pressable>
            )}

            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={item.isDone ? styles.itemTextDone : styles.itemText}>
                    {item.text}
                </Text>
                <SyncIndicator show={hasPendingWrites} size="small" />
            </View>

            {canModify && (
                <View style={styles.actions}>
                    <Pressable
                        onPress={handleEdit}
                        style={{ marginRight: 15 }}
                        disabled={isOffline}
                        accessibilityLabel="Редагувати товар"
                        accessibilityRole="button"
                    >
                        <Ionicons
                            name="pencil-outline"
                            size={20}
                            color={isOffline ? COLORS.DISABLED : COLORS.SECONDARY}
                        />
                    </Pressable>
                    <Pressable
                        onPress={handleDelete}
                        disabled={isOffline}
                        accessibilityLabel="Видалити товар"
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
        </View>
    );
});

export default function ShoppingListScreen() {
    const { listId, groupId } = useLocalSearchParams<{ listId: string; groupId?: string }>();
    const { user } = useAuth();
    const navigation = useNavigation();
    const router = useRouter();
    const { showError, showSuccess } = useToast();
    const { isOffline } = useNetworkStatus();

    const [items, setItems] = useState<ShoppingItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [newItemText, setNewItemText] = useState('');
    const [editingItem, setEditingItem] = useState<ShoppingItem | null>(null);
    const [isEditModalVisible, setIsEditModalVisible] = useState(false);
    const [selectedPhotoUri, setSelectedPhotoUri] = useState<string | null>(null);
    const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
    const [isPhotoPreviewVisible, setIsPhotoPreviewVisible] = useState(false);
    const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
    const [editPhotoUri, setEditPhotoUri] = useState<string | null>(null);
    const [editPhotoRemoved, setEditPhotoRemoved] = useState(false);
    const [group, setGroup] = useState<ShoppingGroup | null>(null);
    const [shoppingList, setShoppingList] = useState<ShoppingList | null>(null);
    const loadedFromBackupRef = useRef(false);
    const syncingPendingRef = useRef(false);

    const isGroupOwner = user?.uid === group?.ownerId;
    const isListCreator = user?.uid === shoppingList?.createdBy;

    useEffect(() => {
        if (isOffline || syncingPendingRef.current) return;

        const syncPendingToggles = async () => {
            try {
                syncingPendingRef.current = true;
                const pendingJson = await AsyncStorage.getItem(PENDING_TOGGLES_KEY);
                if (!pendingJson) {
                    syncingPendingRef.current = false;
                    return;
                }

                const pendingToggles: { [itemId: string]: boolean } = JSON.parse(pendingJson);
                const itemIds = Object.keys(pendingToggles);

                if (itemIds.length === 0) {
                    syncingPendingRef.current = false;
                    return;
                }

                for (const itemId of itemIds) {
                    try {
                        const itemRef = doc(db, COLLECTIONS.ITEMS, itemId);
                        await updateDoc(itemRef, {
                            isDone: pendingToggles[itemId],
                        });
                    } catch (error) {
                        console.error('[SYNC] Failed to sync item:', error);
                    }
                }

                await AsyncStorage.removeItem(PENDING_TOGGLES_KEY);
                syncingPendingRef.current = false;
            } catch (error) {
                console.error('[SYNC] Error syncing pending toggles:', error);
                syncingPendingRef.current = false;
            }
        };

        syncPendingToggles();
    }, [isOffline]);

    useEffect(() => {
        if (!listId || loadedFromBackupRef.current) return;

        const loadFromBackup = async () => {
            try {
                const backup = await loadBackup();

                if (backup && backup.items && backup.items.length > 0) {

                    let listItems = backup.items.filter(i => i.shoppingListId === listId);

                    try {
                        const pendingJson = await AsyncStorage.getItem(PENDING_TOGGLES_KEY);
                        if (pendingJson) {
                            const pendingToggles: { [itemId: string]: boolean } = JSON.parse(pendingJson);
                            listItems = listItems.map(item => {
                                if (pendingToggles[item.id] !== undefined) {
                                    return { ...item, isDone: pendingToggles[item.id] };
                                }
                                return item;
                            });
                        }
                    } catch (storageError) {
                        console.error('[BACKUP] Error loading pending toggles:', storageError);
                    }

                    if (listItems.length > 0) {
                        setItems(listItems);
                        loadedFromBackupRef.current = true;

                        const allDone = listItems.every(item => item.isDone);

                        if (backup && backup.lists) {
                            const backupList = backup.lists.find(l => l.id === listId);
                            if (backupList) {
                                setShoppingList({ ...backupList, isComplete: allDone });

                                if (backupList.isComplete !== allDone) {
                                    updateListCompletionInBackup(listId as string, allDone).catch(err => {
                                        console.error('[BACKUP] Failed to update list completion:', err);
                                    });
                                }
                                if (backup.groups) {
                                    const backupGroup = backup.groups.find(g => g.id === backupList.groupId);
                                    if (backupGroup) {
                                        setGroup(backupGroup);
                                    }
                                }
                            }
                        }
                    }
                } else {
                    if (backup && backup.lists) {
                        const backupList = backup.lists.find(l => l.id === listId);
                        if (backupList) {
                            setShoppingList(backupList);

                            if (backup.groups) {
                                const backupGroup = backup.groups.find(g => g.id === backupList.groupId);
                                if (backupGroup) {
                                    setGroup(backupGroup);
                                }
                            }
                        }
                    }
                }
            } catch (error) {
                console.error('[ITEMS] Error loading from backup:', error);
            }
        };

        loadFromBackup();
    }, [listId]);

    const handleBackPress = useCallback(() => {
        if (groupId) {
            router.replace(`/group/${groupId}/lists`);
            return true;
        }
        return false;
    }, [groupId, router]);

    useEffect(() => {
        if (!groupId) return;

        const backHandler = BackHandler.addEventListener('hardwareBackPress', handleBackPress);

        return () => {
            backHandler.remove();
        };
    }, [groupId, handleBackPress]);

    useEffect(() => {
        if (!groupId || !listId) return;

        const loadGroupAndListInfo = async () => {
            try {
                const listRef = doc(db, COLLECTIONS.SHOPPING_LISTS, listId);
                const listSnap = await getDoc(listRef);

                if (listSnap.exists()) {
                    const listData = { id: listSnap.id, ...listSnap.data() } as ShoppingList;
                    setShoppingList(listData);

                    const actualGroupId = listData.groupId;

                    const groupRef = doc(db, COLLECTIONS.GROUPS, actualGroupId);
                    const groupSnap = await getDoc(groupRef);

                    if (groupSnap.exists()) {
                        setGroup({ id: groupSnap.id, ...groupSnap.data() } as ShoppingGroup);
                    }
                }
            } catch (error) {
                console.error('Error loading group and list:', error);
            }
        };

        loadGroupAndListInfo();
    }, [groupId, listId]);

    useEffect(() => {
        if (!listId) return;
        const listRef = doc(db, COLLECTIONS.SHOPPING_LISTS, listId);

        const unsubscribe = onSnapshot(listRef, (docSnap) => {
            if (docSnap.exists()) {
                const listData = docSnap.data();
                navigation.setOptions({
                    title: listData.name,
                    headerTitleAlign: 'center',
                    headerStyle: {
                        backgroundColor: listData.isComplete ? COLORS.BACKGROUND_SECONDARY : COLORS.WHITE
                    },
                    headerLeft: () => (
                        <Pressable onPress={handleBackPress} style={{ marginLeft: 15 }}>
                            <Ionicons name="arrow-back" size={24} color={COLORS.TEXT_PRIMARY} />
                        </Pressable>
                    )
                });
            }
        });
        return () => unsubscribe();
    }, [listId, navigation, handleBackPress]);

    useEffect(() => {
        if (!shoppingList) return;

        navigation.setOptions({
            headerStyle: {
                backgroundColor: shoppingList.isComplete ? COLORS.BACKGROUND_SECONDARY : COLORS.WHITE
            },
        });
    }, [shoppingList?.isComplete, navigation]);

    useEffect(() => {
        if (!listId) return;
        const q = query(
            collection(db, COLLECTIONS.ITEMS),
            where('shoppingListId', '==', listId),
            orderBy('isDone'),
            orderBy('createdAt', 'desc')
        );

        const unsubscribe = onSnapshot(
            q,
            { includeMetadataChanges: true },
            async (snapshot) => {
                let listItems: ShoppingItem[] = [];
                snapshot.forEach((doc) => {
                    listItems.push({ id: doc.id, ...doc.data() } as ShoppingItem);
                });

                try {
                    const pendingJson = await AsyncStorage.getItem(PENDING_TOGGLES_KEY);
                    if (pendingJson) {
                        const pendingToggles: { [itemId: string]: boolean } = JSON.parse(pendingJson);
                        listItems = listItems.map(item => {
                            if (pendingToggles[item.id] !== undefined) {
                                return { ...item, isDone: pendingToggles[item.id] };
                            }
                            return item;
                        });
                    }
                } catch (e) {
                    console.error('[ITEMS] Error applying pending toggles:', e);
                }

                if (listItems.length > 0 || !loadedFromBackupRef.current) {
                    setItems(listItems);

                    if (listItems.length > 0) {
                        const allDone = listItems.every(item => item.isDone);
                        setShoppingList(prev => {
                            if (prev && prev.isComplete !== allDone) {
                                return { ...prev, isComplete: allDone };
                            }
                            return prev;
                        });
                    }
                }
                setLoading(false);
            },
            (error) => {
                console.error('[ITEMS] onSnapshot error:', error);
                if (error.code === 'unavailable') {
                    setLoading(false);
                }
            }
        );

        return () => unsubscribe();
    }, [listId]);

    useFocusEffect(
        useCallback(() => {
            if (listId) {
                markListAsRead(listId as string);
            }
            if (items.length > 0) {
                setLoading(false);
            }
        }, [listId, items.length])
    );

    const handleEditItem = useCallback((item: ShoppingItem) => {
        setEditingItem(item);
        setEditPhotoUri(null);
        setEditPhotoRemoved(false);
        setIsEditModalVisible(true);
    }, []);

    const handlePhotoPress = useCallback((photoUrl: string) => {
        setPhotoPreviewUrl(photoUrl);
        setIsPhotoPreviewVisible(true);
    }, []);

    const handleToggleItem = useCallback(async (itemId: string, newIsDone: boolean) => {
        const newItems = items.map(item =>
            item.id === itemId ? { ...item, isDone: newIsDone } : item
        );

        setItems(newItems);

        const allDone = newItems.length > 0 && newItems.every(item => item.isDone);

        setShoppingList(prev => prev ? { ...prev, isComplete: allDone } : null);

        try {
            await updateListCompletionInBackup(listId as string, allDone);
        } catch (err) {
        }
    }, [items, listId]);

    const handlePhotoPicked = useCallback((uri: string) => {
        setSelectedPhotoUri(uri);
    }, []);

    const handleEditPhotoPicked = useCallback((uri: string) => {
        setEditPhotoUri(uri);
        setEditPhotoRemoved(false);
    }, []);

    const handleEditPhotoRemove = useCallback(() => {
        setEditPhotoUri(null);
        setEditPhotoRemoved(true);
    }, []);

    const handleSaveEdit = useCallback(async (newText: string) => {
        if (!editingItem || !user) return;

        const sanitized = sanitizeInput(newText);
        const validation = validateItemName(sanitized);

        if (!validation.isValid) {
            showError(validation.error || 'Invalid item name');
            return;
        }

        setIsUploadingPhoto(true);
        try {
            const updates: Record<string, any> = {
                text: sanitized,
            };

            const isTextUpdated = sanitized !== editingItem.text;
            let isPhotoUpdated = false;

            if (editPhotoRemoved && editingItem.photoURL) {
                try {
                    await deleteItemPhoto(editingItem.photoURL);
                } catch (photoError) {
                    console.error('Error deleting old photo:', photoError);
                }
                updates.photoURL = null;
                isPhotoUpdated = true;
            } else if (editPhotoUri) {
                try {
                    if (editingItem.photoURL) {
                        try {
                            await deleteItemPhoto(editingItem.photoURL);
                        } catch (photoError) {
                            console.error('Error deleting old photo:', photoError);
                        }
                    }
                    const { url } = await uploadItemPhoto(editPhotoUri, editingItem.id, user.uid);
                    updates.photoURL = url;
                    isPhotoUpdated = true;
                } catch (photoError) {
                    console.error('Error uploading photo:', photoError);
                    showError('Item updated but failed to upload photo');
                }
            }

            await updateDoc(doc(db, COLLECTIONS.ITEMS, editingItem.id), updates);

            if (listId && user?.uid) {
                await updateListTimestamp(listId as string, user.uid);
            }

            if ((groupId || shoppingList?.groupId) && shoppingList) {
                const targetGroupId = groupId || shoppingList.groupId;

                if ((isTextUpdated || isPhotoUpdated) && targetGroupId) {
                    const isImageUpdate = !isTextUpdated && isPhotoUpdated;

                    await notifyItemUpdate(
                        targetGroupId,
                        shoppingList.name,
                        sanitized,
                        user.uid,
                        isImageUpdate
                    ).catch((err: unknown) => console.error('Failed to send update notification:', err));
                }
            }

            showSuccess('Item updated');
            setIsEditModalVisible(false);
            setEditingItem(null);
            setEditPhotoUri(null);
            setEditPhotoRemoved(false);
        } catch (error) {
            handleError(error, { showAlert: false });
            showError('Failed to update item');
        } finally {
            setIsUploadingPhoto(false);
        }
    }, [editingItem, user, editPhotoUri, editPhotoRemoved, listId, groupId, shoppingList, showError, showSuccess]);

    const handleAddItem = useCallback(async () => {
        if (isOffline) {
            showError('Неможливо додати товар без інтернету');
            return;
        }
        if (!user || !listId) return;

        const sanitized = sanitizeInput(newItemText);
        const validation = validateItemName(sanitized);

        if (!validation.isValid) {
            showError(validation.error || 'Некоректна назва товару');
            return;
        }

        const photoToUpload = selectedPhotoUri;

        setNewItemText('');
        setSelectedPhotoUri(null);

        try {
            const docRef = await addDoc(collection(db, COLLECTIONS.ITEMS), {
                shoppingListId: listId,
                text: sanitized,
                isDone: false,
                addedBy: user.uid,
                createdAt: Timestamp.now(),
                photoURL: null,
            });

            if (photoToUpload) {
                setIsUploadingPhoto(true);
                try {
                    const { url } = await uploadItemPhoto(photoToUpload, docRef.id, user.uid);
                    await updateDoc(doc(db, COLLECTIONS.ITEMS, docRef.id), {
                        photoURL: url,
                    });
                } catch (photoError) {
                    console.error('[ADD-ITEM] Photo upload failed:', photoError);
                    showError('Товар додано, але не вдалося завантажити фото');
                } finally {
                    setIsUploadingPhoto(false);
                }
            }

            await updateListTimestamp(listId as string, user.uid);
            await autoUpdateListCompletion(listId, user.uid);

            if (groupId && shoppingList) {
                notifyNewItem(groupId, shoppingList.name, sanitized, user.uid).catch(err => {
                    console.error('[ADD-ITEM] Notification failed:', err);
                });
            }

            showSuccess('Товар додано');
        } catch (error) {
            handleError(error, { showAlert: false });
            showError('Не вдалося додати товар');
        }
    }, [isOffline, user, listId, newItemText, selectedPhotoUri, groupId, shoppingList, showError, showSuccess]);

    const renderItem = useCallback(
        ({ item }: { item: ShoppingItem }) => (
            <ItemRow
                item={item}
                currentUserId={user?.uid}
                isGroupOwner={isGroupOwner}
                isListCreator={isListCreator}
                onEdit={handleEditItem}
                onPhotoPress={handlePhotoPress}
                onToggle={handleToggleItem}
                listId={listId as string}
                isOffline={isOffline}
            />
        ),
        [user?.uid, isGroupOwner, isListCreator, handleEditItem, handlePhotoPress, handleToggleItem, listId, isOffline]
    );

    return (
        <View style={{ flex: 1 }}>
            <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.flex}
                    keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 80}
                >
                    <FlatList
                        data={items}
                        keyExtractor={(item) => item.id}
                        renderItem={renderItem}
                        contentContainerStyle={styles.listContent}
                        keyboardShouldPersistTaps="handled"
                        ListEmptyComponent={
                            !loading ? (
                                <Text style={styles.emptyText}>Додайте перший товар</Text>
                            ) : null
                        }
                    />

                    <View style={styles.inputContainer}>
                        <PhotoPicker
                            onPhotoPicked={handlePhotoPicked}
                            disabled={isUploadingPhoto || isOffline}
                            iconColor={selectedPhotoUri ? COLORS.SUCCESS : (isOffline ? COLORS.DISABLED : COLORS.PRIMARY)}
                        />
                        <TextInput
                            style={[styles.input, isOffline && styles.inputDisabled]}
                            placeholder={isOffline ? "Немає інтернету" : "Назва товару (напр. 'Молоко')"}
                            value={newItemText}
                            onChangeText={setNewItemText}
                            onSubmitEditing={handleAddItem}
                            editable={!isUploadingPhoto && !isOffline}
                            accessibilityLabel="Поле для введення нового товару"
                        />
                        <Pressable
                            style={styles.sendButton}
                            onPress={handleAddItem}
                            disabled={isUploadingPhoto || isOffline}
                            accessibilityLabel="Додати товар"
                            accessibilityRole="button"
                        >
                            <Ionicons
                                name="add-circle"
                                size={32}
                                color={(isUploadingPhoto || isOffline) ? COLORS.DISABLED : COLORS.PRIMARY}
                            />
                        </Pressable>
                    </View>
                </KeyboardAvoidingView>

                <InputModal
                    visible={isEditModalVisible}
                    title="Редагувати товар"
                    placeholder="Назва товару"
                    initialValue={editingItem?.text || ''}
                    submitText="Зберегти"
                    onSubmit={handleSaveEdit}
                    onClose={() => {
                        setIsEditModalVisible(false);
                        setEditingItem(null);
                        setEditPhotoUri(null);
                        setEditPhotoRemoved(false);
                    }}
                    currentPhotoUrl={editPhotoRemoved ? null : (editPhotoUri || editingItem?.photoURL || null)}
                    onPhotoChange={handleEditPhotoPicked}
                    onPhotoRemove={handleEditPhotoRemove}
                    isUploadingPhoto={isUploadingPhoto}
                />

                <PhotoPreviewModal
                    visible={isPhotoPreviewVisible}
                    photoUrl={photoPreviewUrl}
                    onClose={() => setIsPhotoPreviewVisible(false)}
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
    flex: {
        flex: 1,
    },
    listContent: {
        paddingBottom: 10,
    },
    emptyText: {
        textAlign: 'center',
        marginTop: 50,
        fontSize: 16,
        color: COLORS.TEXT_SECONDARY,
    },
    itemRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 15,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.BORDER_LIGHT,
    },
    checkbox: {
        padding: 5,
        marginRight: 10,
    },
    photoIndicator: {
        padding: 5,
        marginRight: 10,
    },
    itemText: {
        fontSize: 16,
        flexShrink: 1,
    },
    itemTextDone: {
        fontSize: 16,
        color: COLORS.COMPLETED,
        textDecorationLine: 'line-through',
        flexShrink: 1,
    },
    actions: {
        flexDirection: 'row',
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 10,
        paddingHorizontal: 15,
        borderTopWidth: 1,
        borderTopColor: COLORS.BORDER_DEFAULT,
        backgroundColor: COLORS.WHITE,
        gap: 10,
    },
    input: {
        flex: 1,
        height: 40,
        backgroundColor: COLORS.BACKGROUND_SECONDARY,
        borderRadius: 20,
        paddingHorizontal: 15,
    },
    inputDisabled: {
        backgroundColor: COLORS.DISABLED,
        opacity: 0.6,
    },
    sendButton: {
        justifyContent: 'center',
        alignItems: 'center',
    },
});