import { io, Socket } from "socket.io-client";

const URL = "http://localhost:3000"; // or wherever your backend runs

export const socket: Socket = io(URL, {
  transports: ["websocket"],
});