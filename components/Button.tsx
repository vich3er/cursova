import { COLORS } from '@/constants';
import React from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, TouchableOpacity, TouchableOpacityProps } from 'react-native';

const isWeb = Platform.OS === 'web';

interface ButtonProps extends TouchableOpacityProps {
    title: string;
    loading?: boolean;
}

export default function Button({ title, loading = false, style, ...props }: ButtonProps) {
    return (
        <TouchableOpacity
            style={[styles.button, isWeb && styles.buttonWeb, style, loading && styles.disabled]}
            disabled={loading}
            {...props}
        >
            {loading ? (
                <ActivityIndicator color={COLORS.WHITE} />
            ) : (
                <Text style={[styles.text, isWeb && styles.textWeb]}>{title}</Text>
            )}
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    button: {
        width: '90%',
        height: 50,
        borderRadius: 10,
        backgroundColor: COLORS.PRIMARY,
        justifyContent: 'center',
        alignItems: 'center',
        marginVertical: 10,
    },
    buttonWeb: {
        height: 42,
        maxWidth: 400,
        borderRadius: 8,
        marginVertical: 8,
        cursor: 'pointer',
    },
    text: {
        color: COLORS.WHITE,
        fontSize: 18,
        fontWeight: 'bold',
    },
    textWeb: {
        fontSize: 15,
    },
    disabled: {
        backgroundColor: COLORS.DISABLED,
    },
});