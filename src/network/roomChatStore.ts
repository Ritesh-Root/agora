import { create } from 'zustand';
import { RoomChatMessage } from '../../shared/protocol';

interface RoomChatState {
  messages: RoomChatMessage[];
  setHistory: (messages: RoomChatMessage[]) => void;
  add: (message: RoomChatMessage) => void;
  reset: () => void;
}

export const useRoomChatStore = create<RoomChatState>()((set) => ({
  messages: [],
  setHistory: (messages) => set({ messages }),
  add: (message) => set((state) => (
    state.messages.some((existing) => existing.id === message.id)
      ? state
      : { messages: [...state.messages, message] }
  )),
  reset: () => set({ messages: [] }),
}));
