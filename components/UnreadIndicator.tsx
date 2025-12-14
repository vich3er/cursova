import { COLORS } from '@/constants';
import React from 'react';
import { StyleSheet, View } from 'react-native';

interface UnreadIndicatorProps {
    show: boolean;
    size?: number;
}


export default function UnreadIndicator({ show, size = 8 }: UnreadIndicatorProps) {
    if (!show) return null;

    return (
        <View
            style={[
                styles.dot,
                {
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                },
            ]}
        />
    );
}

const styles = StyleSheet.create({
    dot: {
        backgroundColor: COLORS.ERROR,
        position: 'absolute',
        top: 0,
        right: 0,
    },
});
