import React, { useState } from 'react';
import { View, StyleSheet, Text, Alert, KeyboardAvoidingView, ScrollView, Platform } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '@/firebase/config';
import AuthInput from '@/components/AuthInput';
import Button from '@/components/Button';
import { UserProfile } from '@/types';
import { COLORS, COLLECTIONS } from '@/constants';
import { validateEmail, validatePassword, validateUsername } from '@/utils/validation';
import { handleError } from '@/utils/errorHandler';
import { useToast } from '@/contexts/ToastContext';

const isWeb = Platform.OS === 'web';

export default function SignUpScreen() {
    const [displayName, setDisplayName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();
    const scrollViewRef = React.useRef<ScrollView>(null);
    const { showError } = useToast();

    const handleSignUp = async () => {
        const usernameValidation = validateUsername(displayName);
        if (!usernameValidation.isValid) {
            showError(usernameValidation.error || 'Некоректний нікнейм');
            return;
        }

        const emailValidation = validateEmail(email);
        if (!emailValidation.isValid) {
            showError(emailValidation.error || 'Некоректний email');
            return;
        }

        const passwordValidation = validatePassword(password);
        if (!passwordValidation.isValid) {
            showError(passwordValidation.error || 'Некоректний пароль');
            return;
        }

        setLoading(true);
        try {
            const normalizedUsername = displayName.trim().toLowerCase();

            try {
                const usernameQuery = query(
                    collection(db, COLLECTIONS.USERS),
                    where('displayName', '==', normalizedUsername)
                );
                const existingUsers = await getDocs(usernameQuery);

                if (!existingUsers.empty) {
                    showError('Цей нікнейм вже зайнятий. Оберіть інший.');
                    setLoading(false);
                    return;
                }
            } catch (queryError) {
                console.error('Username check failed:', queryError);
            }

            let userCredential;
            try {
                userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
            } catch (authError: any) {
                if (authError.code === 'auth/email-already-in-use') {
                    showError('Цей email вже використовується. Увійдіть або використайте інший email.');
                } else if (authError.code === 'auth/invalid-email') {
                    showError('Неправильний формат email.');
                } else if (authError.code === 'auth/weak-password') {
                    showError('Пароль занадто слабкий. Використайте мінімум 6 символів.');
                } else {
                    handleError(authError, { showAlert: false });
                    showError('Не вдалося створити акаунт. Спробуйте ще раз.');
                }
                setLoading(false);
                return;
            }

            const user = userCredential.user;

            try {
                const userProfile: UserProfile = {
                    uid: user.uid,
                    email: user.email!,
                    displayName: normalizedUsername,
                    photoURL: null,
                };

                await setDoc(doc(db, COLLECTIONS.USERS, user.uid), userProfile);
            } catch (firestoreError) {
                console.error('Failed to create user profile, cleaning up:', firestoreError);
                await user.delete();
                throw firestoreError;
            }
        } catch (error) {
            handleError(error, { showAlert: false });
            showError('Не вдалося створити акаунт. Спробуйте ще раз.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <ScrollView
                ref={scrollViewRef}
                contentContainerStyle={[styles.scrollContent, isWeb && styles.scrollContentWeb]}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                <Text style={styles.title} accessibilityRole="header">
                    Реєстрація
                </Text>

                <AuthInput
                    iconName="person-outline"
                    placeholder="Нікнейм (унікальний)"
                    value={displayName}
                    onChangeText={setDisplayName}
                    autoCapitalize="none"
                    accessibilityLabel="Поле вводу нікнейму"
                    accessibilityHint="Введіть унікальний нікнейм"
                />
                <AuthInput
                    iconName="mail-outline"
                    placeholder="Email"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    accessibilityLabel="Поле вводу email"
                    accessibilityHint="Введіть вашу електронну адресу"
                />
                <AuthInput
                    iconName="lock-closed-outline"
                    placeholder="Пароль (мін. 6 символів)"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    accessibilityLabel="Поле вводу пароля"
                    accessibilityHint="Введіть пароль, мінімум 6 символів"
                />

                <Button
                    title="Зареєструватись"
                    loading={loading}
                    onPress={handleSignUp}
                    accessibilityHint="Створити новий акаунт"
                />

                <View style={styles.footer}>
                    <Text>Вже є акаунт? </Text>
                    <Link
                        href="/sign-in"
                        style={styles.link}
                        accessibilityLabel="Увійти"
                        accessibilityHint="Перейти до форми входу"
                    >
                        Увійти
                    </Link>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.WHITE,
    },
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 40,
        paddingBottom: 100,
        minHeight: '100%',
    },
    scrollContentWeb: {
        maxWidth: 400,
        alignSelf: 'center',
        width: '100%',
        paddingTop: 60,
        paddingBottom: 60,
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        marginBottom: 30,
    },
    footer: {
        flexDirection: 'row',
        marginTop: 20,
    },
    link: {
        color: COLORS.LINK,
        fontWeight: 'bold',
    },
});