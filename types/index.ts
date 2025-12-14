import { Timestamp } from 'firebase/firestore';

export interface UserProfile {
    uid: string;
    email: string;
    displayName: string | null;
    photoURL?: string | null;
    pushToken?: string | null; 
}

export interface ShoppingGroup {
    id: string; 
    name: string;
    ownerId: string;
    members: string[]; 
    createdAt: Timestamp;
}

export interface ShoppingList {
    id: string; 
    groupId: string; 
    name: string;
    createdAt: Timestamp;
    createdBy: string; 
    isComplete: boolean; 
    updatedAt?: Timestamp; 
    lastUpdatedBy?: string; 
}

export interface ShoppingItem {
    id: string; 
    shoppingListId: string; 
    text: string;
    isDone: boolean;
    addedBy: string; 
    createdAt: Timestamp;
    photoURL?: string | null; 
}

export interface ChatMessage {
    id: string; 
    text: string;
    createdAt: Timestamp;
    userId: string; 
    userName: string; 
    imageUrl?: string | null; 
    imageUrls?: string[] | null; 
}