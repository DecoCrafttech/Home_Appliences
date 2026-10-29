import { create } from "zustand";
export const usePreferences = create<{
  pin: string;
  setPin: (pin: string) => void;
}>((set) => ({ pin: "", setPin: (pin) => set({ pin }) }));
