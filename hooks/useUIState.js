import { create } from "zustand";

const useUIState = create((set) => ({
  homeCategory: null,
  headerSrc:
    "/",
  setHomeCategory: (value) => set({ homeCategory: value }),
  setHeaderSrc: (src) => set({ headerSrc: src }),
}));

export default useUIState;
