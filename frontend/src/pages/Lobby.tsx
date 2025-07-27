import { useState } from "react";
import { useNavigate } from "react-router-dom";

function Lobby() {
  const [roomId, setRoomId] = useState("");
  const navigate = useNavigate();

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (roomId.trim() !== "") {
      navigate(`/room/${roomId.trim()}`);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white font-sans">
      <h1 className="text-4xl font-bold mb-8">🎥 Mediasoup Video Chat</h1>
      <form
        onSubmit={handleJoinRoom}
        className="flex flex-col gap-4 w-full max-w-sm"
      >
        <input
          type="text"
          value={roomId}
          onChange={(e) => setRoomId(e.target.value)}
          placeholder="Enter Room ID"
          className="p-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        />
        <button
          type="submit"
          className="p-3 bg-blue-600 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:bg-gray-500"
        >
          Join Room
        </button>
      </form>
    </div>
  );
}

export default Lobby;
