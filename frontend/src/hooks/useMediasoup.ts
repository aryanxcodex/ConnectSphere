import { useEffect, useRef, useState } from "react";
import * as mediasoupClient from "mediasoup-client";
import type {
  Device,
  Transport,
  Producer,
  Consumer,
  RtpCapabilities,
  RtpParameters, // ✅ Import RtpParameters for our new type
} from "mediasoup-client/types";
import { socket } from "../lib/socket";

interface RemoteStream {
  id: string;
  stream: MediaStream;
}

interface JoinRoomResponse {
  routerRtpCapabilities: RtpCapabilities;
  existingProducerIds?: string[];
}

// ✅ Define a type for the parameters received from the server when consuming
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
        // ✅ Add explicit type for the callback response `res`
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
        // ✅ Add explicit type for the callback response `res`
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

        if (res.existingProducerIds) {
          console.log(
            `Consuming ${res.existingProducerIds.length} existing producers...`
          );
          for (const producerId of res.existingProducerIds) {
            consume(producerId);
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
      consume(producerId);
    };

    socket.on("new-producer", handleNewProducer);

    return () => {
      console.log("Running cleanup for useMediasoup");
      socket.off("new-producer", handleNewProducer);
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

  const consume = async (producerId: string) => {
    const device = deviceRef.current;
    const recvTransport = recvTransportRef.current;
    if (!device || !recvTransport) {
      console.error("Cannot consume: device or transport not ready");
      return;
    }

    const { rtpCapabilities } = device;
    // ✅ Use our new `ConsumerParams` type instead of `<any>`
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

    setRemoteStreams((prev) => [...prev, { id: consumer.id, stream }]);

    socket.emit("resume-consumer", { roomId, consumerId: consumer.id });
  };

  return { produce, remoteStreams, isProducing };
}
