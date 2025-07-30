import { useEffect, useRef, useState } from "react";
import * as mediasoupClient from "mediasoup-client";
import type {
  Device,
  Transport,
  Producer,
  Consumer,
  RtpCapabilities,
  RtpParameters,
} from "mediasoup-client/types";
import { socket } from "../lib/socket";

// ✅ Correct Interfaces
interface RemoteStream {
  id: string; // Consumer ID
  stream: MediaStream;
  socketId: string;
}

interface JoinRoomResponse {
  routerRtpCapabilities: RtpCapabilities;
  existingProducers?: { producerId: string; socketId: string }[];
}

interface ConsumerParams {
  id: string;
  producerId: string;
  kind: "audio" | "video";
  rtpParameters: RtpParameters;
  error?: string;
}

export function useMediasoup(roomId: string, localStream: MediaStream | null) {
  const deviceRef = useRef<Device | null>(null);
  const sendTransportRef = useRef<Transport | null>(null);
  const recvTransportRef = useRef<Transport | null>(null);
  const producersRef = useRef<Producer[]>([]);
  const [remoteStreams, setRemoteStreams] = useState<RemoteStream[]>([]);
  const [isProducing, setIsProducing] = useState(false);

  useEffect(() => {
    socket.connect();

    const initialize = async (routerRtpCapabilities: RtpCapabilities) => {
      const device = new mediasoupClient.Device();
      await device.load({ routerRtpCapabilities });
      deviceRef.current = device;

      const sendTransportParams = await new Promise<any>((resolve) => {
        socket.emit("create-transport", { roomId, direction: "send" }, resolve);
      });
      const sendTransport = device.createSendTransport(sendTransportParams);
      sendTransportRef.current = sendTransport;

      sendTransport.on("connect", ({ dtlsParameters }, callback, errback) => {
        socket.emit(
          "connect-transport",
          { roomId, transportId: sendTransport.id, dtlsParameters },
          (res: { error?: string }) => {
            res.error ? errback(new Error(res.error)) : callback();
          }
        );
      });

      sendTransport.on(
        "produce",
        async ({ kind, rtpParameters, appData }, callback, errback) => {
          try {
            const { id } = await new Promise<{ id: string }>((resolve) => {
              socket.emit(
                "produce",
                {
                  roomId,
                  transportId: sendTransport.id,
                  kind,
                  rtpParameters,
                  appData,
                },
                resolve
              );
            });
            callback({ id });
          } catch (error) {
            errback(error as Error);
          }
        }
      );

      const recvTransportParams = await new Promise<any>((resolve) => {
        socket.emit("create-transport", { roomId, direction: "recv" }, resolve);
      });
      const recvTransport = device.createRecvTransport(recvTransportParams);
      recvTransportRef.current = recvTransport;

      recvTransport.on("connect", ({ dtlsParameters }, callback, errback) => {
        socket.emit(
          "connect-transport",
          { roomId, transportId: recvTransport.id, dtlsParameters },
          (res: { error?: string }) => {
            res.error ? errback(new Error(res.error)) : callback();
          }
        );
      });

      console.log("✅ Device and Transports created");
    };

    socket.on("connect", () => {
      socket.emit("join-room", { roomId }, async (res: JoinRoomResponse) => {
        console.log("✅ Joined room, router capabilities received");

        if (!deviceRef.current?.loaded) {
          await initialize(res.routerRtpCapabilities);
        }

        if (res.existingProducers) {
          console.log(
            `Consuming ${res.existingProducers.length} existing producers...`
          );
          for (const { producerId, socketId } of res.existingProducers) {
            consume(producerId, socketId);
          }
        }
      });
    });

    const handleNewProducer = ({
      producerId,
      socketId,
    }: {
      producerId: string;
      socketId: string;
    }) => {
      console.log(`📥 New producer available from ${socketId}, consuming...`);
      // ✅ FIXED: Pass the socketId to the consume function
      consume(producerId, socketId);
    };

    socket.on("new-producer", handleNewProducer);

    socket.on("producer-closed", ({ producerId }) => {
      setRemoteStreams((prevStreams) =>
        prevStreams.filter((rs) => rs.id !== producerId)
      );
    });

    return () => {
      console.log("Running cleanup for useMediasoup");
      socket.off("new-producer", handleNewProducer);
      socket.off("producer-closed");
      sendTransportRef.current?.close();
      recvTransportRef.current?.close();
      socket.disconnect();
    };
  }, [roomId]);

  const produce = async () => {
    if (isProducing || !localStream || !sendTransportRef.current) {
      console.warn(
        "Cannot produce: already producing or stream/transport not ready"
      );
      return;
    }

    console.log("🎤 Starting to produce local media...");
    setIsProducing(true);

    for (const track of localStream.getTracks()) {
      const producer = await sendTransportRef.current.produce({ track });
      producersRef.current.push(producer);
    }
    console.log("✅ Local media produced");
  };

  // ✅ FIXED: Update consume to accept socketId
  const consume = async (producerId: string, socketId: string) => {
    // Prevent consuming our own producer
    if (socketId === socket.id) {
      return;
    }

    const device = deviceRef.current;
    const recvTransport = recvTransportRef.current;
    if (!device || !recvTransport) {
      console.error("Cannot consume: device or transport not ready");
      return;
    }

    const { rtpCapabilities } = device;
    const params = await new Promise<ConsumerParams>((resolve) => {
      socket.emit(
        "consume",
        { roomId, producerId, rtpCapabilities, transportId: recvTransport.id },
        resolve
      );
    });

    if (params.error) {
      console.error("❌ Consume failed on server:", params.error);
      return;
    }

    const consumer = await recvTransport.consume(params);
    const { track } = consumer;
    const stream = new MediaStream([track]);

    consumer.on("transportclose", () => {
      setRemoteStreams((prev) => prev.filter((rs) => rs.id !== consumer.id));
    });

    if (consumer.kind === "video") {
      setRemoteStreams((prev) => [
        ...prev,
        { id: consumer.id, stream, socketId },
      ]);
    }

    socket.emit("resume-consumer", { roomId, consumerId: consumer.id });
  };

  return { produce, remoteStreams, isProducing };
}