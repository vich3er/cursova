import { COLLECTIONS, VALIDATION } from '@/constants';
import { db } from '@/firebase/config';
import { collection, getDocs, query, where } from 'firebase/firestore';

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

export const validateEmail = (email: string): ValidationResult => {
  const trimmed = email.trim();
  if (!trimmed) {
    return { isValid: false, error: 'Email не може бути порожнім' };
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmed)) {
    return { isValid: false, error: 'Неправильний формат email' };
  }
  return { isValid: true };
};

export const validatePassword = (password: string): ValidationResult => {
  if (!password) {
    return { isValid: false, error: 'Пароль не може бути порожнім' };
  }
  if (password.length < VALIDATION.MIN_PASSWORD_LENGTH) {
    return {
      isValid: false,
      error: `Пароль повинен містити мінімум ${VALIDATION.MIN_PASSWORD_LENGTH} символів`,
    };
  }
  return { isValid: true };
};

export const validateName = (
  name: string,
  fieldName: string = 'Назва'
): ValidationResult => {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length < VALIDATION.MIN_NAME_LENGTH) {
    return { isValid: false, error: `${fieldName} не може бути порожньою` };
  }
  if (trimmed.length > VALIDATION.MAX_NAME_LENGTH) {
    return {
      isValid: false,
      error: `${fieldName} занадто довга (максимум ${VALIDATION.MAX_NAME_LENGTH} символів)`,
    };
  }
  return { isValid: true };
};

export const validateItemName = (name: string): ValidationResult => {
  const trimmed = name.trim();
  if (!trimmed) {
    return { isValid: false, error: 'Назва товару не може бути порожньою' };
  }
  if (trimmed.length > VALIDATION.MAX_ITEM_NAME_LENGTH) {
    return {
      isValid: false,
      error: `Назва занадто довга (максимум ${VALIDATION.MAX_ITEM_NAME_LENGTH} символів)`,
    };
  }
  return { isValid: true };
};

export const validateMessage = (message: string): ValidationResult => {
  const trimmed = message.trim();
  if (!trimmed) {
    return { isValid: false, error: 'Повідомлення не може бути порожнім' };
  }
  if (trimmed.length > VALIDATION.MAX_MESSAGE_LENGTH) {
    return {
      isValid: false,
      error: `Повідомлення занадто довге (максимум ${VALIDATION.MAX_MESSAGE_LENGTH} символів)`,
    };
  }
  return { isValid: true };
};

export const sanitizeInput = (input: string): string => {
  return input.trim().replace(/\s+/g, ' ');
};

export const validateUsername = (username: string): ValidationResult => {
  const trimmed = username.trim();

  if (!trimmed) {
    return { isValid: false, error: 'Нікнейм не може бути порожнім' };
  }

  if (trimmed.length < 3) {
    return { isValid: false, error: 'Нікнейм повинен містити мінімум 3 символи' };
  }

  if (trimmed.length > 20) {
    return { isValid: false, error: 'Нікнейм занадто довгий (максимум 20 символів)' };
  }

  const usernameRegex = /^[a-zA-Z0-9_-]+$/;
  if (!usernameRegex.test(trimmed)) {
    return { isValid: false, error: 'Нікнейм може містити тільки літери, цифри, _ і -' };
  }

  return { isValid: true };
};

export const checkUsernameExists = async (username: string, excludeUid?: string): Promise<boolean> => {
  try {
    const trimmed = username.trim().toLowerCase();
    const usersQuery = query(
      collection(db, COLLECTIONS.USERS),
      where('displayName', '==', trimmed)
    );

    const snapshot = await getDocs(usersQuery);

    if (excludeUid) {
      return snapshot.docs.some(doc => doc.id !== excludeUid);
    }

    return !snapshot.empty;
  } catch (error) {
    console.error('Error checking username existence:', error);
    return false;
  }
};
