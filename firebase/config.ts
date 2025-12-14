import { initializeApp, getApp, getApps } from 'firebase/app';
import {
    initializeAuth,
    browserLocalPersistence,
    getAuth,
    getReactNativePersistence,
} from 'firebase/auth';
import {
    initializeFirestore,
    persistentLocalCache,
    CACHE_SIZE_UNLIMITED,
    getFirestore,
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
    measurementId: process.env.EXPO_PUBLIC_MEASUREMENT_ID
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

let auth;
try {
    if (Platform.OS === 'web') {
        auth = initializeAuth(app, {
            persistence: browserLocalPersistence
        });
    } else {
        auth = initializeAuth(app, {
            persistence: getReactNativePersistence(AsyncStorage)
        });
    }
} catch (error: any) {
    if (error.code === 'auth/already-initialized') {
        auth = getAuth(app);
    } else {
        throw error;
    }
}

let db;
try {
    db = initializeFirestore(app, {
        localCache: persistentLocalCache({
            cacheSizeBytes: CACHE_SIZE_UNLIMITED,
        }),
    });
} catch (error: any) {
    if (error.message?.includes('already been called')) {
        db = getFirestore(app);
    } else {
        db = getFirestore(app);
    }
}

const storage = getStorage(app);

export { auth, db, storage };
