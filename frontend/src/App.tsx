import { useEffect, useRef, useState } from "react";
import { useMediasoup } from "./hooks/useMediasoup";

function App() {
  const roomId = "demo-room";
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);

  // ✅ Destructure the new `isProducing` state from the hook
  const { produce, remoteStreams, isProducing } = useMediasoup(
    roomId,
    localStream
  );

  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((mediaStream) => {
        setLocalStream(mediaStream);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = mediaStream;
        }
      })
      .catch((err) => console.error("Error accessing media devices", err));
  }, []);

  const handleProduce = async () => {
    console.log("🟡 handleProduce() called");
    await produce();
  };

  return (
    <div style={{ padding: "2rem" }}>
      <h1>🎥 Mediasoup Video Chat</h1>

      {/* Local Video */}
      <video
        ref={localVideoRef}
        autoPlay
        muted // Mute local video to prevent feedback
        playsInline
        style={{
          width: "400px",
          borderRadius: "8px",
          border: "2px solid #555",
        }}
      />

      <div style={{ marginTop: "1rem" }}>
        {/* ✅ Update the button to use the `isProducing` state */}
        <button
          onClick={handleProduce}
          style={buttonStyle}
          disabled={!localStream || isProducing}
        >
          {isProducing ? "Sharing..." : "Start Sharing"}
        </button>
      </div>

      {/* Remote Videos Grid */}
      <h2>Remote Streams</h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
          gap: "1rem",
        }}
      >
        {remoteStreams.map(({ id, stream }) => (
          <video
            key={id}
            autoPlay
            playsInline
            style={{ width: "100%", borderRadius: "8px" }}
            ref={(video) => {
              if (video) video.srcObject = stream;
            }}
          />
        ))}
      </div>
    </div>
  );
}

const buttonStyle: React.CSSProperties = {
  padding: "0.5rem 1rem",
  marginRight: "1rem",
  fontSize: "1rem",
  cursor: "pointer",
  borderRadius: "6px",
  border: "1px solid #ccc",
  backgroundColor: "#f0f0f0",
};

export default App;
