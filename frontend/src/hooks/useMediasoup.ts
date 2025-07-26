import { useEffect, useRef, useState } from "react";
import * as mediasoupClient from "mediasoup-client";
import type {
  Device,
  Transport,
  Producer,
  Consumer,
} from "mediasoup-client/types";
import type { CreateTransportParams } from "../types";
import { socket } from "../lib/socket";

export function useMediasoup(roomId: string) {
  const deviceRef = useRef<Device | null>(null);
  const sendTransportRef = useRef<Transport | null>(null);
  const recvTransportRef = useRef<Transport | null>(null);
  const [consumers, setConsumers] = useState<Consumer[]>([]);

  useEffect(() => {
    socket.emit("join-room", { roomId }, (res: { joined: boolean }) => {
      console.log("✅ Joined room:", res);
    });
    socket.on("new-producer", ({ producerId }: { producerId: string }) => {
      consume(producerId);
    });
    return () => {
      socket.disconnect();
    };
  }, [roomId]);

  const join = async () => {
    if (!deviceRef.current) return;

    const device = deviceRef.current;

    // Create Send Transport
    const sendParams = await new Promise<any>((resolve) => {
      socket.emit(
        "create-transport",
        { direction: "send", roomId },
        (res: CreateTransportParams) => resolve(res)
      );
    });

    const sendTransport = device.createSendTransport(sendParams);
    sendTransportRef.current = sendTransport;

    sendTransport.on("connect", ({ dtlsParameters }, callback, errback) => {
      socket.emit(
        "connect-transport",
        {
          transportId: sendTransport.id,
          dtlsParameters,
        },
        (res: any) => {
          res.error ? errback(new Error(res.error)) : callback();
        }
      );
    });

    sendTransport.on(
      "produce",
      ({ kind, rtpParameters }, callback, errback) => {
        socket.emit(
          "produce",
          {
            roomId,
            transportId: sendTransport.id,
            kind,
            rtpParameters,
          },
          (res: any) => {
            res.error
              ? errback(new Error(res.error))
              : callback({ id: res.id });
          }
        );
      }
    );

    console.log("✅ Send transport created");

    // Create Recv Transport
    const recvParams = await new Promise<any>((resolve) => {
      socket.emit("create-transport", { roomId }, (params: any) =>
        resolve(params)
      );
    });

    const recvTransport = device.createRecvTransport(recvParams);
    recvTransportRef.current = recvTransport;

    recvTransport.on("connect", ({ dtlsParameters }, callback, errback) => {
      socket.emit(
        "connect-transport",
        {
          transportId: recvTransport.id,
          dtlsParameters,
        },
        (res: any) => {
          res.error ? errback(new Error(res.error)) : callback();
        }
      );
    });

    console.log("✅ Recv transport created");
  };

  const produce = async (stream: MediaStream) => {
    const sendTransport = sendTransportRef.current;
    if (!sendTransport) return;

    for (const track of stream.getTracks()) {
      await sendTransport.produce({ track });
    }

    console.log("🎤 Local media produced");
  };

  const consume = async (producerId: string) => {
    const device = deviceRef.current;
    const recvTransport = recvTransportRef.current;
    if (!device || !recvTransport) return;

    socket.emit(
      "consume",
      {
        roomId,
        transportId: recvTransport.id,
        producerId,
        rtpCapabilities: device.rtpCapabilities,
      },
      async (res: any) => {
        if (res.error) {
          console.error("❌ Consume failed:", res.error);
          return;
        }

        const consumer = await recvTransport.consume({
          id: res.id,
          producerId: res.producerId,
          kind: res.kind,
          rtpParameters: res.rtpParameters,
        });

        setConsumers((prev) => [...prev, consumer]);

        const stream = new MediaStream([consumer.track]);
        const el = document.createElement("video");
        el.srcObject = stream;
        el.autoplay = true;
        el.muted = true;
        el.playsInline = true;
        el.style.width = "300px";
        document.body.appendChild(el);

        console.log("📥 Consuming", res.kind);
      }
    );
  };

  return {
    join,
    produce,
    consumers,
  };
}
