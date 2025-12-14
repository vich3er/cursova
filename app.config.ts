import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => {
    return {
        name: "ShoppingList",
        slug: "ShoppingList",
        version: "1.0.0",
        orientation: "portrait",
        icon: "./assets/images/icon.png",
        scheme: "shoppinglist",
        userInterfaceStyle: "automatic",
        newArchEnabled: true,
        ios: {
            supportsTablet: true
        },
        android: {
            adaptiveIcon: {
                backgroundColor: "#E6F4FE",
                foregroundImage: "./assets/images/android-icon-foreground.png",
                backgroundImage: "./assets/images/android-icon-background.png",
                monochromeImage: "./assets/images/android-icon-monochrome.png"
            },
            edgeToEdgeEnabled: true,
            predictiveBackGestureEnabled: false,
            softwareKeyboardLayoutMode: "resize",
            permissions: [
                "android.permission.RECORD_AUDIO"
            ],
            package: "com.vicher.ShoppingList",
            googleServicesFile: "./google-services.json"
        },
        web: {
            output: "single",
            favicon: "./assets/images/favicon.png",
            bundler: "metro"
        },
        plugins: [
            "expo-router",
            [
                "expo-splash-screen",
                {
                    "image": "./assets/images/splash-icon.png",
                    "imageWidth": 200,
                    "resizeMode": "contain",
                    "backgroundColor": "#ffffff",
                    "dark": {
                        "backgroundColor": "#000000"
                    }
                }
            ],
            [
                "expo-image-picker",
                {
                    "photosPermission": "Додаток потребує доступу до ваших фото, щоб додавати зображення до товарів у списку покупок.",
                    "cameraPermission": "Додаток потребує доступу до камери, щоб робити фото товарів у списку покупок."
                }
            ]
        ],
        experiments: {
            typedRoutes: true,
            reactCompiler: true
        },
        extra: {
            router: {},
            eas: {
                projectId: "d01d5bc5-fa38-4ce1-9086-fa8ce2ed976c"
            },
            firebaseApiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
            firebaseAuthDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
            firebaseProjectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
            firebaseStorageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
            firebaseMessagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
            firebaseAppId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
            firebaseMeasurementId: process.env.EXPO_PUBLIC_MEASUREMENT_ID,
        }
    };
};