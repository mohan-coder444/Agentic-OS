import { createSlice } from "@reduxjs/toolkit";

const chatSlice = createSlice({
  name: "chat",
  initialState: {
    conversations: [],
    activeId: null,
    messages: {}, // { [conversationId]: [{_id, role, content}] }
    loading: false,
    // Which sidebar section is active. "chats" shows conversation list + chat UI.
    // "build" shows the IDE-style website builder view.
    view: "chats",
  },
  reducers: {
    setConversations: (state, action) => {
      state.conversations = action.payload;
    },
    setActiveId: (state, action) => {
      state.activeId = action.payload;
    },
    setMessages: (state, action) => {
      const { conversationId, messages } = action.payload;
      state.messages[conversationId] = messages;
    },
    addConversation: (state, action) => {
      state.conversations.unshift(action.payload);
      state.activeId = action.payload._id;
    },
    addMessages: (state, action) => {
      const { conversationId, userMsg, assistantMsg } = action.payload;
      if (!state.messages[conversationId]) state.messages[conversationId] = [];
      state.messages[conversationId].push(userMsg, assistantMsg);
    },
    updateConversationTitle: (state, action) => {
      const { id, title } = action.payload;
      const conv = state.conversations.find((c) => c._id === id);
      if (conv) conv.title = title;
    },
    // Remove a conversation from the list. Two edge cases:
    //   1. The deleted conversation was active — clear activeId so the UI
    //      renders the empty state instead of a dead ID that fetches 404s.
    //   2. Its cached messages linger in state.messages — drop them so a
    //      later conversation with a reused id (unlikely, but ObjectIds
    //      have collision cases) can't leak old messages.
    removeConversation: (state, action) => {
      const id = action.payload;
      state.conversations = state.conversations.filter((c) => c._id !== id);
      if (state.activeId === id) state.activeId = null;
      delete state.messages[id];
    },
    setView: (state, action) => {
      state.view = action.payload;
    },
  },
});

export const { setConversations, setActiveId, setMessages, addConversation, addMessages, updateConversationTitle, removeConversation, setView } =
  chatSlice.actions;
export default chatSlice.reducer;
