import { COLORS } from '@/constants';
import React from 'react';
import { StyleSheet, useColorScheme, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';


export default function BottomNavigationBar() {
    const insets = useSafeAreaInsets();
    const colorScheme = useColorScheme();

    if (insets.bottom === 0) {
        return null;
    }

    const backgroundColor = colorScheme === 'dark' ? COLORS.BLACK : COLORS.WHITE;

    return (
        <View
            style={[
                styles.bottomBar,
                { height: insets.bottom, backgroundColor }
            ]}
        />
    );
}

const styles = StyleSheet.create({
    bottomBar: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
    },
});
