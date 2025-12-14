import GroupChatTab from "@/app/group/[groupId]/chat";
import GroupListsTab from "@/app/group/[groupId]/lists";
import GroupMembersTab from "@/app/group/[groupId]/members";
import UnreadIndicator from '@/components/UnreadIndicator';
import { COLLECTIONS, COLORS } from '@/constants';
import { db } from '@/firebase/config';
import { useAuth } from '@/hooks/useAuth';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useUnreadChat } from '@/hooks/useUnreadChat';
import { useUnreadListsTab } from '@/hooks/useUnreadListsTab';
import { loadBackup } from '@/utils/backupService';
import { markGroupAsVisited } from '@/utils/readStatus';
import { Ionicons } from '@expo/vector-icons';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { useFocusEffect, useNavigationState } from '@react-navigation/native';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { doc, onSnapshot } from 'firebase/firestore';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, Pressable, StyleSheet, Text, View } from 'react-native';

const TopTab = createMaterialTopTabNavigator();

export default function GroupTabsLayout() {
    const { groupId } = useLocalSearchParams<{ groupId: string }>();
    const navigation = useNavigation();
    const router = useRouter();
    const { user } = useAuth();
    const { isOffline } = useNetworkStatus();
    const [groupName, setGroupName] = useState<string>('');
    const loadedFromBackupRef = useRef(false);

    const [chatRefreshTrigger, setChatRefreshTrigger] = useState(0);
    const activeRoute = useNavigationState(state => {
        if (!state) return null;
        const route = state.routes[state.index];
        if (route.state) {
            return route.state.routes[route.state.index]?.name;
        }
        return null;
    });

    useEffect(() => {
        if (activeRoute === 'chat') {
            setChatRefreshTrigger(prev => prev + 1);
        }
    }, [activeRoute]);

    const hasUnreadChat = useUnreadChat(groupId, user?.uid, chatRefreshTrigger);
    const hasUnreadLists = useUnreadListsTab(groupId, user?.uid);

    useFocusEffect(
        useCallback(() => {
            if (groupId) {
                markGroupAsVisited(groupId as string);
            }
        }, [groupId])
    );

    const handleBackPress = useCallback(() => {
        router.replace('/(tabs)/lists');
        return true;
    }, [router]);

    useEffect(() => {
        const backHandler = BackHandler.addEventListener('hardwareBackPress', handleBackPress);
        return () => backHandler.remove();
    }, [handleBackPress]);

    useEffect(() => {
        if (!groupId || loadedFromBackupRef.current) return;

        const loadFromBackup = async () => {
            try {
                const backup = await loadBackup();
                if (backup && backup.groups) {
                    const backupGroup = backup.groups.find(g => g.id === groupId);
                    if (backupGroup) {
                        setGroupName(backupGroup.name);
                        navigation.setOptions({ title: backupGroup.name });
                        loadedFromBackupRef.current = true;
                    }
                }
            } catch (error) {
                console.error('[GROUP_LAYOUT] Error loading from backup:', error);
            }
        };

        loadFromBackup();
    }, [groupId, navigation]);

    useEffect(() => {
        if (!groupId) return;

        const docRef = doc(db, COLLECTIONS.GROUPS, groupId as string);

        const unsubscribe = onSnapshot(
            docRef,
            { includeMetadataChanges: true },
            (docSnap) => {
                if (docSnap.exists()) {
                    const name = docSnap.data().name;
                    setGroupName(name);
                    navigation.setOptions({ title: name });
                } else {
                    if (loadedFromBackupRef.current) {
                        return;
                    }
                    if (!docSnap.metadata.fromCache) {
                        router.replace('/(tabs)/lists');
                    }
                }
            },
            (error) => {
                if (error.code === 'permission-denied') {
                    if (!loadedFromBackupRef.current) {
                        router.replace('/(tabs)/lists');
                    }
                    return;
                }
                if (error.code === 'unavailable') {
                    return;
                }
                console.error('Error loading group:', error);
                if (!loadedFromBackupRef.current) {
                    setGroupName('Помилка');
                    navigation.setOptions({ title: 'Помилка' });
                }
            }
        );

        return () => unsubscribe();
    }, [groupId, navigation, router]);

    useEffect(() => {
        if (!groupName) return;

        navigation.setOptions({
            headerTitle: () => (
                <View style={styles.headerContainer}>
                    <Text style={styles.headerTitle}>{groupName}</Text>
                    {isOffline && (
                        <View style={styles.offlineIndicator}>
                            <Ionicons name="cloud-offline-outline" size={14} color={COLORS.WARNING} />
                            <Text style={styles.offlineText}>Немає інтернету</Text>
                        </View>
                    )}
                </View>
            ),
            headerLeft: () => (
                <Pressable onPress={handleBackPress} style={{ marginLeft: 15 }}>
                    <Ionicons name="arrow-back" size={24} color={COLORS.TEXT_PRIMARY} />
                </Pressable>
            ),
        });
    }, [groupName, isOffline, navigation, handleBackPress]);

    const renderTabLabel = (label: string, hasUnread: boolean) => {
        return ({ focused }: { focused: boolean }) => (
            <View style={styles.tabLabelContainer}>
                <Text style={[styles.tabLabel, focused && styles.tabLabelFocused]}>
                    {label}
                </Text>
                <UnreadIndicator show={hasUnread} size={8} />
            </View>
        );
    };

    return (
        <TopTab.Navigator
            screenOptions={{
                tabBarActiveTintColor: COLORS.PRIMARY,
                tabBarLabelStyle: { fontWeight: 'bold' },
                tabBarIndicatorStyle: { backgroundColor: COLORS.PRIMARY },
                lazy: true, 
                lazyPlaceholder: () => (
                    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                        <ActivityIndicator size="large" color={COLORS.PRIMARY} />
                    </View>
                ),
            }}
        >
            <TopTab.Screen
                name="lists"
                options={{
                    tabBarLabel: renderTabLabel('Списки', hasUnreadLists),
                }}
                component={GroupListsTab}
            />
            <TopTab.Screen
                name="chat"
                options={{
                    tabBarLabel: renderTabLabel('Чат', hasUnreadChat),
                }}
                component={GroupChatTab}
            />
            <TopTab.Screen
                name="members"
                options={{ title: 'Учасники' }}
                component={GroupMembersTab}
            />
        </TopTab.Navigator>
    );
}

const styles = StyleSheet.create({
    headerContainer: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: COLORS.TEXT_PRIMARY,
    },
    offlineIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 2,
        gap: 4,
    },
    offlineText: {
        fontSize: 12,
        color: COLORS.WARNING,
        fontWeight: '500',
    },
    tabLabelContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        position: 'relative',
    },
    tabLabel: {
        fontWeight: 'bold',
        fontSize: 14,
    },
    tabLabelFocused: {
        color: COLORS.PRIMARY,
    },
});