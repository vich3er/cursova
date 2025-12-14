import UnreadIndicator from '@/components/UnreadIndicator';
import { COLORS } from "@/constants";
import { useUnreadGroup } from '@/hooks/useUnreadGroup';
import { ShoppingGroup } from '@/types';
import { hasVisitedGroup } from '@/utils/readStatus';
import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

interface GroupListItemProps {
    group: ShoppingGroup;
    currentUserId?: string;
    refreshTrigger?: number; 
}

export default function GroupListItem({ group, currentUserId, refreshTrigger }: GroupListItemProps) {
    const hasUnread = useUnreadGroup(group.id, currentUserId);
    const [isNewGroup, setIsNewGroup] = useState(false);

    useEffect(() => {
        const checkIfNew = async () => {
            if (!currentUserId) {
                setIsNewGroup(false);
                return;
            }

            const isOwner = group.ownerId === currentUserId;
            const visited = await hasVisitedGroup(group.id);

            setIsNewGroup(!isOwner && !visited);
        };

        checkIfNew();
    }, [group.id, group.ownerId, currentUserId, refreshTrigger]);

    return (
        <Link href={`/group/${group.id}`} asChild>
            <Pressable style={styles.container}>
                <View style={styles.iconContainer}>
                <Ionicons name="list" size={24} color={COLORS.SECONDARY} />
                    <UnreadIndicator show={hasUnread} size={10} />
                </View>
                <View style={styles.textContainer}>
                    <View style={styles.titleRow}>
                        <Text style={styles.title}>{group.name}</Text>
                        {isNewGroup && (
                            <View style={styles.newBadge}>
                                <Text style={styles.newBadgeText}>Нова</Text>
                            </View>
                        )}
                    </View>
                    <Text style={styles.subtitle}>{group.members.length} учасник(ів)</Text>
                </View>
                <Ionicons name="chevron-forward-outline" size={24} color={COLORS.SECONDARY} />
            </Pressable>
        </Link>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 15,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',

    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15,
        position: 'relative',
    },
    textContainer: {
        flex: 1, 
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    title: {
        fontSize: 17,
        fontWeight: '500', 
    },
    newBadge: {
        backgroundColor: '#34C759', 
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 4,
    },
    newBadgeText: {
        color: '#FFFFFF', 
        fontSize: 12,
        fontWeight: '600',
    },
    subtitle: {
        fontSize: 14,
        color: '#8e8e93',
    },
});