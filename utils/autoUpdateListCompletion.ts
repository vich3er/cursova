import { COLLECTIONS } from '@/constants';
import { db } from '@/firebase/config';
import { notifyListCompleted } from '@/utils/notifications';
import { collection, doc, getDoc, getDocs, query, updateDoc, where } from 'firebase/firestore';

export async function autoUpdateListCompletion(listId: string, completedByUserId?: string): Promise<void> {
    const itemsQuery = query(
        collection(db, COLLECTIONS.ITEMS),
        where('shoppingListId', '==', listId)
    );

    const snapshot = await getDocs(itemsQuery);

    if (snapshot.empty) {
        await updateDoc(doc(db, COLLECTIONS.SHOPPING_LISTS, listId), {
            isComplete: false,
        });
        return;
    }

    let allDone = true;

    snapshot.forEach(docSnap => {
        const item = docSnap.data();
        if (!item.isDone) {
            allDone = false;
        }
    });

    const listRef = doc(db, COLLECTIONS.SHOPPING_LISTS, listId);
    const listSnap = await getDoc(listRef);
    const wasComplete = listSnap.exists() ? listSnap.data()?.isComplete : false;

    await updateDoc(listRef, {
        isComplete: allDone,
    });

    if (allDone && !wasComplete && completedByUserId && listSnap.exists()) {
        const listData = listSnap.data();
        const listName = listData?.name || 'Список';
        const groupId = listData?.groupId;

        if (groupId) {
            notifyListCompleted(groupId, listName, completedByUserId).catch(err => {
                console.error('Failed to send list completed notification:', err);
            });
        }
    }
}
