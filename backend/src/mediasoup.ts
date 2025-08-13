import { createWorker } from "mediasoup";
import {
  Worker,
  Router,
  WebRtcTransport,
  IceParameters,
  IceCandidate,
  DtlsParameters,
} from "mediasoup/node/lib/types";

interface TransportParams {
  id: string;
  iceParameters: IceParameters;
  iceCandidates: IceCandidate[];
  dtlsParameters: DtlsParameters;
}

let worker: Worker;
let router: Router;

export async function createMediasoupWorker() {
  worker = await createWorker({
    logLevel: "warn",
    rtcMinPort: 20000,
    rtcMaxPort: 20200,
  });

  router = await worker.createRouter({
    mediaCodecs: [
      {
        kind: "audio",
        mimeType: "audio/opus",
        clockRate: 48000,
        channels: 2,
      },
      {
        kind: "video",
        mimeType: "video/VP8",
        clockRate: 90000,
        parameters: {
          "x-google-start-bitrate": 1000,
        },
      },
      {
        kind: "video",
        mimeType: "video/H264",
        clockRate: 90000,
        parameters: {
          "packetization-mode": 1,
          "profile-level-id": "42e01f",
          "level-asymmetry-allowed": 1,
        },
      },
    ],
  });

  console.log(" Mediasoup worker and router created");
}

export async function createWebRtcTransport(router: Router): Promise<{
  transport: WebRtcTransport;
  params: TransportParams;
}> {
  const transport = await router.createWebRtcTransport({
    listenIps: [
      {
        ip: "127.0.0.1", // Local IP for dev; use public IP in production
        announcedIp: undefined, // Set to your public IP if behind NAT
      },
    ],
    enableUdp: true,
    enableTcp: true,
    preferUdp: true,
    initialAvailableOutgoingBitrate: 1_000_000,
  });

  return {
    transport,
    params: {
      id: transport.id,
      iceParameters: transport.iceParameters,
      iceCandidates: transport.iceCandidates,
      dtlsParameters: transport.dtlsParameters,
    },
  };
}

export function getMediasoupRouter() {
  return router;
}
