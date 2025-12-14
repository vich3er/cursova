import Button from '@/components/Button';
import InputModal from '@/components/InputModal';
import { COLLECTIONS, COLORS } from '@/constants';
import { useToast } from '@/contexts/ToastContext';
import { auth, db } from '@/firebase/config';
import { useAuth } from '@/hooks/useAuth';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { handleError } from '@/utils/errorHandler';
import { validateUsername } from '@/utils/validation';
import { Ionicons } from '@expo/vector-icons';
import { signOut } from 'firebase/auth';
import { collection, doc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const isWeb = Platform.OS === 'web';

export default function ProfileScreen() {
    const { user, userProfile } = useAuth();
    const [isEditModalVisible, setIsEditModalVisible] = useState(false);
    const { showError, showSuccess } = useToast();
    const { isOffline } = useNetworkStatus();

    const handleSignOut = async () => {
        try {
            await signOut(auth);
        } catch (error) {
            console.error(error);
            showError('Не вдалося вийти');
        }
    };

    const handleEditName = () => {
        setIsEditModalVisible(true);
    };

    const handleSaveName = async (newName: string) => {
        if (!user || !userProfile) return;

        const normalizedNewName = newName.trim().toLowerCase();
        const currentUsername = userProfile.displayName?.toLowerCase();

        if (normalizedNewName === currentUsername) {
            setIsEditModalVisible(false);
            return;
        }

        const validation = validateUsername(newName);
        if (!validation.isValid) {
            showError(validation.error || 'Некоректний нікнейм');
            return;
        }

        try {
            const usernameQuery = query(
                collection(db, COLLECTIONS.USERS),
                where('displayName', '==', normalizedNewName)
            );
            const existingUsers = await getDocs(usernameQuery);

            const isUsernameTaken = existingUsers.docs.some(doc => doc.id !== user.uid);

            if (isUsernameTaken) {
                showError('Цей нікнейм вже зайнятий. Оберіть інший.');
                return;
            }

            await updateDoc(doc(db, COLLECTIONS.USERS, user.uid), {
                displayName: normalizedNewName,
            });

            showSuccess('Нікнейм оновлено');
            setIsEditModalVisible(false);
        } catch (error: any) {
            handleError(error, { showAlert: false });
            showError('Не вдалося оновити нікнейм');
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
            <View style={[styles.content, isWeb && styles.contentWeb]}>
                <View>
                    <Text style={styles.title} accessibilityRole="header">
                        Профіль
                    </Text>
                    {isOffline && (
                        <View style={styles.offlineIndicator}>
                            <Ionicons name="cloud-offline-outline" size={14} color={COLORS.WARNING} />
                            <Text style={styles.offlineText}>Немає інтернету</Text>
                        </View>
                    )}
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Інформація про профіль</Text>

                    <View style={styles.infoRow}>
                        <View style={styles.infoTextContainer}>
                            <Text style={styles.infoLabel}>Нікнейм:</Text>
                            <Text style={styles.infoValue} accessibilityLabel={`Нікнейм: ${userProfile?.displayName || 'Не вказано'}`}>
                                {userProfile?.displayName || 'Не вказано'}
                            </Text>
                        </View>
                        <Pressable
                            onPress={handleEditName}
                            style={styles.editButton}
                            accessibilityLabel="Редагувати нікнейм"
                            accessibilityRole="button"
                        >
                            <Ionicons name="pencil-outline" size={20} color={COLORS.PRIMARY} />
                        </Pressable>
                    </View>

                    <View style={styles.infoRow}>
                        <View style={styles.infoTextContainer}>
                            <Text style={styles.infoLabel}>Email:</Text>
                            <Text style={styles.infoValue} accessibilityLabel={`Email: ${user?.email}`}>
                                {user?.email}
                            </Text>
                        </View>
                    </View>

                    {__DEV__ && userProfile?.pushToken && (
                        <View style={styles.infoRow}>
                            <View style={styles.infoTextContainer}>
                                <Text style={styles.infoLabel}>Push Token (для тестування):</Text>
                                <Text style={[styles.infoValue, { fontSize: 12 }]} selectable>
                                    {userProfile.pushToken}
                                </Text>
                            </View>
                        </View>
                    )}
                </View>

                <View style={styles.buttonContainer}>
                    <Button
                        title="Вийти з акаунту"
                        onPress={handleSignOut}
                        style={styles.signOutButton}
                        accessibilityHint="Виходить з вашого акаунту"
                    />
                </View>
            </View>

            <InputModal
                visible={isEditModalVisible}
                title="Редагувати нікнейм"
                placeholder="Введіть унікальний нікнейм"
                initialValue={userProfile?.displayName || ''}
                submitText="Зберегти"
                onSubmit={handleSaveName}
                onClose={() => setIsEditModalVisible(false)}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.BACKGROUND,
    },
    content: {
        flex: 1,
        padding: 20,
        paddingTop: 20,
    },
    contentWeb: {
        maxWidth: 500,
        alignSelf: 'center',
        width: '100%',
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        marginBottom: 20,
        color: COLORS.TEXT_PRIMARY,
    },
    offlineIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: -8,
        marginBottom: 12,
        gap: 4,
    },
    offlineText: {
        fontSize: 12,
        color: COLORS.WARNING,
    },
    section: {
        backgroundColor: COLORS.WHITE,
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        shadowColor: COLORS.BLACK,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: COLORS.TEXT_PRIMARY,
        marginBottom: 16,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
        paddingVertical: 8,
    },
    infoTextContainer: {
        flex: 1,
    },
    infoLabel: {
        fontSize: 14,
        color: COLORS.TEXT_SECONDARY,
        marginBottom: 4,
    },
    infoValue: {
        fontSize: 16,
        color: COLORS.TEXT_PRIMARY,
        fontWeight: '500',
    },
    editButton: {
        padding: 8,
        marginLeft: 12,
    },
    buttonContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 40,
    },
    signOutButton: {
        backgroundColor: COLORS.ERROR,
        minWidth: 200,
    }
});