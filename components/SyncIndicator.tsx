import React from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';
import { COLORS } from '@/constants';

interface SyncIndicatorProps {
    show: boolean;
    size?: 'small' | 'large';
    color?: string;
}

export default function SyncIndicator({
    show,
    size = 'small',
    color = COLORS.PRIMARY
}: SyncIndicatorProps) {
    if (!show) return null;

    return (
        <ActivityIndicator
            size={size}
            color={color}
            style={styles.indicator}
        />
    );
}

const styles = StyleSheet.create({
    indicator: {
        marginLeft: 8,
    },
});
