
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useUser } from '@renderer/features/auth';
import { Shift, Sale as SharedSale, DebtPayment } from '@shared/types/models';
import { IPCResponse } from '@shared/types/ipc';

// Define the structure for a sale within a shift context (simplified shared sale)
type ShiftSale = Pick<SharedSale, 'total_amount' | 'payment_method'>;

// Define the context value's structure
interface ShiftContextType {
  activeShift: Shift | null;
  shiftSales: ShiftSale[];
  shiftDebtPayments: DebtPayment[];
  isLoading: boolean;
  openShift: (initialCash: number) => Promise<IPCResponse<Shift>>;
  closeShift: (finalCash: number) => Promise<IPCResponse<Shift>>;
  addSaleToShift: (sale: ShiftSale) => void;
  addDebtPaymentToShift: (payment: DebtPayment) => void;
  fetchActiveShift: () => Promise<void>;
}

// Create the context
const ShiftContext = createContext<ShiftContextType | undefined>(undefined);

// Define the props for the provider
interface ShiftProviderProps {
  children: ReactNode;
}

export const ShiftProvider: React.FC<ShiftProviderProps> = ({ children }) => {
  const { user, sessionReady } = useUser();
  const [activeShift, setActiveShift] = useState<Shift | null>(null);
  const [shiftSales, setShiftSales] = useState<ShiftSale[]>([]);
  const [shiftDebtPayments, setShiftDebtPayments] = useState<DebtPayment[]>([]);
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
      const result = await window.ipcRenderer.invoke('shifts:getActive', { userId: user.id }) as IPCResponse<Shift>;
      if (result.success && result.data) {
        setActiveShift(result.data);
        // Fetch sales for the active shift
        const salesResult = await window.ipcRenderer.invoke('shifts:getSales', { shiftId: result.data.id }) as IPCResponse<ShiftSale[]>;
        if (salesResult.success && salesResult.data) {
          setShiftSales(salesResult.data);
        }
        // Fetch debt payments for the active shift
        const dpResult = await window.ipcRenderer.invoke('shifts:getDebtPayments', { shiftId: result.data.id }) as IPCResponse<DebtPayment[]>;
        if (dpResult.success && dpResult.data) {
          setShiftDebtPayments(dpResult.data);
        }
      } else {
        setActiveShift(null);
        setShiftSales([]);
        setShiftDebtPayments([]);
      }
    } catch (error) {
      console.error('Error fetching active shift:', error);
      setActiveShift(null);
      setShiftSales([]);
      setShiftDebtPayments([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!sessionReady) return; // Wait until backend session is confirmed
    fetchActiveShift();
  }, [user, sessionReady]);

  const openShift = async (initialCash: number) => {
    if (!user) {
      return { success: false, message: 'No user logged in.' } as IPCResponse<Shift>;
    }
    const result = await window.ipcRenderer.invoke('shifts:open', { initialCash, user }) as IPCResponse<Shift>;
    if (result.success && result.data) {
      setActiveShift(result.data);
      setShiftSales([]);
      setShiftDebtPayments([]);
    }
    return result;
  };

  const closeShift = async (finalCash: number) => {
    if (!activeShift) {
      return { success: false, message: 'No active shift to close.' } as IPCResponse<Shift>;
    }
    const result = await window.ipcRenderer.invoke('shifts:close', { shiftId: activeShift.id, finalCash }) as IPCResponse<Shift>;
    if (result.success) {
      setActiveShift(null);
      setShiftSales([]);
      setShiftDebtPayments([]);
    }
    return result;
  };

  const addSaleToShift = (sale: ShiftSale) => {
    setShiftSales(prevSales => [...prevSales, sale]);
  };

  const addDebtPaymentToShift = (payment: DebtPayment) => {
    setShiftDebtPayments(prevPayments => [payment, ...prevPayments]);
  };

  return (
    <ShiftContext.Provider value={{ activeShift, shiftSales, shiftDebtPayments, isLoading, openShift, closeShift, addSaleToShift, addDebtPaymentToShift, fetchActiveShift }}>
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
