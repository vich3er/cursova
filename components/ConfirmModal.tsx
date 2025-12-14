import React from 'react';
import { View, Text, StyleSheet, Modal, Pressable, Platform } from 'react-native';
import { COLORS } from '@/constants';

interface ConfirmModalProps {
    visible: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void;
    onCancel: () => void;
    destructive?: boolean;
}

export default function ConfirmModal({
    visible,
    title,
    message,
    confirmText = 'Підтвердити',
    cancelText = 'Скасувати',
    onConfirm,
    onCancel,
    destructive = false,
}: ConfirmModalProps) {
    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onCancel}
        >
            <Pressable style={styles.overlay} onPress={onCancel}>
                <Pressable style={styles.modal} onPress={(e) => e.stopPropagation()}>
                    <Text style={styles.title}>{title}</Text>
                    <Text style={styles.message}>{message}</Text>

                    <View style={styles.buttonContainer}>
                        <Pressable
                            style={[styles.button, styles.cancelButton]}
                            onPress={onCancel}
                            accessibilityRole="button"
                            accessibilityLabel={cancelText}
                        >
                            <Text style={styles.cancelButtonText}>{cancelText}</Text>
                        </Pressable>

                        <Pressable
                            style={[
                                styles.button,
                                styles.confirmButton,
                                destructive && styles.destructiveButton,
                            ]}
                            onPress={onConfirm}
                            accessibilityRole="button"
                            accessibilityLabel={confirmText}
                        >
                            <Text
                                style={[
                                    styles.confirmButtonText,
                                    destructive && styles.destructiveButtonText,
                                ]}
                            >
                                {confirmText}
                            </Text>
                        </Pressable>
                    </View>
                </Pressable>
            </Pressable>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modal: {
        backgroundColor: COLORS.WHITE,
        borderRadius: 12,
        padding: 20,
        width: '85%',
        maxWidth: 400,
        ...Platform.select({
            web: {
                boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.15)',
            },
            default: {
                shadowColor: COLORS.BLACK,
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.25,
                shadowRadius: 4,
                elevation: 5,
            },
        }),
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: COLORS.TEXT_PRIMARY,
        marginBottom: 12,
        textAlign: 'center',
    },
    message: {
        fontSize: 16,
        color: COLORS.TEXT_SECONDARY,
        marginBottom: 24,
        textAlign: 'center',
        lineHeight: 22,
    },
    buttonContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 12,
    },
    button: {
        flex: 1,
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cancelButton: {
        backgroundColor: COLORS.BACKGROUND,
    },
    cancelButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.TEXT_PRIMARY,
    },
    confirmButton: {
        backgroundColor: COLORS.PRIMARY,
    },
    confirmButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.WHITE,
    },
    destructiveButton: {
        backgroundColor: COLORS.ERROR,
    },
    destructiveButtonText: {
        color: COLORS.WHITE,
    },
});
