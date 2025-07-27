import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createMediasoupWorker } from "./mediasoup";
import { getOrCreateRoom, rooms } from "./roomManager";
import { createWebRtcTransport } from "./mediasoup";
import cors from "cors";

const app = express();
app.use(cors({ origin: "http://localhost:5173", credentials: true }));

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

const PORT = 3000;

async function main() {
  await createMediasoupWorker();

  io.on("connection", (socket) => {
    console.log(`⚡ New client connected: ${socket.id}`);

    // ✅ MODIFIED: This handler now informs the new peer about existing producers.
    socket.on("join-room", ({ roomId }, cb) => {
      socket.data.roomId = roomId;
      const room = getOrCreateRoom(roomId);

      // Get a list of all producer IDs from other peers in the room
      const existingProducerIds = room
        .getPeersExcept(socket.id)
        .flatMap((peer) => peer.producers.map((p) => p.id));

      console.log(
        `Informing peer ${socket.id} about ${existingProducerIds.length} existing producers.`
      );

      // Now, add the new peer to the room
      room.addPeer(socket.id, socket);
      console.log(`👤 Peer ${socket.id} joined room ${roomId}`);

      // Send router capabilities and existing producer IDs back to the client
      cb({
        routerRtpCapabilities: room.router.rtpCapabilities,
        existingProducerIds,
      });
    });

    socket.on("disconnect", () => {
      const { roomId } = socket.data;
      if (!roomId) return;
      const room = rooms.get(roomId);
      if (!room) return;
      console.log(`❌ Peer ${socket.id} left room ${roomId}`);
      room.removePeer(socket.id);
      if (room.getPeers().length === 0) {
        rooms.delete(roomId);
        console.log(`🧹 Room ${roomId} is empty and has been removed.`);
      }
    });

    socket.on("create-transport", async ({ roomId, direction }, cb) => {
      try {
        const room = getOrCreateRoom(roomId);
        const peer = room.getPeer(socket.id);
        if (!peer) throw new Error("Peer not found");
        const { transport, params } = await createWebRtcTransport(room.router);
        peer.transports.set(transport.id, transport);
        console.log(
          `➡️ Transport created for peer ${socket.id} (direction: ${direction})`
        );
        cb(params);
      } catch (err) {
        console.error("create-transport error", err);
        cb({ error: (err as Error).message });
      }
    });

    socket.on(
      "connect-transport",
      async ({ roomId, transportId, dtlsParameters }, cb) => {
        const room = getOrCreateRoom(roomId);
        const peer = room.getPeer(socket.id);
        if (!peer) return cb({ error: "Peer not found" });
        const transport = peer.transports.get(transportId);
        if (!transport) return cb({ error: "Transport not found" });
        await transport.connect({ dtlsParameters });
        cb({ connected: true });
      }
    );

    socket.on(
      "produce",
      async ({ roomId, transportId, kind, rtpParameters }, cb) => {
        const room = getOrCreateRoom(roomId);
        const peer = room.getPeer(socket.id);
        if (!peer) return cb({ error: "Peer not found" });
        const transport = peer.transports.get(transportId);
        if (!transport) return cb({ error: "Transport not found" });
        const producer = await transport.produce({ kind, rtpParameters });
        peer.producers.push(producer);
        console.log(
          `🎙️ Producer created: ${producer.id} (${kind}) by peer ${socket.id}`
        );
        room.getPeersExcept(socket.id).forEach((otherPeer) => {
          io.to(otherPeer.socket.id).emit("new-producer", {
            producerId: producer.id,
            socketId: socket.id,
          });
        });
        cb({ id: producer.id });
      }
    );

    socket.on(
      "consume",
      async ({ roomId, transportId, producerId, rtpCapabilities }, cb) => {
        const room = getOrCreateRoom(roomId);
        const peer = room.getPeer(socket.id);
        if (!peer) return cb({ error: "Peer not found" });
        if (!room.router.canConsume({ producerId, rtpCapabilities })) {
          return cb({ error: "Cannot consume" });
        }
        const transport = peer.transports.get(transportId);
        if (!transport) return cb({ error: "Transport not found" });
        try {
          const consumer = await transport.consume({
            producerId,
            rtpCapabilities,
            paused: true,
          });
          peer.consumers.push(consumer);
          consumer.on("transportclose", () => {
            peer.consumers = peer.consumers.filter((c) => c.id !== consumer.id);
          });
          consumer.on("producerclose", () => {
            peer.consumers = peer.consumers.filter((c) => c.id !== consumer.id);
          });
          cb({
            id: consumer.id,
            producerId,
            kind: consumer.kind,
            rtpParameters: consumer.rtpParameters,
          });
        } catch (err) {
          console.error("consume error", err);
          cb({ error: (err as Error).message });
        }
      }
    );

    socket.on("resume-consumer", async ({ roomId, consumerId }) => {
      const room = getOrCreateRoom(roomId);
      const peer = room.getPeer(socket.id);
      if (!peer) return console.error("Peer not found while resuming consumer");

      const consumer = peer.consumers.find((c) => c.id === consumerId);
      if (!consumer) return console.error("Consumer not found while resuming");

      await consumer.resume();
      console.log(`▶️ Resumed consumer ${consumer.id}`);
    });
  });

  httpServer.listen(PORT, () => {
    console.log(`✅ SFU server running on http://localhost:${PORT}`);
  });
}

main();
