import React, {useState} from 'react';
import {Alert, StyleSheet, Text, View, KeyboardAvoidingView, ScrollView, Platform} from 'react-native';
import {Link, useRouter} from 'expo-router';
import {signInWithEmailAndPassword, FirebaseError} from 'firebase/auth';
import {auth} from '@/firebase/config';
import AuthInput from '@/components/AuthInput';
import Button from '@/components/Button';
import {COLORS} from '@/constants';
import {validateEmail, validatePassword} from '@/utils/validation';
import {handleError} from '@/utils/errorHandler';
import {useToast} from '@/contexts/ToastContext';

const isWeb = Platform.OS === 'web';

export default function SignInScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();
    const { showError } = useToast();

    const handleSignIn = async () => {
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
            await signInWithEmailAndPassword(auth, email.trim(), password);
        } catch (error: any) {
            if (error.code === 'auth/user-not-found') {
                showError('Користувача з таким email не знайдено. Зареєструйтесь.');
            } else if (error.code === 'auth/wrong-password') {
                showError('Неправильний пароль. Спробуйте ще раз.');
            } else if (error.code === 'auth/invalid-email') {
                showError('Неправильний формат email.');
            } else if (error.code === 'auth/invalid-credential') {
                showError('Неправильний email або пароль.');
            } else if (error.code === 'auth/too-many-requests') {
                showError('Забагато невдалих спроб. Спробуйте пізніше.');
            } else {
                handleError(error, { showAlert: false });
                showError('Не вдалося увійти. Спробуйте ще раз.');
            }
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
                contentContainerStyle={[styles.scrollContent, isWeb && styles.scrollContentWeb]}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                <Text style={styles.title} accessibilityRole="header">
                    Вхід
                </Text>

                <AuthInput
                    iconName="mail-outline"
                    placeholder="Email"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    accessibilityLabel="Поле вводу email"
                    accessibilityHint="Введіть вашу електронну адресу"
                />
                <AuthInput
                    iconName="lock-closed-outline"
                    placeholder="Пароль"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    accessibilityLabel="Поле вводу пароля"
                    accessibilityHint="Введіть ваш пароль"
                />

                <Button
                    title="Увійти"
                    loading={loading}
                    onPress={handleSignIn}
                    accessibilityHint="Увійти до вашого акаунту"
                />

                <View style={styles.footer}>
                    <Text>Немає акаунту? </Text>
                    <Link
                        href={"/sign-up"}
                        style={styles.link}
                        accessibilityLabel="Зареєструватись"
                        accessibilityHint="Перейти до форми реєстрації"
                    >
                        Зареєструватись
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