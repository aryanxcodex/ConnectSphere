import { useEffect, useRef, useState } from "react";
import { useMediasoup } from "./hooks/useMediasoup";

function App() {
  const roomId = "demo-room";
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const { join, produce } = useMediasoup(roomId);

  useEffect(() => {
    // Get local webcam/mic
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((mediaStream) => {
        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      })
      .catch((err) => console.error("Error accessing media devices", err));
  }, []);

  const handleJoin = async () => {
    await join();
  };

  const handleProduce = async () => {
    if (stream) {
      await produce(stream);
    }
  };

  return (
    <div style={{ padding: "2rem" }}>
      <h1>🎥 Mediasoup Video Chat</h1>

      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        style={{ width: "400px", borderRadius: "8px" }}
      />

      <div style={{ marginTop: "1rem" }}>
        <button onClick={handleJoin} style={buttonStyle}>
          Join Room
        </button>
        <button onClick={handleProduce} style={buttonStyle}>
          Start Streaming
        </button>
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
