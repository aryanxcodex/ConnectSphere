import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useMediasoup } from "../hooks/useMediasoup";
// ✅ Import icons from lucide-react
import { Mic, MicOff, Video, VideoOff, PhoneOff } from "lucide-react";

// Helper function for layout remains the same
const getVideoSizeClasses = (count: number): string => {
  if (count === 1) return "w-full max-w-4xl";
  if (count === 2) return "w-[calc(50%-0.5rem)]";
  if (count <= 4) return "w-[calc(50%-0.5rem)]";
  if (count <= 9) return "w-[calc(33.33%-0.75rem)]";
  return "w-[calc(25%-0.75rem)]";
};


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
        mediaStream.getAudioTracks()[0].enabled = false;
        mediaStream.getVideoTracks()[0].enabled = false;
        setLocalStream(mediaStream);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = mediaStream;
        }
      })
      .catch((err) => console.error("Error accessing media devices", err));
  }, [roomId]);

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
    navigate("/");
  };

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white">
      <header className="p-4">
        <h1 className="text-2xl font-bold">
          🎥 Room: <span className="text-blue-400">{roomId}</span>
        </h1>
      </header>

      {/* Main video grid remains the same */}
      <main className="flex-1 flex flex-wrap items-center justify-center content-center gap-4 p-4 overflow-y-auto">
        {/* Local video */}
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

      {/* ✅ Footer updated to use lucide-react icons */}
      <footer className="p-4 bg-gray-800 flex items-center justify-center gap-4">
        <button
          onClick={toggleMute}
          className={`p-3 rounded-full transition-colors ${
            isMuted
              ? "bg-red-600 hover:bg-red-700"
              : "bg-gray-600 hover:bg-gray-700"
          }`}
        >
          {isMuted ? <MicOff /> : <Mic />}
        </button>
        <button
          onClick={toggleCamera}
          className={`p-3 rounded-full transition-colors ${
            isCameraOff
              ? "bg-red-600 hover:bg-red-700"
              : "bg-gray-600 hover:bg-gray-700"
          }`}
        >
          {isCameraOff ? <VideoOff /> : <Video />}
        </button>
        <button
          onClick={handleHangUp}
          className="p-3 rounded-full bg-red-600 hover:bg-red-700 transition-colors"
        >
          <PhoneOff />
        </button>
      </footer>
    </div>
  );
}

export default Room;
