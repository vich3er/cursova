import {
    doc,
    updateDoc,
    getDoc
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';

import { db } from '@/firebase/config';
import { COLLECTIONS } from '@/constants';

import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

export interface UserDoc {
    pushToken?: string;
    name?: string;
    [key: string]: any;
}

export interface GroupDoc {
    name?: string;
    members: string[];
    [key: string]: any;
}

export async function registerForPushNotificationsAsync(): Promise<string | null> {
    let token: string | null = null;

    const isExpoGo =
        Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

    if (isExpoGo) {
        return null;
    }

    try {
        if (Platform.OS === 'android') {
            await Notifications.setNotificationChannelAsync('default', {
                name: 'default',
                importance: Notifications.AndroidImportance.MAX,
                vibrationPattern: [0, 250, 250, 250],
                lightColor: '#FF231F7C'
            });
        }

        if (!Device.isDevice) {
            return null;
        }

        const { status: existingStatus } =
            await Notifications.getPermissionsAsync();

        let finalStatus = existingStatus;

        if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync({
                ios: {
                    allowAlert: true,
                    allowBadge: true,
                    allowSound: true,
                },
            });
            finalStatus = status;
        }

        if (finalStatus !== 'granted') {
            return null;
        }

        try {
            token = (await Notifications.getExpoPushTokenAsync()).data;
        } catch (error: any) {
            console.error('[PUSH] Failed to get token:', error);
        }
    } catch (error) {
        console.error('[PUSH] Unexpected error:', error);
    }

    return token;
}

export async function savePushTokenToUser(
    userId: string,
    pushToken: string | null
): Promise<void> {
    try {
        if (!pushToken) {
            return;
        }

        await updateDoc(doc(db, COLLECTIONS.USERS, userId), {
            pushToken: pushToken
        });
    } catch (error) {
        console.error('[PUSH] Error saving token:', error);
    }
}

async function sendPushNotification(
    expoPushToken: string,
    title: string,
    body: string,
    data?: Record<string, any>
): Promise<any> {
    if (Platform.OS === 'web') {
        try {
            const functions = getFunctions();
            const sendPush = httpsCallable(functions, 'sendPushNotification');

            const result = await sendPush({
                expoPushToken,
                title,
                body,
                notificationData: data || {}
            });

            return result.data;
        } catch (error: any) {
            console.error('[SEND] Cloud Function error:', error);
            throw error;
        }
    }

    const message = {
        to: expoPushToken,
        sound: 'default' as const,
        title,
        body,
        data: data || {}
    };

    try {
        const response = await fetch('https://exp.host/--/api/v2/push/send', {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Accept-encoding': 'gzip, deflate',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(message)
        });

        if (!response.ok) {
            console.error('[SEND] Expo API error:', response.status, response.statusText);
            throw new Error(`Expo push API error: ${response.status}`);
        }

        const result = await response.json();

        if (result.data && result.data[0] && result.data[0].status === 'error') {
            console.error('[SEND] Expo returned error:', result.data[0]);
        }

        return result;
    } catch (error) {
        console.error('[SEND] Error sending push:', error);
        throw error;
    }
}

export async function showLocalNotification(
    title: string,
    body: string,
    data?: Record<string, any>
): Promise<void> {
    if (Platform.OS !== 'ios') {
        return;
    }

    try {
        await Notifications.scheduleNotificationAsync({
            content: {
                title: title,
                body: body,
                sound: 'default',
                data: data || {},
            },
            trigger: null,
        });
    } catch (error) {
        console.error('[LOCAL] Error showing notification:', error);
    }
}

export async function showLocalNotificationForEvent(
    type: 'new_list' | 'new_item' | 'item_updated' | 'new_message' | 'list_completed' | 'added_to_group',
    groupName: string,
    detail: string,
    groupId: string
): Promise<void> {
    if (Platform.OS !== 'ios') {
        return;
    }

    let body = '';
    switch (type) {
        case 'new_list':
            body = `Новий список: "${detail}"`;
            break;
        case 'new_item':
            body = `Додано товар: "${detail}"`;
            break;
        case 'item_updated':
            body = `Оновлено товар: "${detail}"`;
            break;
        case 'new_message':
            body = detail;
            break;
        case 'list_completed':
            body = `Список "${detail}" завершено`;
            break;
        case 'added_to_group':
            body = `Вас додано до групи "${groupName}"`;
            break;
    }

    await showLocalNotification(groupName, body, { groupId, type });
}

async function getGroupMemberTokens(
    groupId: string,
    excludeUserId?: string
): Promise<string[]> {
    try {
        const ref = doc(db, COLLECTIONS.GROUPS, groupId);
        const snap = await getDoc(ref);

        if (!snap.exists()) {
            return [];
        }

        const data = snap.data() as GroupDoc;
        const memberIds = data.members || [];

        const filtered = excludeUserId
            ? memberIds.filter(id => id !== excludeUserId)
            : memberIds;

        const tokens: string[] = [];

        for (const id of filtered) {
            const userSnap = await getDoc(doc(db, COLLECTIONS.USERS, id));

            if (!userSnap.exists()) {
                continue;
            }

            const userData = userSnap.data() as UserDoc;

            if (userData.pushToken) {
                tokens.push(userData.pushToken);
            }
        }

        return tokens;
    } catch (e) {
        console.error('[TOKEN] Error:', e);
        return [];
    }
}

async function getGroupName(groupId: string): Promise<string> {
    try {
        const snap = await getDoc(doc(db, COLLECTIONS.GROUPS, groupId));

        if (!snap.exists()) {
            return 'Група';
        }

        const data = snap.data() as GroupDoc;
        return data.name || 'Група';
    } catch (e) {
        console.error('[GROUP] Error:', e);
        return 'Група';
    }
}

export async function notifyNewList(
    groupId: string,
    listName: string,
    creatorUserId: string
): Promise<void> {
    try {
        const groupName = await getGroupName(groupId);
        const tokens = await getGroupMemberTokens(groupId, creatorUserId);

        const title = groupName;
        const body = `Новий список: "${listName}"`;

        for (const token of tokens) {
            await sendPushNotification(token, title, body, {
                groupId,
                type: 'new_list'
            });
        }
    } catch (error) {
        console.error('[NOTIFY] Error:', error);
    }
}

export async function notifyUserAddedToGroup(
    groupId: string,
    groupName: string,
    addedUserId: string
): Promise<void> {
    try {
        const userSnap = await getDoc(doc(db, COLLECTIONS.USERS, addedUserId));

        if (!userSnap.exists()) {
            return;
        }

        const userData = userSnap.data() as UserDoc;

        if (!userData.pushToken) {
            return;
        }

        const token = userData.pushToken;
        const title = groupName;
        const body = `Вас додано до групи "${groupName}"`;

        await sendPushNotification(token, title, body, {
            groupId,
            type: 'added_to_group'
        });
    } catch (error) {
        console.error('[NOTIFY] Error:', error);
    }
}


export async function notifyNewItem(
    groupId: string,
    listName: string,
    itemText: string,
    creatorUserId: string
): Promise<void> {
    try {
        const groupName = await getGroupName(groupId);
        const tokens = await getGroupMemberTokens(groupId, creatorUserId);

        const title = groupName;
        const body = `Додано товар "${itemText}" до списку "${listName}"`;

        for (const token of tokens) {
            await sendPushNotification(token, title, body, {
                groupId,
                type: 'new_item'
            });
        }
    } catch (error) {
        console.error('[NOTIFY] Error:', error);
    }
}

export async function notifyItemUpdate(
    groupId: string,
    listName: string,
    itemName: string,
    updaterUserId: string,
    isImageUpdate: boolean = false
): Promise<void> {
    try {
        const groupName = await getGroupName(groupId);
        const tokens = await getGroupMemberTokens(groupId, updaterUserId);

        const title = groupName;
        let body = '';

        if (isImageUpdate) {
            body = `Оновлено фото товару "${itemName}" у списку "${listName}"`;
        } else {
            body = `Оновлено товар "${itemName}" у списку "${listName}"`;
        }

        for (const token of tokens) {
            await sendPushNotification(token, title, body, {
                groupId,
                type: 'item_updated',
                listName
            });
        }
    } catch (error) {
        console.error('[NOTIFY] Error:', error);
    }
}

export async function notifyNewMessage(
    groupId: string,
    messageText: string,
    senderName: string,
    senderUserId: string
): Promise<void> {
    try {
        const groupName = await getGroupName(groupId);
        const tokens = await getGroupMemberTokens(groupId, senderUserId);

        const truncated =
            messageText.length > 50
                ? messageText.substring(0, 50) + '...'
                : messageText;

        const title = groupName;
        const body = `${senderName}: ${truncated}`;

        for (const token of tokens) {
            await sendPushNotification(token, title, body, {
                groupId,
                type: 'new_message'
            });
        }
    } catch (error) {
        console.error('[NOTIFY] Error:', error);
    }
}

export async function notifyListCompleted(
    groupId: string,
    listName: string,
    completerUserId: string
): Promise<void> {
    try {
        const groupName = await getGroupName(groupId);
        const tokens = await getGroupMemberTokens(groupId, completerUserId);

        const title = groupName;
        const body = `Список "${listName}" завершено`;

        for (const token of tokens) {
            await sendPushNotification(token, title, body, {
                groupId,
                type: 'list_completed'
            });
        }
    } catch (error) {
        console.error('[NOTIFY] Error:', error);
    }
}
