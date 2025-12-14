import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEYS = {
    CHAT_VISIT: (groupId: string) => `chat_last_visit_${groupId}`,
    LIST_VISIT: (listId: string) => `list_last_visit_${listId}`,
    GROUP_VISIT: (groupId: string) => `group_last_visit_${groupId}`,
};

export async function markChatAsRead(groupId: string): Promise<void> {
    try {
        const now = Date.now().toString();
        await AsyncStorage.setItem(STORAGE_KEYS.CHAT_VISIT(groupId), now);
    } catch (error) {
        console.error('Error marking chat as read:', error);
    }
}


export async function getLastChatVisit(groupId: string): Promise<number> {
    try {
        const value = await AsyncStorage.getItem(STORAGE_KEYS.CHAT_VISIT(groupId));
        return value ? parseInt(value, 10) : 0;
    } catch (error) {
        console.error('Error getting last chat visit:', error);
        return 0;
    }
}


export async function markListAsRead(listId: string): Promise<void> {
    try {
        const now = Date.now().toString();
        await AsyncStorage.setItem(STORAGE_KEYS.LIST_VISIT(listId), now);
    } catch (error) {
        console.error('Error marking list as read:', error);
    }
}


export async function getLastListVisit(listId: string): Promise<number> {
    try {
        const value = await AsyncStorage.getItem(STORAGE_KEYS.LIST_VISIT(listId));
        return value ? parseInt(value, 10) : 0;
    } catch (error) {
        console.error('Error getting last list visit:', error);
        return 0;
    }
}


export async function markGroupAsVisited(groupId: string): Promise<void> {
    try {
        const now = Date.now().toString();
        await AsyncStorage.setItem(STORAGE_KEYS.GROUP_VISIT(groupId), now);
    } catch (error) {
        console.error('Error marking group as visited:', error);
    }
}


export async function hasVisitedGroup(groupId: string): Promise<boolean> {
    try {
        const value = await AsyncStorage.getItem(STORAGE_KEYS.GROUP_VISIT(groupId));
        return value !== null;
    } catch (error) {
        console.error('Error checking group visit:', error);
        return false;
    }
}
