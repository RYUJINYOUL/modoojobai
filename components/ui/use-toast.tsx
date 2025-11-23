'use client';

import { create } from 'zustand';

interface ToastStore {
  title?: string;
  description?: string;
  duration?: number;
  isOpen: boolean;
  showToast: (props: { title?: string; description?: string; duration?: number }) => void;
  hideToast: () => void;
}

export const useToast = create<ToastStore>((set) => ({
  isOpen: false,
  showToast: ({ title, description, duration = 3000 }) => {
    set({ title, description, duration, isOpen: true });
    setTimeout(() => {
      set({ isOpen: false });
    }, duration);
  },
  hideToast: () => set({ isOpen: false }),
}));

export function Toast() {
  const { isOpen, title, description, hideToast } = useToast();

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className="bg-black text-white rounded-lg shadow-lg p-4 min-w-[200px] max-w-[300px]">
        {title && <h4 className="font-semibold mb-1">{title}</h4>}
        {description && <p className="text-sm text-gray-200">{description}</p>}
      </div>
    </div>
  );
} 