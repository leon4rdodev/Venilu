
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useUser } from './use-user';

// Define the structure of the shift object
interface Shift {
  id: number;
  user_id: number;
  start_time: string;
  end_time?: string;
  initial_cash: number;
  final_cash?: number;
  expected_cash?: number;
  difference?: number;
  status: 'OPEN' | 'CLOSED';
}

// Define the structure for a sale within a shift context
interface ShiftSale {
  total_amount: number;
  payment_method: string;
}

// Define the context value's structure
interface ShiftContextType {
  activeShift: Shift | null;
  shiftSales: ShiftSale[];
  isLoading: boolean;
  openShift: (initialCash: number) => Promise<any>;
  closeShift: (finalCash: number) => Promise<any>;
  addSaleToShift: (sale: ShiftSale) => void;
  fetchActiveShift: () => Promise<void>;
}

// Create the context
const ShiftContext = createContext<ShiftContextType | undefined>(undefined);

// Define the props for the provider
interface ShiftProviderProps {
  children: ReactNode;
}

export const ShiftProvider: React.FC<ShiftProviderProps> = ({ children }) => {
  const { user } = useUser();
  const [activeShift, setActiveShift] = useState<Shift | null>(null);
  const [shiftSales, setShiftSales] = useState<ShiftSale[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchActiveShift = async () => {
    if (!user) {
      setActiveShift(null);
      setShiftSales([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const result = await window.ipcRenderer.invoke('shifts:getActive', { userId: user.id });
      if (result.success && result.shift) {
        setActiveShift(result.shift);
        // Fetch sales for the active shift
        const salesResult = await window.ipcRenderer.invoke('shifts:getSales', { shiftId: result.shift.id });
        if (salesResult.success) {
          setShiftSales(salesResult.sales);
        }
      } else {
        setActiveShift(null);
        setShiftSales([]);
      }
    } catch (error) {
      console.error('Error fetching active shift:', error);
      setActiveShift(null);
      setShiftSales([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchActiveShift();
  }, [user]);

  const openShift = async (initialCash: number) => {
    if (!user) {
      return { success: false, message: 'No user logged in.' };
    }
    const result = await window.ipcRenderer.invoke('shifts:open', { initialCash, user });
    if (result.success && result.shift) {
      setActiveShift(result.shift);
      setShiftSales([]); // Reset sales for the new shift
    }
    return result;
  };

  const closeShift = async (finalCash: number) => {
    if (!activeShift) {
      return { success: false, message: 'No active shift to close.' };
    }
    const result = await window.ipcRenderer.invoke('shifts:close', { shiftId: activeShift.id, finalCash });
    if (result.success) {
      setActiveShift(null); // Clear the shift state
      setShiftSales([]);
    }
    return result;
  };

  const addSaleToShift = (sale: ShiftSale) => {
    setShiftSales(prevSales => [...prevSales, sale]);
  };

  return (
    <ShiftContext.Provider value={{ activeShift, shiftSales, isLoading, openShift, closeShift, addSaleToShift, fetchActiveShift }}>
      {children}
    </ShiftContext.Provider>
  );
};

// Custom hook to use the shift context
export const useShift = () => {
  const context = useContext(ShiftContext);
  if (context === undefined) {
    throw new Error('useShift must be used within a ShiftProvider');
  }
  return context;
};
