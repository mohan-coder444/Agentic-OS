import { createSlice } from "@reduxjs/toolkit";

const chatSlice = createSlice({
  name: "chat",
  initialState: {
    conversations: [],
    activeId: null,
    messages: {}, // { [conversationId]: [{_id, role, content}] }
    loading: false,
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
  },
});

export const { setConversations, setActiveId, setMessages, addConversation, addMessages, updateConversationTitle } =
  chatSlice.actions;
export default chatSlice.reducer;
