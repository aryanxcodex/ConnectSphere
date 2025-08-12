import {
  Router,
  WebRtcTransport,
  Producer,
  Consumer,
} from "mediasoup/node/lib/types";
import { getMediasoupRouter } from "./mediasoup";

interface Peer {
  id: string;
  transports: Map<string, WebRtcTransport>;
  producers: Producer[];
  consumers: Consumer[];
  socket: any;
}

class Room {
  id: string;
  peers: Map<string, Peer> = new Map();
  router: Router;

  constructor(id: string) {
    this.id = id;
    this.router = getMediasoupRouter();
  }

  addPeer(peerId: string, socket: any) {
    this.peers.set(peerId, {
      id: peerId,
      transports: new Map(),
      producers: [],
      consumers: [],
      socket,
    });
  }

  removePeer(peerId: string) {
    const peer = this.peers.get(peerId);
    if (!peer) return;

    peer.producers.forEach((producer) => {
      this.getPeersExcept(peerId).forEach((otherPeer) => {
        // This emits an event to the client-side
        otherPeer.socket.emit("producer-closed", { producerId: producer.id });
      });
    });

    // This correctly iterates over the Map's values
    peer.transports.forEach((t) => t.close());
    peer.producers.forEach((p) => p.close());
    peer.consumers.forEach((c) => c.close());

    this.peers.delete(peerId);
  }

  getPeer(peerId: string): Peer | undefined {
    return this.peers.get(peerId);
  }

  getPeers(): Peer[] {
    return Array.from(this.peers.values());
  }

  getPeersExcept(socketId: string) {
    return Array.from(this.peers.values()).filter(
      (peer) => peer.id !== socketId
    );
  }
}

export const rooms: Map<string, Room> = new Map();

export function getOrCreateRoom(roomId: string): Room {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, new Room(roomId));
    console.log(`🏠 Room created: ${roomId}`);
  }
  return rooms.get(roomId)!;
}

export function removeRoom(roomId: string) {
  rooms.delete(roomId);
}
