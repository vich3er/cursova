import { FirebaseError } from 'firebase/app';
import { Alert } from 'react-native';

export interface ErrorHandlerOptions {
  showAlert?: boolean;
  logToConsole?: boolean;
  customMessage?: string;
}

const getFirebaseErrorMessage = (error: FirebaseError): string => {
  const errorMessages: Record<string, string> = {
    'auth/invalid-credential': 'Неправильний email або пароль',
    'auth/user-not-found': 'Користувача не знайдено',
    'auth/wrong-password': 'Неправильний пароль',
    'auth/email-already-in-use': 'Цей email вже використовується',
    'auth/weak-password': 'Пароль занадто слабкий',
    'auth/invalid-email': 'Неправильний формат email',
    'auth/operation-not-allowed': 'Операція не дозволена',
    'auth/network-request-failed': 'Немає з\'єднання. Зміни збережуться локально',

    'permission-denied': 'У вас немає прав для цієї операції',
    'not-found': 'Документ не знайдено',
    'already-exists': 'Документ вже існує',
    'resource-exhausted': 'Перевищено ліміт запитів',
    'unauthenticated': 'Необхідна авторизація',
    'unavailable': 'Сервіс тимчасово недоступний. Зміни збережуться локально',
    'deadline-exceeded': 'Перевищено час очікування. Перевірте з\'єднання',
    'cancelled': 'Операцію скасовано',
    'data-loss': 'Втрата даних',
    'failed-precondition': 'Не виконано умову для операції',

    'network-request-failed': 'Немає з\'єднання. Зміни збережуться локально',
  };

  return errorMessages[error.code] || 'Невідома помилка Firebase';
};

export const handleError = (
  error: unknown,
  options: ErrorHandlerOptions = {}
): string => {
  const { showAlert = true, logToConsole = true, customMessage } = options;

  let message = customMessage || 'Сталася помилка';

  if (error instanceof FirebaseError) {
    message = getFirebaseErrorMessage(error);
  } else if (error instanceof Error) {
    message = error.message;
  } else if (typeof error === 'string') {
    message = error;
  }

  if (logToConsole) {
    console.error('[Error Handler]:', error);
  }

  if (showAlert) {
    Alert.alert('Помилка', message);
  }

  return message;
};

export const handleAsyncError = async <T>(
  operation: () => Promise<T>,
  options: ErrorHandlerOptions = {}
): Promise<T | null> => {
  try {
    return await operation();
  } catch (error) {
    handleError(error, options);
    return null;
  }
};
