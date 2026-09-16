import axios from "axios";

// Base URL is the gateway. withCredentials lets the browser send/receive
// cookies once we add session cookies (Hour 2, part C).
const api = axios.create({
  baseURL: import.meta.env.VITE_SERVER_URL,
  withCredentials: true,
});

export default api;
