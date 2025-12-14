import { COLLECTIONS } from '@/constants';
import { db } from '@/firebase/config';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';


export async function updateListTimestamp(listId: string, userId: string): Promise<void> {
    try {
        const listRef = doc(db, COLLECTIONS.SHOPPING_LISTS, listId);
        await updateDoc(listRef, {
            updatedAt: serverTimestamp(),
            lastUpdatedBy: userId,
        });
    } catch (error) {
        console.error('Error updating list timestamp:', error);
    }
}
