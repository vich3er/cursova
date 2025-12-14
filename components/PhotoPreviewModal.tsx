import React from 'react';
import {
  View,
  Modal,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants';

interface PhotoPreviewModalProps {
  visible: boolean;
  photoUrl: string | null;
  onClose: () => void;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function PhotoPreviewModal({
  visible,
  photoUrl,
  onClose,
}: PhotoPreviewModalProps) {
  if (!photoUrl) return null;

  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <Pressable style={styles.backdrop} onPress={onClose} />

        <View style={styles.imageContainer}>
          <Image
            source={{ uri: photoUrl }}
            style={styles.image}
            contentFit="contain"
            transition={200}
          />

          <Pressable style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close-circle" size={40} color={COLORS.WHITE} />
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  imageContainer: {
    width: SCREEN_WIDTH * 0.95,
    height: SCREEN_HEIGHT * 0.8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  closeButton: {
    position: 'absolute',
    top: -50,
    right: -10,
    zIndex: 10,
  },
});
