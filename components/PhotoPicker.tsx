import { COLORS } from '@/constants';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import React from 'react';
import { ActionSheetIOS, Alert, Platform, Pressable } from 'react-native';

const isWeb = Platform.OS === 'web';

interface PhotoPickerProps {
  onPhotoPicked: (uri: string) => void;
  iconSize?: number;
  iconColor?: string;
  disabled?: boolean;
}

export default function PhotoPicker({
  onPhotoPicked,
  iconSize = 28,
  iconColor = COLORS.PRIMARY,
  disabled = false,
}: PhotoPickerProps) {

  const requestPermissions = async (type: 'camera' | 'library') => {
    if (isWeb) return true;

    try {
      if (type === 'camera') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(
            'Доступ заборонено',
            'Для використання камери необхідно надати дозвіл у налаштуваннях.',
            [{ text: 'OK' }]
          );
          return false;
        }
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(
            'Доступ заборонено',
            'Для вибору фото необхідно надати дозвіл у налаштуваннях.',
            [{ text: 'OK' }]
          );
          return false;
        }
      }
      return true;
    } catch (error) {
      console.error('Error requesting permissions:', error);
      return false;
    }
  };

  const pickImageFromCamera = async () => {
    const hasPermission = await requestPermissions('camera');
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        onPhotoPicked(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image from camera:', error);
      Alert.alert('Помилка', 'Не вдалося зробити фото');
    }
  };

  const pickImageFromLibrary = async () => {
    const hasPermission = await requestPermissions('library');
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        onPhotoPicked(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image from library:', error);
      Alert.alert('Помилка', 'Не вдалося вибрати фото');
    }
  };

  const showImagePickerOptions = () => {
    if (isWeb) {
      pickImageFromLibrary();
      return;
    }

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Скасувати', 'Зробити фото', 'Вибрати з галереї'],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) {
            pickImageFromCamera();
          } else if (buttonIndex === 2) {
            pickImageFromLibrary();
          }
        }
      );
    } else {
      Alert.alert(
        'Додати фото',
        'Виберіть джерело фото',
        [
          { text: 'Скасувати', style: 'cancel' },
          { text: 'Зробити фото', onPress: pickImageFromCamera },
          { text: 'Вибрати з галереї', onPress: pickImageFromLibrary },
        ],
        { cancelable: true }
      );
    }
  };

  return (
    <Pressable
      onPress={showImagePickerOptions}
      disabled={disabled}
      accessibilityLabel="Додати фото"
      accessibilityRole="button"
      style={{ opacity: disabled ? 0.5 : 1 }}
    >
      <Ionicons name="camera-outline" size={iconSize} color={iconColor} />
    </Pressable>
  );
}
