import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useMediasoup } from "../hooks/useMediasoup";

// ✅ Updated helper to use width (w-*) instead of basis
const getVideoSizeClasses = (count: number): string => {
  if (count === 1) return "w-full max-w-4xl";
  if (count === 2) return "w-[calc(50%-0.5rem)]";
  if (count <= 4) return "w-[calc(50%-0.5rem)]";
  if (count <= 9) return "w-[calc(33.33%-0.75rem)]";
  return "w-[calc(25%-0.75rem)]";
};

const MicOnIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
    <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
    <line x1="12" y1="19" x2="12" y2="22"></line>
  </svg>
);
const MicOffIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="1" y1="1" x2="23" y2="23"></line>
    <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"></path>
    <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"></path>
    <line x1="12" y1="19" x2="12" y2="22"></line>
  </svg>
);
const VideoOnIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polygon points="23 7 16 12 23 17 23 7"></polygon>
    <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
  </svg>
);
const VideoOffIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34l1 1L23 7v10"></path>
    <line x1="1" y1="1" x2="23" y2="23"></line>
  </svg>
);
const HangUpIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91"></path>
  </svg>
);

function Room() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);

  const {
    produce,
    remoteStreams,
    toggleMute,
    isMuted,
    toggleCamera,
    isCameraOff,
  } = useMediasoup(roomId || "default-room", localStream);

  useEffect(() => {
    if (!roomId) return;

    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((mediaStream) => {
        // ✅ Immediately disable the tracks upon getting the stream
        mediaStream.getAudioTracks()[0].enabled = false;
        mediaStream.getVideoTracks()[0].enabled = false;

        setLocalStream(mediaStream);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = mediaStream;
        }
      })
      .catch((err) => console.error("Error accessing media devices", err));
  }, [roomId]);

  // ✅ Automatically start sharing when the stream is ready
  useEffect(() => {
    if (localStream) {
      produce();
    }
  }, [localStream, produce]);

  const participantCount = remoteStreams.length + 1;
  const videoSize = useMemo(
    () => getVideoSizeClasses(participantCount),
    [participantCount]
  );

  const handleHangUp = () => {
    // Simple navigation back to the lobby
    navigate("/");
  };

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white">
      {/* ... Header is the same ... */}

      {/* Main video grid */}
      <main className="flex-1 flex flex-wrap items-center justify-center content-center gap-4 p-4 overflow-y-auto">
        {/* Local video - ✅ Hide if camera is off */}
        <div
          className={`relative rounded-lg overflow-hidden shadow-lg aspect-video ${videoSize}`}
        >
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            className={`absolute top-0 left-0 w-full h-full object-cover ${
              isCameraOff ? "hidden" : ""
            }`}
          />
          {isCameraOff && (
            <div className="w-full h-full bg-gray-800 flex items-center justify-center">
              <p>Camera is off</p>
            </div>
          )}
          <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 px-2 py-1 rounded-md text-sm">
            You {isMuted && "(Muted)"}
          </div>
        </div>

        {/* Remote videos */}
        {remoteStreams.map(({ id, stream }) => (
          <div
            key={id}
            className={`relative rounded-lg overflow-hidden shadow-lg aspect-video ${videoSize}`}
          >
            <video
              autoPlay
              playsInline
              className="absolute top-0 left-0 w-full h-full object-cover"
              ref={(video) => {
                if (video) video.srcObject = stream;
              }}
            />
            <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 px-2 py-1 rounded-md text-sm">
              Remote User
            </div>
          </div>
        ))}
      </main>

      {/* ✅ Updated Footer with media controls */}
      <footer className="p-4 bg-gray-800 flex items-center justify-center gap-4">
        <button
          onClick={toggleMute}
          className={`p-3 rounded-full transition-colors ${
            isMuted
              ? "bg-red-600 hover:bg-red-700"
              : "bg-gray-600 hover:bg-gray-700"
          }`}
        >
          {isMuted ? <MicOffIcon /> : <MicOnIcon />}
        </button>
        <button
          onClick={toggleCamera}
          className={`p-3 rounded-full transition-colors ${
            isCameraOff
              ? "bg-red-600 hover:bg-red-700"
              : "bg-gray-600 hover:bg-gray-700"
          }`}
        >
          {isCameraOff ? <VideoOffIcon /> : <VideoOnIcon />}
        </button>
        <button
          onClick={handleHangUp}
          className="p-3 rounded-full bg-red-600 hover:bg-red-700 transition-colors"
        >
          <HangUpIcon />
        </button>
      </footer>
    </div>
  );
}

export default Room;
