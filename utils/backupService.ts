import { COLLECTIONS } from '@/constants';
import { db } from '@/firebase/config';
import { ChatMessage, ShoppingGroup, ShoppingItem, ShoppingList, UserProfile } from '@/types';
import * as FileSystem from 'expo-file-system/legacy';
import { collection, getDocs, query, where } from 'firebase/firestore';

export interface BackupData {
  version: string;
  timestamp: number;
  userId: string;
  userProfile: UserProfile | null;
  groups: ShoppingGroup[];
  lists: ShoppingList[];
  items: ShoppingItem[];
  chatMessages: { [groupId: string]: ChatMessage[] };
}

export function toSafeDate(timestamp: any): Date {
  if (!timestamp) {
    return new Date();
  }
  if (typeof timestamp.toDate === 'function') {
    return timestamp.toDate();
  }
  if (timestamp.seconds !== undefined) {
    return new Date(timestamp.seconds * 1000 + (timestamp.nanoseconds || 0) / 1000000);
  }
  if (timestamp instanceof Date) {
    return timestamp;
  }
  if (typeof timestamp === 'number') {
    return new Date(timestamp);
  }
  if (typeof timestamp === 'string') {
    return new Date(timestamp);
  }
  return new Date();
}

const BACKUP_DIR = `${FileSystem.documentDirectory}backups/`;
const BACKUP_FILE = 'shopping_list_backup.json';


async function ensureBackupDirectory(): Promise<void> {
  const dirInfo = await FileSystem.getInfoAsync(BACKUP_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(BACKUP_DIR, { intermediates: true });
  }
}


export async function fetchUserData(userId: string): Promise<BackupData> {
  try {
    let userProfile: UserProfile | null = null;
    try {
      const userSnapshot = await getDocs(
        query(collection(db, COLLECTIONS.USERS), where('uid', '==', userId))
      );
      if (!userSnapshot.empty) {
        userProfile = userSnapshot.docs[0].data() as UserProfile;
      }
    } catch (error: any) {
      if (error?.code !== 'permission-denied') {
        console.error('[FETCH] Error fetching user profile:', error);
      }
    }

    let groups: ShoppingGroup[] = [];

    try {
      const groupsSnapshot = await getDocs(
        query(
          collection(db, COLLECTIONS.GROUPS),
          where('members', 'array-contains', userId)
        )
      );
      groups = groupsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as ShoppingGroup[];
    } catch (error: any) {
      if (error?.code !== 'permission-denied') {
        console.error('[FETCH] Error fetching groups:', error);
      }
    }

    const lists: ShoppingList[] = [];
    const items: ShoppingItem[] = [];
    const chatMessages: { [groupId: string]: ChatMessage[] } = {};

    for (const group of groups) {
      try {
        const listsSnapshot = await getDocs(
          query(
            collection(db, COLLECTIONS.SHOPPING_LISTS),
            where('groupId', '==', group.id)
          )
        );

        for (const listDoc of listsSnapshot.docs) {
          const list = { id: listDoc.id, ...listDoc.data() } as ShoppingList;
          lists.push(list);

          const itemsSnapshot = await getDocs(
            query(
              collection(db, COLLECTIONS.ITEMS),
              where('shoppingListId', '==', list.id)
            )
          );

          itemsSnapshot.docs.forEach(itemDoc => {
            items.push({ id: itemDoc.id, ...itemDoc.data() } as ShoppingItem);
          });
        }

        try {
          const messagesSnapshot = await getDocs(
            collection(db, COLLECTIONS.CHATS, group.id, 'messages')
          );

          const groupMessages: ChatMessage[] = messagesSnapshot.docs.map(msgDoc => ({
            id: msgDoc.id,
            ...msgDoc.data(),
          })) as ChatMessage[];

          if (groupMessages.length > 0) {
            chatMessages[group.id] = groupMessages;
          }
        } catch (chatError: any) {
        }
      } catch (error: any) {
        if (error?.code !== 'permission-denied') {
          console.error('[FETCH] Error for group:', error);
        }
      }
    }

    const backupData: BackupData = {
      version: '1.1',
      timestamp: Date.now(),
      userId,
      userProfile,
      groups,
      lists,
      items,
      chatMessages,
    };

    return backupData;
  } catch (error) {
    console.error('[FETCH] Error fetching user data:', error);
    throw error;
  }
}

export async function saveBackup(data: BackupData): Promise<string> {
  try {
    await ensureBackupDirectory();
    const filePath = `${BACKUP_DIR}${BACKUP_FILE}`;
    const jsonData = JSON.stringify(data, null, 2);

    await FileSystem.writeAsStringAsync(filePath, jsonData, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    return filePath;
  } catch (error) {
    console.error('[BACKUP] Error saving backup:', error);
    throw error;
  }
}

export async function loadBackup(): Promise<BackupData | null> {
  try {
    const filePath = `${BACKUP_DIR}${BACKUP_FILE}`;
    const fileInfo = await FileSystem.getInfoAsync(filePath);

    if (!fileInfo.exists) {
      return null;
    }

    const jsonData = await FileSystem.readAsStringAsync(filePath, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    return JSON.parse(jsonData) as BackupData;
  } catch (error) {
    console.error('[BACKUP] Error loading backup:', error);
    return null;
  }
}

export async function updateItemInBackup(itemId: string, isDone: boolean): Promise<void> {
  try {
    const backup = await loadBackup();
    if (!backup || !backup.items) {
      return;
    }

    const itemIndex = backup.items.findIndex(item => item.id === itemId);
    if (itemIndex === -1) {
      return;
    }

    backup.items[itemIndex] = {
      ...backup.items[itemIndex],
      isDone,
    };

    await saveBackup(backup);
  } catch (error) {
    console.error('[BACKUP] Error updating item:', error);
  }
}

export async function updateListCompletionInBackup(listId: string, isComplete: boolean): Promise<void> {
  try {
    const backup = await loadBackup();
    if (!backup || !backup.lists) {
      return;
    }

    const listIndex = backup.lists.findIndex(list => list.id === listId);
    if (listIndex === -1) {
      return;
    }

    backup.lists[listIndex] = {
      ...backup.lists[listIndex],
      isComplete,
    };

    await saveBackup(backup);
  } catch (error) {
    console.error('[BACKUP] Error updating list:', error);
  }
}


export async function checkListCompletionFromBackup(listId: string): Promise<boolean> {
  try {
    const backup = await loadBackup();
    if (!backup || !backup.items) {
      return false;
    }

    const listItems = backup.items.filter(item => item.shoppingListId === listId);
    if (listItems.length === 0) {
      return false;
    }

    return listItems.every(item => item.isDone);
  } catch (error) {
    console.error('[BACKUP] Error checking list completion:', error);
    return false;
  }
}

export async function createBackup(userId: string): Promise<string> {
  const data = await fetchUserData(userId);
  return await saveBackup(data);
}

export async function getBackupInfo(): Promise<{
  exists: boolean;
  size?: number;
  modificationTime?: number;
} | null> {
  try {
    const filePath = `${BACKUP_DIR}${BACKUP_FILE}`;
    const fileInfo = await FileSystem.getInfoAsync(filePath);

    if (!fileInfo.exists) {
      return { exists: false };
    }

    return {
      exists: true,
      size: fileInfo.size,
      modificationTime: fileInfo.modificationTime,
    };
  } catch (error) {
    console.error('Error getting backup info:', error);
    return null;
  }
}

export async function deleteBackup(): Promise<void> {
  try {
    const filePath = `${BACKUP_DIR}${BACKUP_FILE}`;
    const fileInfo = await FileSystem.getInfoAsync(filePath);

    if (fileInfo.exists) {
      await FileSystem.deleteAsync(filePath);
    }
  } catch (error) {
    console.error('[BACKUP] Error deleting backup:', error);
    throw error;
  }
}

export async function exportBackup(): Promise<string | null> {
  try {
    const filePath = `${BACKUP_DIR}${BACKUP_FILE}`;
    const fileInfo = await FileSystem.getInfoAsync(filePath);

    if (!fileInfo.exists) {
      return null;
    }

    const exportPath = `${FileSystem.cacheDirectory}shopping_list_backup_${Date.now()}.json`;
    await FileSystem.copyAsync({
      from: filePath,
      to: exportPath,
    });

    return exportPath;
  } catch (error) {
    console.error('Error exporting backup:', error);
    return null;
  }
}
