import * as admin from 'firebase-admin';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

admin.initializeApp();

interface PushNotificationData {
    expoPushToken: string;
    title: string;
    body: string;
    notificationData?: Record<string, any>;
}

export const sendPushNotification = onCall(async (request) => {
    if (!request.auth) {
        throw new HttpsError(
            'unauthenticated',
            'User must be authenticated to send notifications'
        );
    }

    const data = request.data as PushNotificationData;
    const { expoPushToken, title, body, notificationData } = data;

    if (!expoPushToken || typeof expoPushToken !== 'string') {
        throw new HttpsError(
            'invalid-argument',
            'expoPushToken is required and must be a string'
        );
    }

    if (!title || typeof title !== 'string') {
        throw new HttpsError(
            'invalid-argument',
            'title is required and must be a string'
        );
    }

    if (!body || typeof body !== 'string') {
        throw new HttpsError(
            'invalid-argument',
            'body is required and must be a string'
        );
    }

    const message = {
        to: expoPushToken,
        sound: 'default',
        title: title,
        body: body,
        data: notificationData || {}
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
            const errorText = await response.text();
            console.error('[CLOUD FUNCTION] Expo API error:', response.status, errorText);
            throw new HttpsError(
                'internal',
                `Expo Push API error: ${response.status}`
            );
        }

        const result = await response.json();

        if (result.data && result.data[0] && result.data[0].status === 'error') {
            console.error('[CLOUD FUNCTION] Expo returned error:', result.data[0]);
            throw new HttpsError(
                'internal',
                `Expo error: ${result.data[0].message || 'Unknown error'}`
            );
        }

        return {
            success: true,
            result: result
        };
    } catch (error: any) {
        console.error('[CLOUD FUNCTION] Error:', error);

        if (error instanceof HttpsError) {
            throw error;
        }

        throw new HttpsError(
            'internal',
            `Failed to send push notification: ${error.message}`
        );
    }
});
