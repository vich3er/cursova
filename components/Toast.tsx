import React, { useEffect } from 'react';
import { StyleSheet, Text, View, Animated, Dimensions } from 'react-native';
import { COLORS } from '@/constants';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastProps {
  message: string;
  type: ToastType;
  visible: boolean;
  onHide: () => void;
  duration?: number;
}

const { width } = Dimensions.get('window');

export default function Toast({
  message,
  type,
  visible,
  onHide,
  duration = 3000,
}: ToastProps) {
  const opacity = React.useRef(new Animated.Value(0)).current;
  const translateY = React.useRef(new Animated.Value(-100)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 50,
          friction: 7,
        }),
      ]).start();

      const timer = setTimeout(() => {
        Animated.parallel([
          Animated.timing(opacity, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(translateY, {
            toValue: -100,
            duration: 300,
            useNativeDriver: true,
          }),
        ]).start(() => onHide());
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [visible, opacity, translateY, onHide, duration]);

  if (!visible) return null;

  const getBackgroundColor = () => {
    switch (type) {
      case 'success':
        return COLORS.SUCCESS;
      case 'error':
        return COLORS.ERROR;
      case 'warning':
        return COLORS.WARNING;
      case 'info':
        return COLORS.INFO;
      default:
        return COLORS.PRIMARY;
    }
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity,
          transform: [{ translateY }],
          backgroundColor: getBackgroundColor(),
        },
      ]}
    >
      <Text style={styles.message}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
    maxWidth: width - 40,
    padding: 16,
    borderRadius: 12,
    zIndex: 9999,
    elevation: 10,
    shadowColor: COLORS.BLACK,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  message: {
    color: COLORS.WHITE,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});
