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

// ✅ Updated RemoteStream to include producerId for reliable cleanup
interface RemoteStream {
  id: string; // Consumer ID
  producerId: string;
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
  const producersRef = useRef<Map<string, Producer>>(new Map());
  const [remoteStreams, setRemoteStreams] = useState<RemoteStream[]>([]);
  const [isProducing, setIsProducing] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [isCameraOff, setIsCameraOff] = useState(true);
  const screenShareProducerRef = useRef<Producer | null>(null);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  // ✅ Create a ref to store and manage audio elements
  const audioRef = useRef<Map<string, HTMLAudioElement>>(new Map());

  const startScreenShare = async () => {
    if (!deviceRef.current || !sendTransportRef.current || isScreenSharing)
      return;

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
      });
      const screenTrack = stream.getVideoTracks()[0];

      const producer = await sendTransportRef.current.produce({
        track: screenTrack,
      });
      screenShareProducerRef.current = producer;
      setIsScreenSharing(true);

      // ✅ Listen for when the user clicks the browser's "Stop sharing" button
      screenTrack.onended = () => {
        console.log("Screen sharing track ended.");
        stopScreenShare();
      };
    } catch (err) {
      console.error("Error starting screen share:", err);
    }
  };

  const stopScreenShare = async () => {
    const producer = screenShareProducerRef.current;
    if (!producer) return;

    // Tell the server to close this producer
    socket.emit("close-producer", { roomId, producerId: producer.id }, () => {
      producer.close();
      screenShareProducerRef.current = null;
      setIsScreenSharing(false);
    });
  };

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
      consume(producerId, socketId);
    };

    socket.on("new-producer", handleNewProducer);

    socket.on("producer-closed", ({ producerId }) => {
      console.log(`Server notified that producer ${producerId} was closed.`);
      // ✅ Correctly filter by producerId to remove video tile
      setRemoteStreams((prevStreams) =>
        prevStreams.filter((rs) => rs.producerId !== producerId)
      );
      // ✅ Also remove the corresponding audio element
      const audio = audioRef.current.get(producerId);
      if (audio) {
        audio.remove();
        audioRef.current.delete(producerId);
      }
    });

    return () => {
      console.log("Running cleanup for useMediasoup");
      // ✅ Cleanup all audio elements on dismount
      audioRef.current.forEach((audio) => audio.remove());
      audioRef.current.clear();

      socket.off("new-producer", handleNewProducer);
      socket.off("producer-closed");
      sendTransportRef.current?.close();
      recvTransportRef.current?.close();
      socket.disconnect();
    };
  }, [roomId]);

  const produce = async () => {
    if (
      !localStream ||
      !sendTransportRef.current ||
      producersRef.current.has("video")
    ) {
      console.warn(
        "Cannot produce: already producing or stream/transport not ready"
      );
      return;
    }

    console.log("🎤 Starting to produce local media...");

    const audioTrack = localStream.getAudioTracks()[0];
    const videoTrack = localStream.getVideoTracks()[0];

    // Create audio producer
    if (audioTrack) {
      const audioProducer = await sendTransportRef.current.produce({
        track: audioTrack,
      });
      producersRef.current.set("audio", audioProducer);
    }

    // Create video producer with specific encodings for compatibility
    if (videoTrack) {
      const videoProducer = await sendTransportRef.current.produce({
        track: videoTrack,
        encodings: [
          // Simulcast for different quality layers
          { maxBitrate: 100000, scaleResolutionDownBy: 4 },
          { maxBitrate: 300000, scaleResolutionDownBy: 2 },
          { maxBitrate: 900000, scaleResolutionDownBy: 1 },
        ],
        codecOptions: {
          videoGoogleStartBitrate: 1000,
        },
      });
      producersRef.current.set("video", videoProducer);
    }
  };

  const toggleMute = () => {
    const audioProducer = producersRef.current.get("audio");
    if (!audioProducer) return;

    if (audioProducer.paused) {
      audioProducer.resume();
      setIsMuted(false);
    } else {
      audioProducer.pause();
      setIsMuted(true);
    }
  };

  const toggleCamera = () => {
    const videoProducer = producersRef.current.get("video");
    if (!videoProducer) return;

    const videoTrack = localStream?.getVideoTracks()[0];
    if (!videoTrack) return;

    if (videoProducer.paused) {
      videoProducer.resume();
      videoTrack.enabled = true;
      setIsCameraOff(false);
    } else {
      videoProducer.pause();
      videoTrack.enabled = false;
      setIsCameraOff(true);
    }
  };

  const consume = async (producerId: string, socketId: string) => {
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
      // ✅ Store producerId along with consumer.id for correct cleanup
      setRemoteStreams((prev) => [
        ...prev,
        { id: consumer.id, producerId: consumer.producerId, stream, socketId },
      ]);
    } else if (consumer.kind === "audio") {
      // ✅ Handle Audio: create, play, and store an audio element
      const audio = document.createElement("audio");
      audio.srcObject = stream;
      audio.autoplay = true;
      document.body.appendChild(audio);
      audioRef.current.set(consumer.producerId, audio); // Store using producerId
    }

    socket.emit("resume-consumer", { roomId, consumerId: consumer.id });
  };

  return {
    produce,
    remoteStreams,
    toggleMute,
    isMuted,
    toggleCamera,
    isCameraOff,
    startScreenShare,
    stopScreenShare,
    isScreenSharing,
  };
}
