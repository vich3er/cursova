import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface PendingOperation {
    id: string;
    type: 'message' | 'list' | 'item' | 'group' | 'other';
    description: string;
    timestamp: number;
}

interface SyncContextType {
    pendingOperations: Map<string, PendingOperation>;
    addPendingOperation: (id: string, type: PendingOperation['type'], description: string) => void;
    removePendingOperation: (id: string) => void;
    hasPendingOperations: boolean;
    getPendingCount: () => number;
}

const SyncContext = createContext<SyncContextType | undefined>(undefined);

export function SyncProvider({ children }: { children: ReactNode }) {
    const [pendingOperations, setPendingOperations] = useState<Map<string, PendingOperation>>(new Map());

    const addPendingOperation = useCallback((
        id: string,
        type: PendingOperation['type'],
        description: string
    ) => {
        setPendingOperations(prev => {
            const newMap = new Map(prev);
            newMap.set(id, {
                id,
                type,
                description,
                timestamp: Date.now(),
            });
            return newMap;
        });
    }, []);

    const removePendingOperation = useCallback((id: string) => {
        setPendingOperations(prev => {
            const newMap = new Map(prev);
            newMap.delete(id);
            return newMap;
        });
    }, []);

    const hasPendingOperations = pendingOperations.size > 0;

    const getPendingCount = useCallback(() => {
        return pendingOperations.size;
    }, [pendingOperations]);

    return (
        <SyncContext.Provider
            value={{
                pendingOperations,
                addPendingOperation,
                removePendingOperation,
                hasPendingOperations,
                getPendingCount,
            }}
        >
            {children}
        </SyncContext.Provider>
    );
}

export function useSync() {
    const context = useContext(SyncContext);
    if (!context) {
        throw new Error('useSync must be used within SyncProvider');
    }
    return context;
}
