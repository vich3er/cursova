import React, {useCallback, useEffect, useRef, useState} from 'react';
import {Bubble, Composer, GiftedChat, IMessage, InputToolbar} from 'react-native-gifted-chat';
import {useLocalSearchParams} from 'expo-router';
import {useAuth} from '@/hooks/useAuth';
import {db} from '@/firebase/config';
import {addDoc, collection, doc, onSnapshot, orderBy, query,} from 'firebase/firestore';
import {SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';
import {COLLECTIONS, COLORS} from '@/constants';
import {useToast} from '@/contexts/ToastContext';
import {useSync} from '@/contexts/SyncContext';
import {useNetworkStatus} from '@/hooks/useNetworkStatus';
import {handleError} from '@/utils/errorHandler';
import {Ionicons} from '@expo/vector-icons';
import {ActivityIndicator, Platform, Pressable, StyleSheet, Text, View} from 'react-native';
import BottomNavigationBar from '@/components/BottomNavigationBar';
import SyncIndicator from '@/components/SyncIndicator';
import * as ImagePicker from 'expo-image-picker';
import {Image} from 'expo-image';
import PhotoPreviewModal from '@/components/PhotoPreviewModal';
import {uploadChatPhoto} from '@/utils/imageUpload';
import {useFocusEffect} from '@react-navigation/native';
import {markChatAsRead} from '@/utils/readStatus';
import {notifyNewMessage} from '@/utils/notifications';
import {loadBackup, toSafeDate} from '@/utils/backupService';

interface ExtendedMessage extends IMessage {
    imageUrls?: string[];
    pending?: boolean;
    localPhotoUris?: string[];
}

export default function GroupChatTab() {
    const { groupId } = useLocalSearchParams<{ groupId: string }>();
    const { user, userProfile } = useAuth();
    const insets = useSafeAreaInsets();
    const [messages, setMessages] = useState<ExtendedMessage[]>([]);

    const [selectedPhotoUris, setSelectedPhotoUris] = useState<string[]>([]);
    const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
    const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
    const [isPhotoPreviewVisible, setIsPhotoPreviewVisible] = useState(false);
    const { showError } = useToast();
    const { addPendingOperation, removePendingOperation } = useSync();
    const { isOffline } = useNetworkStatus();
    const [isChatFocused, setIsChatFocused] = useState(false);
    const loadedFromBackupRef = useRef(false);
    const backupMessageCountRef = useRef(0);
    const hasReceivedFirestoreDataRef = useRef(false);
    const pendingMessagesRef = useRef<Map<string, string>>(new Map());
    const MAX_PHOTOS = 3;

    useEffect(() => {
        if (!groupId || loadedFromBackupRef.current) return;

        const loadFromBackup = async () => {
            try {
                const backup = await loadBackup();
                if (backup && backup.chatMessages && backup.chatMessages[groupId]) {
                    const backupMessages = backup.chatMessages[groupId];
                    if (backupMessages.length > 0) {

                        if (hasReceivedFirestoreDataRef.current) {
                        } else {
                            const giftedMessages: IMessage[] = backupMessages.map((msg) => {
                                let imageUrl = undefined;
                                if (msg.imageUrls && Array.isArray(msg.imageUrls) && msg.imageUrls.length > 0) {
                                    imageUrl = msg.imageUrls[0];
                                } else if (msg.imageUrl) {
                                    imageUrl = msg.imageUrl;
                                }

                                return {
                                    _id: msg.id,
                                    text: msg.text || '',
                                    createdAt: toSafeDate(msg.createdAt),
                                    user: {
                                        _id: msg.userId,
                                        name: msg.userName,
                                    },
                                    image: imageUrl,
                                    imageUrls: msg.imageUrls || (msg.imageUrl ? [msg.imageUrl] : undefined),
                                } as IMessage & { imageUrls?: string[] };
                            });
                            giftedMessages.sort((a, b) =>
                                new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                            );
                            setMessages(giftedMessages);
                            backupMessageCountRef.current = giftedMessages.length;
                        }

                        loadedFromBackupRef.current = true;
                    }
                } else {
                }
            } catch (error) {
                console.error('[CHAT] Error loading from backup:', error);
            }
        };

        loadFromBackup();
    }, [groupId]);

    useEffect(() => {
        if (!groupId) return;

        const q = query(
            collection(db, COLLECTIONS.CHATS, groupId, COLLECTIONS.MESSAGES),
            orderBy('createdAt', 'desc')
        );

        const unsubscribe = onSnapshot(
            q,
            { includeMetadataChanges: true },
            (snapshot) => {
                hasReceivedFirestoreDataRef.current = true;

                const firestoreMessages: ExtendedMessage[] = snapshot.docs.map((docSnap) => {
                    const data = docSnap.data();
                    let imageUrl = undefined;
                    if (data.imageUrls && Array.isArray(data.imageUrls) && data.imageUrls.length > 0) {
                        imageUrl = data.imageUrls[0];
                    } else if (data.imageUrl) {
                        imageUrl = data.imageUrl;
                    }

                    return {
                        _id: docSnap.id,
                        text: data.text || '',
                        createdAt: toSafeDate(data.createdAt),
                        user: {
                            _id: data.userId,
                            name: data.userName,
                        },
                        image: imageUrl,
                        imageUrls: data.imageUrls || (data.imageUrl ? [data.imageUrl] : undefined),
                        pending: false,
                    };
                });

                const isServerData = snapshot.metadata.fromCache === false;
                const incomingLength = firestoreMessages.length;
                const backupBaseline = backupMessageCountRef.current;

                let shouldUpdate = false;

                if (isServerData) {
                    shouldUpdate = true;
                } else if (!loadedFromBackupRef.current) {
                    shouldUpdate = incomingLength > 0;
                } else {
                    shouldUpdate = incomingLength > backupBaseline;
                }

                if (shouldUpdate) {
                    setMessages(prevMessages => {
                        const pendingMessages = prevMessages.filter(m => m.pending === true);

                        const remainingPending = pendingMessages.filter(pending => {
                            const confirmed = firestoreMessages.some(fm =>
                                fm.user._id === pending.user._id &&
                                fm.text === pending.text &&
                                Math.abs(new Date(fm.createdAt).getTime() - new Date(pending.createdAt).getTime()) < 5000
                            );
                            return !confirmed;
                        });

                        if (remainingPending.length > 0) {
                            return [...remainingPending, ...firestoreMessages];
                        }
                        return firestoreMessages;
                    });

                    if (incomingLength > backupBaseline) {
                        backupMessageCountRef.current = incomingLength;
                    }
                }

                if (isChatFocused) {
                    markChatAsRead(groupId);
                }
            },
            (error) => {
                if (error.code === 'permission-denied') {
                    if (!loadedFromBackupRef.current) {
                        setMessages([]);
                    }
                    return;
                }
                if (error.code === 'unavailable') {
                    return;
                }
                handleError(error, { showAlert: false });
                showError('Не вдалося завантажити повідомлення');
            }
        );

        return () => unsubscribe();
    }, [groupId, showError, isChatFocused]);

    useFocusEffect(
        useCallback(() => {
            setIsChatFocused(true);
            if (groupId) {
                markChatAsRead(groupId);
            }
            return () => {
                setIsChatFocused(false);
            };
        }, [groupId])
    );

    const handlePhotoPicked = async () => {
        try {
            if (selectedPhotoUris.length >= MAX_PHOTOS) {
                showError(`Максимум ${MAX_PHOTOS} фото на повідомлення`);
                return;
            }

            const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

            if (permissionResult.granted === false) {
                showError('Дозвольте доступ до галереї для вибору фото');
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: false,
                quality: 1,
                allowsMultipleSelection: true,
                selectionLimit: MAX_PHOTOS - selectedPhotoUris.length,
            });

            if (!result.canceled && result.assets.length > 0) {
                const newUris = result.assets.map(asset => asset.uri);
                const totalPhotos = selectedPhotoUris.length + newUris.length;

                if (totalPhotos > MAX_PHOTOS) {
                    const allowedCount = MAX_PHOTOS - selectedPhotoUris.length;
                    setSelectedPhotoUris([...selectedPhotoUris, ...newUris.slice(0, allowedCount)]);
                    showError(`Додано ${allowedCount} фото (максимум ${MAX_PHOTOS})`);
                } else {
                    setSelectedPhotoUris([...selectedPhotoUris, ...newUris]);
                }
            }
        } catch (error) {
            handleError(error, { showAlert: false });
            showError('Не вдалося вибрати фото');
        }
    };

    const handleRemovePhoto = (index: number) => {
        setSelectedPhotoUris(selectedPhotoUris.filter((_, i) => i !== index));
    };

    const onSend = useCallback(
        async (incomingMessages: IMessage[] = []) => {
            if (!user || !userProfile || !groupId) {
                showError('Не вдалося відправити повідомлення');
                return;
            }

            const { text, createdAt } = incomingMessages[0];
            const hasText = text && text.trim().length > 0;
            const hasPhotos = selectedPhotoUris.length > 0;

            if (!hasText && !hasPhotos) {
                return;
            }

            const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
            const photosToUpload = [...selectedPhotoUris];

            setSelectedPhotoUris([]);

            const optimisticMessage: ExtendedMessage = {
                _id: tempId,
                text: text || '',
                createdAt: createdAt || new Date(),
                user: {
                    _id: user.uid,
                    name: userProfile.displayName || user.email || 'Я',
                },
                pending: true,
                localPhotoUris: photosToUpload.length > 0 ? photosToUpload : undefined,
                image: photosToUpload.length > 0 ? photosToUpload[0] : undefined,
            };

            setMessages(prevMessages => [optimisticMessage, ...prevMessages]);

            const operationId = `message-${Date.now()}`;
            addPendingOperation(operationId, 'message', 'Відправка повідомлення');

            let imageUrls: string[] = [];

            if (photosToUpload.length > 0) {
                setIsUploadingPhoto(true);
                try {
                    const uploadPromises = photosToUpload.map(uri =>
                        uploadChatPhoto(uri, groupId, user.uid)
                    );
                    imageUrls = await Promise.all(uploadPromises);
                } catch (uploadError) {
                    handleError(uploadError, { showAlert: false });
                    showError('Не вдалося завантажити фото');
                    setMessages(prev => prev.filter(m => m._id !== tempId));
                    setIsUploadingPhoto(false);
                    removePendingOperation(operationId);
                    return;
                }
                setIsUploadingPhoto(false);
            }

            try {
                await addDoc(collection(db, COLLECTIONS.CHATS, groupId, COLLECTIONS.MESSAGES), {
                    text: text || '',
                    createdAt: createdAt || new Date(),
                    userId: user.uid,
                    userName: userProfile.displayName || user.email,
                    imageUrls: imageUrls.length > 0 ? imageUrls : null,
                    imageUrl: imageUrls.length > 0 ? imageUrls[0] : null,
                });

                const messageText = text || (imageUrls.length > 0 ? '📷 Фото' : '');
                if (messageText) {
                    notifyNewMessage(
                        groupId,
                        messageText,
                        userProfile.displayName || user.email || 'Користувач',
                        user.uid
                    ).catch(err => {
                        console.error('Failed to send notification:', err);
                    });
                }

                removePendingOperation(operationId);
            } catch (error) {
                handleError(error, { showAlert: false });
                if (!isOffline) {
                    showError('Не вдалося відправити повідомлення');
                    setMessages(prev => prev.filter(m => m._id !== tempId));
                } else {
                    showError('Повідомлення буде відправлено при підключенні');
                }
                removePendingOperation(operationId);
            }
        },
        [user, userProfile, groupId, showError, selectedPhotoUris, addPendingOperation, removePendingOperation, isOffline]
    );

    const MessagePendingIndicator = ({ message }: { message: ExtendedMessage }) => {
        const isPending = message.pending === true;

        if (!isPending) return null;

        return (
            <View style={styles.pendingIndicator}>
                <Ionicons name="time-outline" size={14} color={COLORS.TEXT_SECONDARY} />
            </View>
        );
    };

    const renderBubble = (props: any) => {
        const isCurrentUser = props.currentMessage.user._id === user?.uid;
        const message = props.currentMessage as ExtendedMessage;

        return (
            <View style={{ flexDirection: isCurrentUser ? 'row' : 'row-reverse', alignItems: 'flex-end' }}>
                {isCurrentUser && (
                    <MessagePendingIndicator message={message} />
                )}
                <Bubble
                    {...props}
                    wrapperStyle={{
                        right: {
                            backgroundColor: message.pending ? COLORS.PRIMARY_LIGHT || '#A8D5BA' : COLORS.PRIMARY,
                        },
                        left: {
                            backgroundColor: COLORS.SECONDARY,
                        },
                    }}
                    textStyle={{
                        right: {
                            color: COLORS.WHITE,
                        },
                        left: {
                            color: COLORS.TEXT_PRIMARY,
                        },
                    }}
                />
            </View>
        );
    };

    const renderInputToolbar = (props: any) => {
        return (
            <InputToolbar
                {...props}
                containerStyle={styles.inputToolbarContainer}
                primaryStyle={styles.inputToolbarPrimary}
            />
        );
    };

    const renderAccessory = () => {
        if (selectedPhotoUris.length === 0) return null;

        return (
            <View style={styles.photoPreviewContainer}>
                {selectedPhotoUris.map((uri, index) => (
                    <View key={index} style={styles.photoPreviewWrapper}>
                        <Image
                            source={{ uri }}
                            style={styles.photoPreview}
                            contentFit="cover"
                        />
                        <Pressable
                            onPress={() => handleRemovePhoto(index)}
                            style={styles.removePhotoPreviewButton}
                        >
                            <Ionicons name="close-circle" size={24} color={COLORS.WHITE} />
                        </Pressable>
                    </View>
                ))}
            </View>
        );
    };

    const renderComposer = (props: any) => {
        return (
            <Composer
                {...props}
                textInputStyle={[
                    styles.composerTextInput,
                    isOffline && styles.composerDisabled
                ]}
                placeholder={isOffline ? "Немає інтернету" : "Напишіть повідомлення..."}
                textInputProps={{
                    returnKeyType: 'send',
                    blurOnSubmit: false,
                    editable: !isOffline,
                    autoCorrect: true,
                    autoCapitalize: 'sentences',
                }}
            />
        );
    };

    const handleManualSend = async () => {
        if (isUploadingPhoto) return;

        const hasPhotos = selectedPhotoUris.length > 0;
        if (!hasPhotos) return;

        const message: IMessage = {
            _id: Date.now().toString(),
            text: '',
            createdAt: new Date(),
            user: {
                _id: user?.uid || 'unknown_user',
                name: userProfile?.displayName || user?.email || 'Я',
            },
        };

        await onSend([message]);
    };
    const renderChatFooter = useCallback(() => {
        if (selectedPhotoUris.length === 0) return null;

        return (
            <View style={styles.chatFooterContainer}>
                {selectedPhotoUris.map((uri, index) => (
                    <View key={index} style={styles.photoPreviewWrapper}>
                        <Image
                            source={{ uri }}
                            style={styles.photoPreview}
                            contentFit="cover"
                        />
                        <Pressable
                            onPress={() => handleRemovePhoto(index)}
                            style={styles.removePhotoPreviewButton}
                        >
                            <Ionicons name="close" size={24} color={COLORS.ERROR} />
                        </Pressable>
                    </View>
                ))}
            </View>
        );
    }, [selectedPhotoUris]);
    const renderSend = (props: any) => {
        const { text, onSend: onSendProp } = props;
        const hasText = text && text.trim().length > 0;
        const hasPhotos = selectedPhotoUris.length > 0;
        const hasContent = hasText || hasPhotos;
        const canSend = hasContent && !isUploadingPhoto && !isOffline;

        const handlePress = () => {
            if (!canSend) return;

            if (hasText && onSendProp) {
                onSendProp({ text: text.trim() }, true);
            }
            else if (hasPhotos && !hasText) {
                handleManualSend();
            }
        };

        return (
            <Pressable
                onPress={handlePress}
                disabled={!canSend}
                style={styles.sendContainer}
            >
                <View style={styles.sendButton}>
                    <Ionicons
                        name="send"
                        size={28}
                        color={canSend ? COLORS.PRIMARY : COLORS.DISABLED}
                    />
                </View>
            </Pressable>
        );
    };

    const renderActions = (props: any) => {
        return (
            <View style={styles.actionsContainer}>
                <Pressable
                    onPress={handlePhotoPicked}
                    disabled={isUploadingPhoto || selectedPhotoUris.length >= MAX_PHOTOS || isOffline}
                    style={styles.actionButton}
                >
                    <Ionicons
                        name="camera"
                        size={28}
                        color={(selectedPhotoUris.length >= MAX_PHOTOS || isOffline) ? COLORS.DISABLED : COLORS.PRIMARY}
                    />
                </Pressable>
                {selectedPhotoUris.length > 0 && (
                    <View style={styles.photoCountBadge}>
                        <Text style={styles.photoCountText}>{selectedPhotoUris.length}</Text>
                    </View>
                )}
            </View>
        );
    };


    const renderMessageImage = (props: any) => {
        const { currentMessage } = props;
        const imageUrls = currentMessage.imageUrls || (currentMessage.image ? [currentMessage.image] : []);

        if (imageUrls.length === 0) return null;

        if (imageUrls.length === 1) {
            return (
                <Pressable
                    onPress={() => {
                        setPhotoPreviewUrl(imageUrls[0]);
                        setIsPhotoPreviewVisible(true);
                    }}
                    style={styles.messageImageContainer}
                >
                    <Image
                        source={{ uri: imageUrls[0] }}
                        style={styles.messageImage}
                        contentFit="cover"
                        transition={200}
                    />
                </Pressable>
            );
        }

        return (
            <View style={styles.messageImagesGrid}>
                {imageUrls.map((url: string, index: number) => (
                    <Pressable
                        key={index}
                        onPress={() => {
                            setPhotoPreviewUrl(url);
                            setIsPhotoPreviewVisible(true);
                        }}
                        style={[
                            styles.messageImageGridItem,
                            imageUrls.length === 2 && styles.twoImagesGridItem,
                            imageUrls.length === 3 && index < 2 && styles.threeImagesTopItem,
                            imageUrls.length === 3 && index === 2 && styles.threeImagesBottomItem,
                        ]}
                    >
                        <Image
                            source={{ uri: url }}
                            style={styles.gridImage}
                            contentFit="cover"
                            transition={200}
                        />
                    </Pressable>
                ))}
            </View>
        );
    };

    return (
        <SafeAreaView style={{ flex: 1 }}>
                <GiftedChat
                    messages={messages}
                    onSend={(messages) => onSend(messages)}
                    user={{
                        _id: user?.uid || 'unknown_user',
                        name: userProfile?.displayName || user?.email || 'Я',
                    }}
                    placeholder={isOffline ? "Немає інтернету" : "Напишіть повідомлення..."}
                    locale="uk"
                    timeFormat="HH:mm"
                    renderBubble={renderBubble}
                    renderInputToolbar={renderInputToolbar}
                    renderChatFooter={renderChatFooter}
                    renderComposer={renderComposer}
                    renderSend={renderSend}
                    renderActions={renderActions}
                    renderMessageImage={renderMessageImage}
                    alwaysShowSend={true}
                    minInputToolbarHeight={45}
                    bottomOffset={Platform.OS === 'ios' ? insets.bottom : -45}
                />


                <PhotoPreviewModal
                    visible={isPhotoPreviewVisible}
                    photoUrl={photoPreviewUrl}
                    onClose={() => setIsPhotoPreviewVisible(false)}
                />
            <BottomNavigationBar />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    inputToolbarContainer: {
        backgroundColor: COLORS.WHITE,
        borderTopWidth: 1,
        borderTopColor: COLORS.BORDER_DEFAULT,
        paddingTop: 5,
        paddingBottom: 0,
        paddingHorizontal: 10,
    },
    inputToolbarPrimary: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    composerTextInput: {
        color: COLORS.TEXT_PRIMARY,
        backgroundColor: COLORS.BACKGROUND,
        borderRadius: 20,
        paddingHorizontal: 15,
        paddingTop: Platform.OS === 'ios' ? 10 : 0,
        paddingBottom: 8,
        marginLeft: 0,
        marginRight: 10,
        maxHeight: 60,
    },
    composerDisabled: {
        backgroundColor: COLORS.DISABLED,
        opacity: 0.6,
    },
    pendingIndicator: {
        marginRight: 6,
        marginBottom: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    sendContainer: {
        justifyContent: 'center',
        alignItems: 'center',
        alignSelf: 'center',
        marginRight: 5,
        marginLeft: 5,
        width: 44,
        height: 44,
    },
    sendButton: {
        justifyContent: 'center',
        alignItems: 'center',
        width: 44,
        height: 44,
    },
    actionsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 5,
        marginRight: 5,
        height: 44,
    },
    actionButton: {
        justifyContent: 'center',
        alignItems: 'center',
        width: 44,
        height: 44,
    },
    photoCountBadge: {
        position: 'absolute',
        top: -5,
        right: -5,
        backgroundColor: COLORS.PRIMARY,
        borderRadius: 10,
        width: 20,
        height: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    photoCountText: {
        color: COLORS.WHITE,
        fontSize: 12,
        fontWeight: 'bold',
    },
    photoPreviewContainer: {
        flexDirection: 'row',
        paddingHorizontal: 10,
        paddingVertical: 10,
        backgroundColor: COLORS.WHITE,
    },
    photoPreviewWrapper: {
        marginRight: 10,
        position: 'relative',
    },
    photoPreview: {
        width: 80,
        height: 80,
        borderRadius: 8,
    },
    removePhotoPreviewButton: {
        position: 'absolute',
        top: -8,
        right: -8,
        borderRadius: 12,
        backgroundColor: COLORS.WHITE,
        elevation: 3,
        shadowColor: '#000',
        shadowOpacity: 0.3,
        shadowRadius: 3,
    },
    messageImageContainer: {
        borderRadius: 13,
        margin: 3,
        overflow: 'hidden',
    },
    messageImage: {
        width: 200,
        height: 200,
        borderRadius: 13,
    },
    chatFooterContainer: {
        flexDirection: 'row',
        paddingHorizontal: 10,
        paddingVertical: 10,
        backgroundColor: COLORS.WHITE,
        borderTopWidth: 1,
        borderTopColor: COLORS.BORDER_DEFAULT,
    },
    messageImagesGrid: {
        width: 270,
        flexDirection: 'row',
        flexWrap: 'wrap',
        padding: 3,
    },
    messageImageGridItem: {
        borderRadius: 13,
        overflow: 'hidden',
        margin: 1,
    },
    gridImage: {
        width: '100%',
        height: '100%',
        borderRadius: 13,
    },
    twoImagesGridItem: {
        width: 130,
        height: 130,
    },
    threeImagesTopItem: {
        width: 130,
        height: 130,
    },
    threeImagesBottomItem: {
        width: 264,
        height: 130,
    },
});