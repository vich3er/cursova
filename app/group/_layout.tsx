import { Stack, useRouter } from 'expo-router';
import { Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants';

export default function GroupLayout() {
    const router = useRouter();

    return (
        <Stack>
            <Stack.Screen
                name="[groupId]"
                options={{
                    headerShown: true,
                    title: 'Завантаження...',
                    headerLeft: () => (
                        <Pressable
                            onPress={() => router.back()}
                            style={{ padding: 8, marginRight: 8 }}
                            accessibilityLabel="Назад"
                            accessibilityRole="button"
                        >
                            <Ionicons name="arrow-back" size={24} color={COLORS.TEXT_PRIMARY} />
                        </Pressable>
                    ),
                }}
            />
        </Stack>
    );
}