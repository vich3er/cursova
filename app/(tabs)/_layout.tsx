import { Tabs } from 'expo-router';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from "@/constants";
import BottomNavigationBar from '@/components/BottomNavigationBar';

export default function TabsLayout() {
    return (
        <View style={{ flex: 1 }}>
            <Tabs
                screenOptions={{
                    tabBarActiveTintColor: COLORS.PRIMARY,
                    tabBarInactiveTintColor: COLORS.BORDER_DEFAULT,
                }}
            >
                <Tabs.Screen
                    name="lists"
                    options={{
                        title: 'Мої групи',
                        headerShown: false,
                        tabBarIcon: ({ color, size }) => (
                            <Ionicons name="list-outline" size={size} color={color} />
                        ),
                    }}
                />

                <Tabs.Screen
                    name="profile"
                    options={{
                        title: 'Профіль',
                        tabBarIcon: ({ color, size }) => (
                            <Ionicons name="person-circle-outline" size={size} color={color} />
                        ),
                    }}
                />
            </Tabs>
            <BottomNavigationBar />
        </View>
    );
}