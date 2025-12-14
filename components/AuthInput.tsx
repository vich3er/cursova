import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Platform, StyleSheet, TextInput, TextInputProps, View } from 'react-native';

const isWeb = Platform.OS === 'web';

interface AuthInputProps extends TextInputProps {
    iconName: React.ComponentProps<typeof Ionicons>['name'];
}

export default function AuthInput({ iconName, style, ...props }: AuthInputProps) {
    return (
        <View style={[styles.container, isWeb && styles.containerWeb]}>
            <Ionicons name={iconName} size={isWeb ? 18 : 20} color="#888" style={styles.icon} />
            <TextInput
                style={[styles.input, isWeb && styles.inputWeb, style]}
                placeholderTextColor="#888"
                autoCapitalize="none"
                {...props}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        width: '90%',
        height: 50,
        borderRadius: 10,
        backgroundColor: '#f0f0f0',
        paddingHorizontal: 15,
        marginVertical: 10,
    },
    containerWeb: {
        height: 44,
        maxWidth: 400,
        borderRadius: 8,
        marginVertical: 8,
    },
    icon: {
        marginRight: 10,
    },
    input: {
        flex: 1,
        height: '100%',
        fontSize: 16,
        color: '#333',
    },
    inputWeb: {
        fontSize: 14,
        outlineStyle: 'none',
    },
});