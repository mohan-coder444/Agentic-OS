import { configureStore } from "@reduxjs/toolkit";
import userReducer from "./slices/userSlice";
import chatReducer from "./slices/chatSlice";
import builderReducer from "./slices/builderSlice";

export const store = configureStore({
  reducer: {
    user: userReducer,
    chat: chatReducer,
    builder: builderReducer,
  },
});
