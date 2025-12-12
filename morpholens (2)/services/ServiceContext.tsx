
import React, { createContext, useContext, ReactNode } from 'react';
import { db } from '../lib/db';
import { pyodideService } from './pyodideService';
import { ai } from './gemini/client';

interface ServiceContextType {
    db: typeof db;
    python: typeof pyodideService;
    ai: typeof ai;
}

const ServiceContext = createContext<ServiceContextType | null>(null);

export const ServiceProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    return (
        <ServiceContext.Provider value={{ db, python: pyodideService, ai }}>
            {children}
        </ServiceContext.Provider>
    );
};

export const useServices = () => {
    const ctx = useContext(ServiceContext);
    if (!ctx) throw new Error("useServices must be used within ServiceProvider");
    return ctx;
};
