import BottomNavigationBar from '@/components/BottomNavigationBar';
import Button from '@/components/Button';
import ConfirmModal from '@/components/ConfirmModal';
import InputModal from '@/components/InputModal';
import { COLLECTIONS, COLORS } from '@/constants';
import { useToast } from '@/contexts/ToastContext';
import { db } from '@/firebase/config';
import { useAuth } from '@/hooks/useAuth';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { ShoppingGroup, UserProfile } from '@/types';
import { handleError } from '@/utils/errorHandler';
import { notifyUserAddedToGroup } from '@/utils/notifications';
import { sanitizeInput, validateName } from '@/utils/validation';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
    arrayRemove,
    arrayUnion,
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    onSnapshot,
    query,
    updateDoc,
    where,
} from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

interface MemberWithProfile extends UserProfile {
    isOwner: boolean;
}

export default function GroupMembersTab() {
    const { groupId } = useLocalSearchParams<{ groupId: string }>();
    const { user, userProfile } = useAuth();
    const router = useRouter();
    const [group, setGroup] = useState<ShoppingGroup | null>(null);
    const [members, setMembers] = useState<MemberWithProfile[]>([]);
    const [modalVisible, setModalVisible] = useState(false);
    const [email, setEmail] = useState('');
    const [searching, setSearching] = useState(false);
    const [editGroupModalVisible, setEditGroupModalVisible] = useState(false);
    const [leaveConfirmVisible, setLeaveConfirmVisible] = useState(false);
    const [deleteGroupConfirmVisible, setDeleteGroupConfirmVisible] = useState(false);
    const [deleteMemberConfirm, setDeleteMemberConfirm] = useState<MemberWithProfile | null>(null);
    const { showError, showSuccess } = useToast();
    const insets = useSafeAreaInsets();
    const { isOffline } = useNetworkStatus();

    const isOwner = user?.uid === group?.ownerId;

    useEffect(() => {
        if (!groupId) return;

        const groupRef = doc(db, COLLECTIONS.GROUPS, groupId as string);
        const unsubscribe = onSnapshot(
            groupRef,
            async (docSnap) => {
                if (docSnap.exists()) {
                    const groupData = { id: docSnap.id, ...docSnap.data() } as ShoppingGroup;
                    setGroup(groupData);

                    await loadMemberProfiles(groupData);
                } else {
                    setGroup(null);
                    setMembers([]);
                }
            },
            (error) => {
                if (error.code === 'permission-denied') {
                    setGroup(null);
                    setMembers([]);
                    return;
                }
                handleError(error, { showAlert: false });
                showError('Помилка завантаження групи');
            }
        );

        return () => unsubscribe();
    }, [groupId]);

    const loadMemberProfiles = async (groupData: ShoppingGroup) => {
        try {
            const memberProfiles: MemberWithProfile[] = [];

            for (const memberId of groupData.members) {
                const userRef = doc(db, COLLECTIONS.USERS, memberId);
                const userSnap = await getDoc(userRef);

                if (userSnap.exists()) {
                    const userData = userSnap.data() as UserProfile;
                    memberProfiles.push({
                        ...userData,
                        isOwner: memberId === groupData.ownerId,
                    });
                }
            }

            setMembers(memberProfiles);
        } catch (error) {
            handleError(error, { showAlert: false });
            showError('Помилка завантаження учасників');
        }
    };

    const handleAddMember = async () => {
        if (!group || !user) return;

        const trimmedUsername = email.trim().toLowerCase();

        if (!trimmedUsername) {
            showError('Введіть нікнейм');
            return;
        }

        if (trimmedUsername.length < 3) {
            showError('Нікнейм повинен містити мінімум 3 символи');
            return;
        }

        setSearching(true);

        try {
            const usersRef = collection(db, COLLECTIONS.USERS);
            const q = query(usersRef, where('displayName', '==', trimmedUsername));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                showError('Користувача з таким нікнеймом не знайдено');
                setSearching(false);
                return;
            }

            const userDoc = querySnapshot.docs[0];
            const userToAdd = userDoc.data() as UserProfile;

            if (group.members.includes(userToAdd.uid)) {
                showError('Цей користувач вже є учасником групи');
                setSearching(false);
                return;
            }

            const groupRef = doc(db, COLLECTIONS.GROUPS, groupId as string);
            await updateDoc(groupRef, {
                members: arrayUnion(userToAdd.uid),
            });

            if (userProfile?.displayName && group?.name) {
                notifyUserAddedToGroup(
                    groupId as string,
                    group.name,
                    userToAdd.uid,
                ).catch(err => console.error('Error sending group invite notification:', err));
            }

            showSuccess(`${userToAdd.displayName} додано до групи`);
            setModalVisible(false);
            setEmail('');
        } catch (error) {
            handleError(error, { showAlert: false });
            showError('Не вдалося додати учасника');
        } finally {
            setSearching(false);
        }
    };

    const handleEditGroupName = async (newName: string) => {
        if (!group || !user || !isOwner) return;

        const trimmedName = newName.trim();
        const validation = validateName(trimmedName);

        if (!validation.isValid) {
            showError(validation.error || 'Некоректна назва групи');
            return;
        }

        const sanitizedName = sanitizeInput(trimmedName);

        try {
            const groupRef = doc(db, COLLECTIONS.GROUPS, groupId as string);
            await updateDoc(groupRef, {
                name: sanitizedName,
            });
            showSuccess('Назву групи оновлено');
        } catch (error) {
            handleError(error, { showAlert: false });
            showError('Не вдалося оновити назву групи');
        }
    };

    const handleLeaveGroup = () => {
        if (!group || !user) return;

        if (user.uid === group.ownerId) {
            showError('Власник групи не може залишити групу. Видаліть групу або передайте права іншому учаснику.');
            return;
        }

        setLeaveConfirmVisible(true);
    };

    const confirmLeaveGroup = async () => {
        if (!user) return;

        try {
            const groupRef = doc(db, COLLECTIONS.GROUPS, groupId as string);
            await updateDoc(groupRef, {
                members: arrayRemove(user.uid),
            });
            showSuccess('Ви залишили групу');
            setLeaveConfirmVisible(false);
            router.replace('/(tabs)/lists');
        } catch (error: any) {
            console.error('Error leaving group:', error);
            if (error?.code !== 'permission-denied') {
                handleError(error, { showAlert: false });
                showError('Не вдалося залишити групу: ' + (error?.message || 'Невідома помилка'));
            } else {
                setLeaveConfirmVisible(false);
                router.replace('/(tabs)/lists');
            }
        }
    };

    const handleDeleteMember = (member: MemberWithProfile) => {
        if (!group || !user || !isOwner) return;

        if (member.uid === group.ownerId) {
            showError('Не можна видалити власника групи');
            return;
        }

        setDeleteMemberConfirm(member);
    };

    const confirmDeleteMember = async () => {
        if (!deleteMemberConfirm) return;

        try {
            const groupRef = doc(db, COLLECTIONS.GROUPS, groupId as string);
            await updateDoc(groupRef, {
                members: arrayRemove(deleteMemberConfirm.uid),
            });
            showSuccess('Учасника видалено');
            setDeleteMemberConfirm(null);
        } catch (error) {
            handleError(error, { showAlert: false });
            showError('Не вдалося видалити учасника');
        }
    };

    const handleDeleteGroup = () => {
        if (!group || !user || !isOwner) return;

        setDeleteGroupConfirmVisible(true);
    };

    const confirmDeleteGroup = async () => {
        if (!group) return;

        try {
            const listsQuery = query(
                collection(db, COLLECTIONS.SHOPPING_LISTS),
                where('groupId', '==', groupId)
            );
            const listsSnapshot = await getDocs(listsQuery);

            for (const listDoc of listsSnapshot.docs) {
                const itemsQuery = query(
                    collection(db, COLLECTIONS.ITEMS),
                    where('shoppingListId', '==', listDoc.id)
                );
                const itemsSnapshot = await getDocs(itemsQuery);

                for (const itemDoc of itemsSnapshot.docs) {
                    await deleteDoc(doc(db, COLLECTIONS.ITEMS, itemDoc.id));
                }

                await deleteDoc(doc(db, COLLECTIONS.SHOPPING_LISTS, listDoc.id));
            }

            await deleteDoc(doc(db, COLLECTIONS.GROUPS, groupId as string));

            showSuccess('Групу видалено');
            setDeleteGroupConfirmVisible(false);
            router.push('/(tabs)/lists');
        } catch (error) {
            handleError(error, { showAlert: false });
            showError('Не вдалося видалити групу');
        }
    };

    if (isOffline) {
        return (
            <View style={{ flex: 1 }}>
                <SafeAreaView style={styles.container} edges={['left', 'right']}>
                    <View style={styles.offlinePlaceholder}>
                        <Ionicons name="cloud-offline-outline" size={80} color={COLORS.TEXT_SECONDARY} />
                        <Text style={styles.offlinePlaceholderTitle}>Немає інтернету</Text>
                        <Text style={styles.offlinePlaceholderText}>
                            Управління учасниками групи недоступне без підключення до інтернету
                        </Text>
                    </View>
                </SafeAreaView>
                <BottomNavigationBar />
            </View>
        );
    }

    if (!group) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={COLORS.PRIMARY} />
            </View>
        );
    }

    const renderMember = ({ item }: { item: MemberWithProfile }) => (
        <View style={styles.memberItem}>
            <View style={styles.memberAvatar}>
                {item.photoURL ? (
                    <Text style={styles.avatarText}>
                        {item.displayName?.charAt(0).toUpperCase() || item.email.charAt(0).toUpperCase()}
                    </Text>
                ) : (
                    <Ionicons name="person" size={24} color={COLORS.TEXT_SECONDARY} />
                )}
            </View>

            <View style={styles.memberInfo}>
                <View style={styles.memberNameRow}>
                    <Text style={styles.memberName}>
                        {item.displayName || 'Без імені'}
                    </Text>
                    {item.isOwner && (
                        <View style={styles.ownerBadge}>
                            <Text style={styles.ownerBadgeText}>Власник</Text>
                        </View>
                    )}
                </View>
                <Text style={styles.memberEmail}>{item.email}</Text>
            </View>

            {isOwner && !item.isOwner && (
                <Pressable
                    onPress={() => handleDeleteMember(item)}
                    style={styles.deleteMemberButton}
                    accessibilityLabel="Видалити учасника"
                    accessibilityRole="button"
                >
                    <Ionicons name="close-circle" size={24} color={COLORS.ERROR} />
                </Pressable>
            )}
        </View>
    );

    return (
        <View style={{ flex: 1 }}>
            <SafeAreaView style={styles.container} edges={['left', 'right']}>
                <FlatList
                    data={members}
                    keyExtractor={(item) => item.uid}
                    renderItem={renderMember}
                    contentContainerStyle={styles.listContent}
                    ListHeaderComponent={
                        <>
                            {isOwner && group && (
                                <View style={styles.groupNameSection}>
                                    <View style={styles.groupNameHeader}>
                                        <Text style={styles.groupNameLabel}>Назва групи</Text>
                                        <Pressable
                                            onPress={() => setEditGroupModalVisible(true)}
                                            style={styles.editGroupButton}
                                            accessibilityLabel="Редагувати назву групи"
                                            accessibilityRole="button"
                                        >
                                            <Ionicons name="pencil" size={20} color={COLORS.PRIMARY} />
                                            <Text style={styles.editGroupText}>Редагувати</Text>
                                        </Pressable>
                                    </View>
                                    <Text style={styles.groupNameText}>{group.name}</Text>
                                </View>
                            )}
                            <View style={styles.headerSection}>
                                <Text style={styles.sectionTitle}>
                                    Учасники ({members.length})
                                </Text>
                            </View>
                        </>
                    }
                    ListFooterComponent={
                        <View style={styles.footerSection}>
                            {!isOwner && (
                                <Button
                                    title="Залишити групу"
                                    onPress={handleLeaveGroup}
                                    style={styles.leaveButton}
                                />
                            )}
                            {isOwner && (
                                <Button
                                    title="Видалити групу"
                                    onPress={handleDeleteGroup}
                                    style={styles.deleteButton}
                                />
                            )}
                        </View>
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyText}>
                                Немає учасників
                            </Text>
                        </View>
                    }
                />

                <Pressable
                    style={[
                        styles.fab,
                        { bottom: insets.bottom + 20 }
                    ]}
                    onPress={() => setModalVisible(true)}
                    accessibilityLabel="Додати учасника"
                    accessibilityRole="button"
                >
                    <Ionicons name="person-add" size={24} color={COLORS.WHITE} />
                </Pressable>

                <Modal
                    animationType="slide"
                    transparent={true}
                    visible={modalVisible}
                    onRequestClose={() => setModalVisible(false)}
                >
                    <KeyboardAvoidingView
                        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                        style={{ flex: 1 }}
                    >
                        <View style={styles.modalContainer}>
                            <View style={styles.modalContent}>
                                <Text style={styles.modalTitle}>Додати учасника</Text>
                                <Text style={styles.modalDescription}>
                                    Введіть нікнейм користувача, якого хочете додати до групи
                                </Text>

                                <TextInput
                                    style={styles.input}
                                    placeholder="Нікнейм користувача"
                                    value={email}
                                    onChangeText={setEmail}
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    editable={!searching}
                                />

                                <Button
                                    title={searching ? 'Додавання...' : 'Додати'}
                                    onPress={handleAddMember}
                                    disabled={searching}
                                />
                                <Button
                                    title="Скасувати"
                                    onPress={() => {
                                        setModalVisible(false);
                                        setEmail('');
                                    }}
                                    style={{ backgroundColor: COLORS.DISABLED }}
                                    disabled={searching}
                                />
                            </View>
                        </View>
                    </KeyboardAvoidingView>
                </Modal>

                <InputModal
                    visible={editGroupModalVisible}
                    title="Редагувати назву групи"
                    placeholder="Введіть нову назву групи"
                    initialValue={group?.name || ''}
                    submitText="Зберегти"
                    onSubmit={handleEditGroupName}
                    onClose={() => setEditGroupModalVisible(false)}
                />

                <ConfirmModal
                    visible={leaveConfirmVisible}
                    title="Залишити групу"
                    message={`Ви впевнені, що хочете залишити групу "${group?.name}"?`}
                    confirmText="Залишити"
                    cancelText="Скасувати"
                    onConfirm={confirmLeaveGroup}
                    onCancel={() => setLeaveConfirmVisible(false)}
                    destructive
                />

                <ConfirmModal
                    visible={deleteGroupConfirmVisible}
                    title="Видалити групу"
                    message={`Ви впевнені, що хочете видалити групу "${group?.name}"? Це також видалить усі списки покупок та товари в цій групі.`}
                    confirmText="Видалити"
                    cancelText="Скасувати"
                    onConfirm={confirmDeleteGroup}
                    onCancel={() => setDeleteGroupConfirmVisible(false)}
                    destructive
                />

                <ConfirmModal
                    visible={!!deleteMemberConfirm}
                    title="Видалити учасника"
                    message={`Видалити ${deleteMemberConfirm?.displayName || deleteMemberConfirm?.email} з групи?`}
                    confirmText="Видалити"
                    cancelText="Скасувати"
                    onConfirm={confirmDeleteMember}
                    onCancel={() => setDeleteMemberConfirm(null)}
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
        backgroundColor: COLORS.BACKGROUND,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: COLORS.BACKGROUND,
    },
    listContent: {
        padding: 15,
    },
    headerSection: {
        marginBottom: 15,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: COLORS.TEXT_PRIMARY,
    },
    footerSection: {
        marginTop: 20,
        marginBottom: 80,
        alignItems: 'center',
    },
    leaveButton: {
        backgroundColor: COLORS.WARNING,
    },
    deleteButton: {
        backgroundColor: COLORS.ERROR,
    },
    deleteMemberButton: {
        padding: 5,
    },
    memberItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.WHITE,
        padding: 15,
        borderRadius: 10,
        marginBottom: 10,
        shadowColor: COLORS.BLACK,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    memberAvatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: COLORS.BACKGROUND_SECONDARY,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15,
    },
    avatarText: {
        fontSize: 20,
        fontWeight: 'bold',
        color: COLORS.PRIMARY,
    },
    memberInfo: {
        flex: 1,
    },
    memberNameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    memberName: {
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.TEXT_PRIMARY,
        marginRight: 8,
    },
    memberEmail: {
        fontSize: 14,
        color: COLORS.TEXT_SECONDARY,
    },
    ownerBadge: {
        backgroundColor: COLORS.PRIMARY,
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
    },
    ownerBadgeText: {
        fontSize: 12,
        color: COLORS.WHITE,
        fontWeight: '600',
    },
    emptyContainer: {
        alignItems: 'center',
        marginTop: 50,
    },
    emptyText: {
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
        shadowColor: COLORS.BLACK,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 3,
        elevation: 5,
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
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: COLORS.TEXT_PRIMARY,
        marginBottom: 10,
    },
    modalDescription: {
        fontSize: 14,
        color: COLORS.TEXT_SECONDARY,
        textAlign: 'center',
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
    groupNameSection: {
        backgroundColor: COLORS.WHITE,
        padding: 16,
        borderRadius: 10,
        marginBottom: 16,
        shadowColor: COLORS.BLACK,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    groupNameHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    groupNameLabel: {
        fontSize: 14,
        color: COLORS.TEXT_SECONDARY,
        fontWeight: '600',
    },
    editGroupButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        padding: 4,
    },
    editGroupText: {
        fontSize: 14,
        color: COLORS.PRIMARY,
        fontWeight: '600',
    },
    groupNameText: {
        fontSize: 20,
        fontWeight: 'bold',
        color: COLORS.TEXT_PRIMARY,
    },
    offlinePlaceholder: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
    },
    offlinePlaceholderTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: COLORS.TEXT_PRIMARY,
        marginTop: 20,
        marginBottom: 10,
    },
    offlinePlaceholderText: {
        fontSize: 16,
        color: COLORS.TEXT_SECONDARY,
        textAlign: 'center',
        lineHeight: 24,
    },
});
