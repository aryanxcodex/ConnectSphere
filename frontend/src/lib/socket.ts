// src/lib/socket.ts

import { io, Socket } from "socket.io-client";

const URL = "http://localhost:3000";

export const socket: Socket = io(URL, {
  autoConnect: false, 
  withCredentials: true,
});

socket.on("connect", () => {
  console.log("✅ Socket.IO connected:", socket.id);
});

socket.on("connect_error", (err) => {
  console.error("❌ Socket.IO connection error:", err.message);
});
