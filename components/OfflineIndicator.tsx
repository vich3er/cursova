import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { COLORS } from '@/constants';

export default function OfflineIndicator() {
  const { isOffline } = useNetworkStatus();

  if (!isOffline) return null;

  return (
    <View style={styles.container}>
      <Ionicons name="cloud-offline-outline" size={16} color={COLORS.WHITE} style={styles.icon} />
      <Text style={styles.text}>Офлайн-режим • Зміни синхронізуються при підключенні</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.WARNING,
    padding: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    marginRight: 6,
  },
  text: {
    color: COLORS.WHITE,
    fontSize: 13,
    fontWeight: '600',
  },
});
