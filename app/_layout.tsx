import ErrorBoundary from '@/components/ErrorBoundary';
import { SyncProvider } from '@/contexts/SyncContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { useAuth } from '@/hooks/useAuth';
import { useAutoBackup } from '@/hooks/useAutoBackup';
import { useIOSLocalNotifications } from '@/hooks/useIOSLocalNotifications';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { registerForPushNotificationsAsync, savePushTokenToUser } from '@/utils/notifications';
import * as Notifications from 'expo-notifications';
import { Slot, useRouter, useSegments } from 'expo-router';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, View } from 'react-native';
import 'react-native-gesture-handler';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

function LoadingScreen() { 
    return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" />
        </View>
    );
}

export default function RootLayout() {
    const { user, loading } = useAuth();
    const router = useRouter();
    const segments = useSegments();

    useNetworkStatus();

    useAutoBackup();

    useIOSLocalNotifications();

    useEffect(() => {
        if (user && !loading) {
            registerForPushNotificationsAsync().then(token => {
                if (token) {
                    savePushTokenToUser(user.uid, token);
                }
            });
        }
    }, [user, loading]);

    const notificationResponseListener = useRef<Notifications.EventSubscription>();

    useEffect(() => {
        notificationResponseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
            const data = response.notification.request.content.data;

            if (data?.groupId) {
                router.replace(`/group/${data.groupId}/lists`);
            }
        });

        return () => {
            if (notificationResponseListener.current) {
                notificationResponseListener.current.remove();
            }
        };
    }, [router]);

    useEffect(() => {
        if (loading) return;

        const inAuthGroup = segments[0] === '(auth)';
        const inTabsGroup = segments[0] === '(tabs)';

        if (!user && !inAuthGroup) {
            router.replace('/sign-in');
        } else if (user && inAuthGroup) {
            router.replace('/lists');
        } else if (user && segments.length === 0) {
            router.replace('/lists');
        } else if (!user && segments.length === 0) {
            router.replace('/sign-in');
        }
    }, [user, loading, segments]);

    if (loading) {
        return <LoadingScreen />;
    }

    return (
        <ErrorBoundary>
            <ToastProvider>
                <SyncProvider>
                    <SafeAreaProvider>
                        <GestureHandlerRootView style={{ flex: 1 }}>
                            <Slot />
                        </GestureHandlerRootView>
                    </SafeAreaProvider>
                </SyncProvider>
            </ToastProvider>
        </ErrorBoundary>
    );
}