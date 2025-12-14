import { COLORS } from '@/constants';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import PhotoPicker from './PhotoPicker';

const isWeb = Platform.OS === 'web';

interface InputModalProps {
    visible: boolean;
    title: string;
    placeholder: string;
    initialValue?: string;
    submitText?: string;
    onSubmit: (text: string) => void | Promise<void>;
    onClose: () => void;
    currentPhotoUrl?: string | null;
    onPhotoChange?: (uri: string) => void;
    onPhotoRemove?: () => void;
    isUploadingPhoto?: boolean;
}

export default function InputModal({
                                       visible,
                                       title,
                                       placeholder,
                                       initialValue = '',
                                       submitText = 'Зберегти',
                                       onSubmit,
                                       onClose,
                                       currentPhotoUrl,
                                       onPhotoChange,
                                       onPhotoRemove,
                                       isUploadingPhoto = false,
                                   }: InputModalProps) {
    const [text, setText] = useState(initialValue);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const hasPhotoSupport = onPhotoChange !== undefined;

    useEffect(() => {
        setText(initialValue);
    }, [initialValue]);

    useEffect(() => {
        if (visible) {
            setText(initialValue);
            setIsSubmitting(false);
        } else {
            setIsSubmitting(false);
        }
    }, [visible, initialValue]);

    const handleSubmit = async () => {
        if (isSubmitting) return;

        if (!text.trim()) {
            return;
        }

        setIsSubmitting(true);
        const textToSubmit = text; 

        try {
            await Promise.resolve(onSubmit(textToSubmit));

            setText('');
            onClose();
        } catch (error) {
            console.error('Error in InputModal submit:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleClose = () => {
        setText(initialValue);
        onClose();
    };

    return (
        <Modal
            animationType="slide"
            transparent={true}
            visible={visible}
            onRequestClose={handleClose}
        >
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.modalContainer}
            >
                <Pressable
                    style={styles.backdrop}
                    onPress={handleClose}
                />
                <SafeAreaView style={styles.safeArea} edges={['bottom']}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>{title}</Text>

                        <TextInput
                            style={styles.input}
                            placeholder={placeholder}
                            value={text}
                            onChangeText={setText}
                            autoFocus={true}
                            editable={!isUploadingPhoto && !isSubmitting}
                            onSubmitEditing={handleSubmit}
                            returnKeyType="done"
                            blurOnSubmit={true}
                        />

                        {hasPhotoSupport && (
                            <View style={styles.photoSection}>
                                <View style={styles.photoHeader}>
                                    <Text style={styles.photoLabel}>Фото товару (необов'язково)</Text>
                                    {isUploadingPhoto && <ActivityIndicator size="small" color={COLORS.PRIMARY} />}
                                </View>

                                {currentPhotoUrl ? (
                                    <View style={styles.photoPreview}>
                                        <Image
                                            source={{ uri: currentPhotoUrl }}
                                            style={styles.photoImage}
                                            contentFit="cover"
                                        />
                                        {onPhotoRemove && (
                                            <Pressable
                                                style={styles.removePhotoButton}
                                                onPress={onPhotoRemove}
                                                disabled={isUploadingPhoto || isSubmitting}
                                            >
                                                <Ionicons name="close-circle" size={24} color={COLORS.ERROR} />
                                            </Pressable>
                                        )}
                                    </View>
                                ) : (
                                    <View style={styles.photoPickerContainer}>
                                        <PhotoPicker
                                            onPhotoPicked={onPhotoChange!}
                                            disabled={isUploadingPhoto || isSubmitting}
                                            iconSize={32}
                                        />
                                        <Text style={styles.photoPickerText}>Додати фото</Text>
                                    </View>
                                )}
                            </View>
                        )}

                        <Pressable
                            style={[styles.submitButton, isWeb && styles.submitButtonWeb, (isUploadingPhoto || isSubmitting) && styles.disabledButton]}
                            onPress={handleSubmit}
                            disabled={isUploadingPhoto || isSubmitting}
                        >
                            <Text style={[styles.buttonText, isWeb && styles.buttonTextWeb]}>
                                {isSubmitting ? 'Збереження...' : submitText}
                            </Text>
                        </Pressable>

                        <Pressable
                            style={[styles.submitButton, styles.cancelButton, isWeb && styles.submitButtonWeb]}
                            onPress={handleClose}
                            disabled={isUploadingPhoto || isSubmitting}
                        >
                            <Text style={[styles.buttonText, isWeb && styles.buttonTextWeb]}>Скасувати</Text>
                        </Pressable>
                    </View>
                </SafeAreaView>
            </KeyboardAvoidingView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    modalContainer: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    safeArea: {
        backgroundColor: COLORS.WHITE,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
    },
    modalContent: {
        padding: 20,
        paddingBottom: 30,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 20,
        textAlign: 'center',
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
    },
    submitButton: {
        backgroundColor: COLORS.PRIMARY,
        paddingVertical: 15,
        borderRadius: 10,
        alignItems: 'center',
        marginBottom: 10,
    },
    submitButtonWeb: {
        paddingVertical: 12,
        maxWidth: 300,
        alignSelf: 'center',
        width: '100%',
        borderRadius: 8,
        cursor: 'pointer',
    },
    cancelButton: {
        backgroundColor: COLORS.DISABLED,
        marginBottom: 20,
    },
    buttonText: {
        color: COLORS.WHITE,
        fontSize: 16,
        fontWeight: '600',
    },
    buttonTextWeb: {
        fontSize: 14,
    },
    disabledButton: {
        backgroundColor: COLORS.DISABLED,
    },
    photoSection: {
        marginBottom: 15,
    },
    photoHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    photoLabel: {
        fontSize: 14,
        color: COLORS.TEXT_SECONDARY,
    },
    photoPickerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 15,
        borderWidth: 1,
        borderColor: COLORS.BORDER_DEFAULT,
        borderRadius: 10,
        borderStyle: 'dashed',
        gap: 10,
    },
    photoPickerText: {
        fontSize: 16,
        color: COLORS.TEXT_SECONDARY,
    },
    photoPreview: {
        position: 'relative',
        width: '100%',
        height: 200,
        borderRadius: 10,
        overflow: 'hidden',
    },
    photoImage: {
        width: '100%',
        height: '100%',
    },
    removePhotoButton: {
        position: 'absolute',
        top: 10,
        right: 10,
        backgroundColor: COLORS.WHITE,
        borderRadius: 12,
    },
});