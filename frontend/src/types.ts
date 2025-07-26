// src/types/mediasoup.ts
import * as mediasoupClient from "mediasoup-client";

export type RtpCapabilitiesResponse = {
  rtpCapabilities: mediasoupClient.types.RtpCapabilities;
};

export type CreateTransportParams = {
  id: string;
  iceParameters: mediasoupClient.types.IceParameters;
  iceCandidates: mediasoupClient.types.IceCandidate[];
  dtlsParameters: mediasoupClient.types.DtlsParameters;
};

export type ConnectTransportRequest = {
  transportId: string;
  dtlsParameters: mediasoupClient.types.DtlsParameters;
};

export type ConnectTransportResponse = {
  error?: string;
};

export type ProduceRequest = {
  roomId: string;
  transportId: string;
  kind: mediasoupClient.types.MediaKind;
  rtpParameters: mediasoupClient.types.RtpParameters;
};

export type ProduceResponse = {
  id: string;
  error?: string;
};

export interface ConsumerParams {
  id: string;
  producerId: string;
  kind: "audio" | "video";
  rtpParameters: any;
}
