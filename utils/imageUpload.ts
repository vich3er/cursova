import { IMAGE } from '@/constants';
import { storage } from '@/firebase/config';
import * as ImageManipulator from 'expo-image-manipulator';
import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';

interface UploadResult {
  url: string;
  path: string;
}

export async function uploadItemPhoto(
  uri: string,
  itemId: string,
  userId: string
): Promise<UploadResult> {
  try {
    const manipulatedImage = await ImageManipulator.manipulateAsync(
      uri,
      [
        {
          resize: {
            width: IMAGE.MAX_WIDTH,
          },
        },
      ],
      {
        compress: IMAGE.COMPRESSION_QUALITY,
        format: ImageManipulator.SaveFormat.JPEG,
      }
    );

    const response = await fetch(manipulatedImage.uri);
    const blob = await response.blob();

    if (blob.size > IMAGE.MAX_SIZE) {
      throw new Error(`Розмір зображення не повинен перевищувати ${IMAGE.MAX_SIZE / 1024 / 1024}MB`);
    }

    const timestamp = Date.now();
    const storagePath = `items/${itemId}/${timestamp}-${userId}.jpg`;
    const storageRef = ref(storage, storagePath);

    await uploadBytes(storageRef, blob, {
      contentType: 'image/jpeg',
    });

    const downloadURL = await getDownloadURL(storageRef);

    return {
      url: downloadURL,
      path: storagePath,
    };
  } catch (error: any) {
    console.error('Error uploading image:', error);
    throw new Error(error.message || 'Не вдалося завантажити зображення');
  }
}


export async function deleteItemPhoto(photoURL: string): Promise<void> {
  if (!photoURL) return;

  try {
    let storagePath = photoURL;

    if (photoURL.includes('firebase')) {
      const matches = photoURL.match(/items%2F[^?]+/);
      if (matches) {
        storagePath = decodeURIComponent(matches[0]);
      }
    }

    const storageRef = ref(storage, storagePath);
    await deleteObject(storageRef);
  } catch (error: any) {
    if (error.code !== 'storage/object-not-found') {
      console.error('Error deleting image:', error);
      throw new Error('Не вдалося видалити зображення');
    }
  }
}


export function validateImageUri(uri: string): boolean {
  if (!uri) return false;

  const validPrefixes = ['file://', 'content://', 'data:', 'http://', 'https://'];
  return validPrefixes.some(prefix => uri.startsWith(prefix));
}

export async function uploadChatPhoto(
  uri: string,
  groupId: string,
  userId: string
): Promise<string> {
  try {
    const manipulatedImage = await ImageManipulator.manipulateAsync(
      uri,
      [
        {
          resize: {
            width: IMAGE.MAX_WIDTH,
          },
        },
      ],
      {
        compress: IMAGE.COMPRESSION_QUALITY,
        format: ImageManipulator.SaveFormat.JPEG,
      }
    );

    const response = await fetch(manipulatedImage.uri);
    const blob = await response.blob();

    if (blob.size > IMAGE.MAX_SIZE) {
      throw new Error(`Розмір зображення не повинен перевищувати ${IMAGE.MAX_SIZE / 1024 / 1024}MB`);
    }

    const timestamp = Date.now();
    const storagePath = `chats/${groupId}/${timestamp}-${userId}.jpg`;
    const storageRef = ref(storage, storagePath);

    await uploadBytes(storageRef, blob, {
      contentType: 'image/jpeg',
    });

    const downloadURL = await getDownloadURL(storageRef);

    return downloadURL;
  } catch (error: any) {
    console.error('❌ Error uploading chat image:', error);
    console.error('❌ Error code:', error.code);
    console.error('❌ Error message:', error.message);
    throw new Error(error.message || 'Не вдалося завантажити зображення');
  }
}
