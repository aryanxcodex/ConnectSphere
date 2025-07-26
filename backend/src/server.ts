import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createMediasoupWorker } from "./mediasoup";
import { getOrCreateRoom } from "./roomManager";
import { createWebRtcTransport } from "./mediasoup";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*" },
});

const PORT = 3000;

async function main() {
  await createMediasoupWorker();

  io.on("connection", (socket) => {
    console.log("⚡ New client:", socket.id);

    socket.on("join-room", ({ roomId }, cb) => {
      const room = getOrCreateRoom(roomId);
      room.addPeer(socket.id, socket);

      console.log(`👤 Peer ${socket.id} joined room ${roomId}`);
      cb({ joined: true, routerRtpCapabilities: room.router.rtpCapabilities });
    });

    socket.on("disconnect", () => {
      for (const room of io.sockets.adapter.rooms) {
        if (room[1].has(socket.id)) {
          const roomId = room[0];
          const r = getOrCreateRoom(roomId);
          r.removePeer(socket.id);
          console.log(`❌ Peer ${socket.id} left room ${roomId}`);
        }
      }
    });

    socket.on("create-transport", async ({ roomId }, cb) => {
      const room = getOrCreateRoom(roomId);
      const peer = room.getPeer(socket.id);
      if (!peer) return cb({ error: "Peer not found" });

      const { transport, params } = await createWebRtcTransport(room.router);
      peer.transports.push(transport);

      cb(params);

      // Handle DTLS connection from client
      socket.on(
        "connect-transport",
        async ({ transportId, dtlsParameters }, ack) => {
          const t = peer.transports.find((t) => t.id === transportId);
          if (!t) return ack({ error: "Transport not found" });

          await t.connect({ dtlsParameters });
          ack({ connected: true });
        }
      );
    });

    socket.on(
      "produce",
      async ({ roomId, transportId, kind, rtpParameters }, cb) => {
        const room = getOrCreateRoom(roomId);
        const peer = room.getPeer(socket.id);
        if (!peer) return cb({ error: "Peer not found" });

        const transport = peer.transports.find((t) => t.id === transportId);
        if (!transport) return cb({ error: "Transport not found" });

        const producer = await transport.produce({
          kind,
          rtpParameters,
        });

        peer.producers.push(producer);

        console.log(`🎙️ Producer created: ${producer.id} (${kind})`);

        // ✅ Notify all other peers in the room
        for (const otherPeer of room.getPeersExcept(socket.id)) {
          io.to(otherPeer.id).emit("new-producer", {
            producerId: producer.id,
            kind,
            socketId: socket.id, // needed to track who it's from
          });
        }

        cb({ id: producer.id });
      }
    );

    socket.on(
      "consume",
      async ({ roomId, transportId, producerId, rtpCapabilities }, cb) => {
        const room = getOrCreateRoom(roomId);
        const peer = room.getPeer(socket.id);
        if (!peer) return cb({ error: "Peer not found" });

        if (
          !room.router.canConsume({
            producerId,
            rtpCapabilities,
          })
        ) {
          return cb({ error: "Cannot consume" });
        }

        const transport = peer.transports.find((t) => t.id === transportId);
        if (!transport) return cb({ error: "Transport not found" });

        try {
          const consumer = await transport.consume({
            producerId,
            rtpCapabilities,
            paused: true, // initially paused — client will resume it later
          });

          peer.consumers.push(consumer);

          // Optional: handle transport/producer close
          consumer.on(
            "transportclose",
            () =>
              (peer.consumers = peer.consumers.filter(
                (c) => c.id !== consumer.id
              ))
          );
          consumer.on(
            "producerclose",
            () =>
              (peer.consumers = peer.consumers.filter(
                (c) => c.id !== consumer.id
              ))
          );

          cb({
            id: consumer.id,
            producerId,
            kind: consumer.kind,
            rtpParameters: consumer.rtpParameters,
          });
        } catch (err) {
          console.error("consume error", err);
          if (err instanceof Error) {
            cb({ error: err.message });
          } else {
            cb({ error: "Unknown error occurred" });
          }
        }
      }
    );
  });

  httpServer.listen(PORT, () => {
    console.log(`✅ SFU server running on http://localhost:${PORT}`);
  });
}

main();
