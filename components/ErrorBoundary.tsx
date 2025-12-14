import React, { Component, ReactNode, ErrorInfo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { COLORS } from '@/constants';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <View style={styles.container}>
          <Text style={styles.title}>Упс! Щось пішло не так</Text>
          <Text style={styles.message}>
            Сталася несподівана помилка. Будь ласка, спробуйте ще раз.
          </Text>
          {__DEV__ && this.state.error && (
            <Text style={styles.errorDetails}>
              {this.state.error.toString()}
            </Text>
          )}
          <Pressable style={styles.button} onPress={this.handleReset}>
            <Text style={styles.buttonText}>Спробувати знову</Text>
          </Pressable>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: COLORS.BACKGROUND,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.TEXT_PRIMARY,
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: COLORS.TEXT_SECONDARY,
    textAlign: 'center',
    marginBottom: 20,
  },
  errorDetails: {
    fontSize: 12,
    color: COLORS.ERROR,
    marginBottom: 20,
    padding: 12,
    backgroundColor: COLORS.BACKGROUND_SECONDARY,
    borderRadius: 8,
    fontFamily: 'monospace',
  },
  button: {
    backgroundColor: COLORS.PRIMARY,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    color: COLORS.WHITE,
    fontSize: 16,
    fontWeight: '600',
  },
});
