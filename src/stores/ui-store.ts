import { create } from "zustand";

type UiStore = {
  isSessionExpiredDialogOpen: boolean;
  openSessionExpiredDialog: () => void;
  closeSessionExpiredDialog: () => void;
};

export const useUiStore = create<UiStore>((set) => ({
  isSessionExpiredDialogOpen: false,
  openSessionExpiredDialog: () => set({ isSessionExpiredDialogOpen: true }),
  closeSessionExpiredDialog: () => set({ isSessionExpiredDialogOpen: false }),
}));
