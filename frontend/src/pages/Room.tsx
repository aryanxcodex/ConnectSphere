import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { useMediasoup } from "../hooks/useMediasoup";

const getGridClasses = (count: number): string => {
  if (count === 1) return "max-w-4xl";
  if (count === 2) return "grid-cols-2 max-w-7xl";
  if (count <= 4) return "grid-cols-2 max-w-5xl";
  if (count <= 6) return "grid-cols-3 max-w-7xl";
  if (count <= 9) return "grid-cols-3";
  return "grid-cols-4";
};

function Room() {
  const { roomId } = useParams<{ roomId: string }>();
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);

  const { produce, remoteStreams, isProducing } = useMediasoup(
    roomId || "default-room",
    localStream
  );

  useEffect(() => {
    if (!roomId) return;

    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((mediaStream) => {
        setLocalStream(mediaStream);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = mediaStream;
        }
      })
      .catch((err) => console.error("Error accessing media devices", err));
  }, [roomId]);

  const handleProduce = async () => {
    await produce();
  };

  const activeRemoteStreams = useMemo(
    () =>
      remoteStreams.filter(
        ({ stream }) => stream.active && stream.id !== localStream?.id
      ),
    [remoteStreams, localStream]
  );

  const participantCount = activeRemoteStreams.length + 1;
  const gridLayout = useMemo(
    () => getGridClasses(participantCount),
    [participantCount]
  );

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white">
      <header className="p-4">
        <h1 className="text-2xl font-bold">
          🎥 Room: <span className="text-blue-400">{roomId}</span>
        </h1>
      </header>

      <main className="flex-1 flex items-center justify-center overflow-hidden p-4">
        <div className={`grid gap-4 w-full h-full ${gridLayout}`}>
          {/* Local video */}
          <div className="relative bg-gray-800 rounded-lg overflow-hidden shadow-lg aspect-video">
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className="absolute top-0 left-0 w-full h-full object-cover"
            />
            <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 px-2 py-1 rounded-md text-sm">
              You
            </div>
          </div>

          {/* Active remote videos only */}
          {activeRemoteStreams.map(({ id, stream }) => (
            <div
              key={id}
              className="relative bg-gray-800 rounded-lg overflow-hidden shadow-lg aspect-video"
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
        </div>
      </main>

      <footer className="p-4 bg-gray-800 flex items-center justify-center">
        <button
          onClick={handleProduce}
          className="px-4 py-2 bg-blue-600 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:bg-gray-500 disabled:cursor-not-allowed"
          disabled={!localStream || isProducing}
        >
          {isProducing ? "Sharing..." : "Start Sharing"}
        </button>
      </footer>
    </div>
  );
}

export default Room;
