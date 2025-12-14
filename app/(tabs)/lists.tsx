import Button from '@/components/Button';
import GroupListItem from '@/components/GroupListItem';
import { COLLECTIONS, COLORS } from '@/constants';
import { useToast } from '@/contexts/ToastContext';
import { db } from '@/firebase/config';
import { useAuth } from '@/hooks/useAuth';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { ShoppingGroup } from '@/types';
import { loadBackup } from '@/utils/backupService';
import { handleError } from '@/utils/errorHandler';
import { sanitizeInput, validateName } from '@/utils/validation';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import {
    addDoc,
    collection,
    onSnapshot,
    orderBy,
    query,
    Timestamp,
    where,
} from 'firebase/firestore';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    BackHandler,
    FlatList,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ListsScreen() {
    const { user } = useAuth();
    const [groups, setGroups] = useState<ShoppingGroup[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalVisible, setModalVisible] = useState(false);
    const [newGroupName, setNewGroupName] = useState('');
    const { showError, showSuccess } = useToast();
    const insets = useSafeAreaInsets();
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const { isOffline } = useNetworkStatus();
    const lastBackPress = useRef<number>(0);
    const loadedFromBackupRef = useRef(false);

    useEffect(() => {
        const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
            const now = Date.now();
            if (now - lastBackPress.current < 2000) {
                BackHandler.exitApp();
                return true;
            } else {
                lastBackPress.current = now;
                showSuccess('Натисніть ще раз для виходу');
                return true;
            }
        });

        return () => backHandler.remove();
    }, [showSuccess]);

    useEffect(() => {
        if (!user || loadedFromBackupRef.current) return;

        const loadFromBackup = async () => {
            try {
                const backup = await loadBackup();
                if (backup && backup.groups && backup.groups.length > 0) {
                    const userGroups = backup.groups.filter(g =>
                        g.members && g.members.includes(user.uid)
                    );
                    if (userGroups.length > 0) {
                        setGroups(userGroups);
                        loadedFromBackupRef.current = true;
                    }
                }
            } catch (error) {
                console.error('[GROUPS] Error loading from backup:', error);
            }
        };

        loadFromBackup();
    }, [user]);

    useEffect(() => {
        if (!user) return;

        const q = query(
            collection(db, COLLECTIONS.GROUPS),
            where('members', 'array-contains', user.uid),
            orderBy('createdAt', 'desc')
        );

        const unsubscribe = onSnapshot(
            q,
            {
                includeMetadataChanges: true, 
            },
            (querySnapshot) => {
                const userGroups: ShoppingGroup[] = [];
                querySnapshot.forEach((doc) => {
                    userGroups.push({ id: doc.id, ...doc.data() } as ShoppingGroup);
                });

                if (userGroups.length > 0 || !loadedFromBackupRef.current) {
                    setGroups(userGroups);
                }
                setLoading(false);
            },
            (error) => {
                if (error.code === 'permission-denied') {
                    setLoading(false);
                    return;
                }

                if (error.code === 'unavailable') {
                    setLoading(false);
                    return;
                }

                console.error('[GROUPS] Query error:', error);
                handleError(error, { showAlert: false });
                showError('Не вдалося завантажити групи');
                setLoading(false);
            }
        );

        return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user]); 

    useFocusEffect(
        useCallback(() => {
            setRefreshTrigger(prev => prev + 1);
            setLoading(false);
        }, [])
    );

    const handleCreateGroup = async () => {
        if (!user) return;

        const trimmedName = newGroupName.trim();
        const validation = validateName(trimmedName);

        if (!validation.isValid) {
            showError(validation.error || 'Некоректна назва групи');
            return;
        }

        const sanitizedName = sanitizeInput(trimmedName);

        setModalVisible(false);
        setNewGroupName('');

        try {
            showSuccess('Групу створено');

            await addDoc(collection(db, COLLECTIONS.GROUPS), {
                name: sanitizedName,
                ownerId: user.uid,
                members: [user.uid],
                createdAt: Timestamp.now(),
            });
        } catch (error) {
            handleError(error, { showAlert: false });
            showError('Помилка при створенні групи');
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
            <View style={styles.header}>
                <View>
                    <Text style={styles.headerTitle} accessibilityRole="header">
                        Мої групи
                    </Text>
                    {isOffline && (
                        <View style={styles.offlineIndicator}>
                            <Ionicons name="cloud-offline-outline" size={14} color={COLORS.WARNING} />
                            <Text style={styles.offlineText}>Немає інтернету</Text>
                        </View>
                    )}
                </View>
            </View>

            <FlatList
                data={groups}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                    <GroupListItem
                        group={item}
                        currentUserId={user?.uid}
                        refreshTrigger={refreshTrigger}
                    />
                )}
                accessibilityLabel="Список груп покупок"
                ListEmptyComponent={() => (
                    !loading && (
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyText}>
                                У вас ще немає груп.
                            </Text>
                            <Text style={styles.emptyText}>
                                Натисніть (+), щоб створити нову.
                            </Text>
                        </View>
                    )
                )}
            />

            <Pressable
                style={[
                    styles.fab,
                    { bottom: insets.bottom > 0 ? insets.bottom + 20 : 30 },
                    isOffline && styles.fabDisabled
                ]}
                onPress={() => {
                    if (isOffline) {
                        showError('Неможливо створити групу без інтернету');
                        return;
                    }
                    setModalVisible(true);
                }}
                disabled={isOffline}
                accessibilityLabel="Створити нову групу"
                accessibilityRole="button"
                accessibilityHint="Відкриває форму для створення нової групи покупок"
            >
                <Ionicons name="add" size={30} color={COLORS.WHITE} />
            </Pressable>

            <Modal
                animationType="slide"
                transparent={true}
                visible={modalVisible}
                onRequestClose={() => setModalVisible(false)}
                accessibilityLabel="Форма створення нової групи"
            >
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.modalContainer}
                >
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Нова група</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Назва групи (напр. 'Покупки на тиждень')"
                            value={newGroupName}
                            onChangeText={setNewGroupName}
                            accessibilityLabel="Поле вводу назви групи"
                            accessibilityHint="Введіть назву для нової групи покупок"
                        />
                        <Button
                            title="Створити"
                            onPress={handleCreateGroup}
                            accessibilityHint="Створює нову групу з введеною назвою"
                        />
                        <Button
                            title="Скасувати"
                            onPress={() => setModalVisible(false)}
                            style={{ backgroundColor: COLORS.DISABLED }}
                            accessibilityHint="Закриває форму без створення групи"
                        />
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.BACKGROUND,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 15,
        backgroundColor: COLORS.WHITE,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.BORDER_LIGHT,
    },
    headerTitle: {
        fontSize: 32,
        fontWeight: 'bold',
        color: COLORS.TEXT_PRIMARY,
    },
    offlineIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
        gap: 4,
    },
    offlineText: {
        fontSize: 12,
        color: COLORS.WARNING,
    },
    emptyContainer: {
        flex: 1,
        marginTop: 150,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyText: {
        fontSize: 16,
        color: COLORS.TEXT_SECONDARY,
    },
    fab: {
        position: 'absolute',
        right: 20,
        bottom: 30,
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: COLORS.PRIMARY,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: COLORS.BLACK,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 3,
        elevation: 5,
    },
    fabDisabled: {
        backgroundColor: COLORS.DISABLED,
        opacity: 0.6,
    },
    modalContainer: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    modalContent: {
        backgroundColor: COLORS.WHITE,
        padding: 20,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        alignItems: 'center',
        paddingBottom: 40,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: COLORS.TEXT_PRIMARY,
        marginBottom: 20,
    },
    input: {
        width: '100%',
        height: 50,
        borderWidth: 1,
        borderColor: COLORS.BORDER_DEFAULT,
        borderRadius: 10,
        paddingHorizontal: 15,
        marginBottom: 15,
        fontSize: 16,
        color: COLORS.TEXT_PRIMARY,
    },
});