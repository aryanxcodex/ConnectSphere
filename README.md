# 🎥 Mediasoup Video Conferencing Platform

This is a full-stack, multi-room video conferencing application built with **Mediasoup**, **Node.js**, and **React**. It serves as a robust example of how to implement a Selective Forwarding Unit (SFU) for efficient, high-quality video calls.

## ✨ Features

- **Multi-Room Functionality**: Create or join any room using a unique Room ID.
- **High-Quality Video & Audio**: Leverages Mediasoup's SFU architecture for optimized media streaming.
- **Dynamic Video Grid**: The video layout intelligently adapts to the number of participants, similar to modern conferencing tools.
- **Producer/Consumer Model**: Efficiently manages media streams between multiple peers.
- **Real-time Signaling**: Uses Socket.IO for fast and reliable communication between the client and server.
- **Modern Tech Stack**: Built with TypeScript, Node.js, and React with Vite.

---

## 🚀 Getting Started

Follow these instructions to get a local copy up and running for development and testing.

### Prerequisites

- Node.js (v18 or later)
- npm or yarn

### Installation & Setup

1.  **Clone the repository:**
    ```bash
    git clone <your-repo-url>
    cd <your-repo-directory>
    ```

2.  **Setup the Backend Server:**
    ```bash
    # Navigate to the backend folder
    cd backend

    # Install dependencies
    npm install

    # IMPORTANT: Configure for Production
    # For local development, no changes are needed. For deployment, you must set
    # your server's public IP in `src/mediasoup.ts` in the `announcedIp` field.
    ```

3.  **Setup the Frontend Application:**
    ```bash
    # Navigate to the frontend folder from the root
    cd frontend

    # Install dependencies
    npm install
    ```

### Running the Application

1.  **Start the Backend Server:**
    From the `backend` directory, run:
    ```bash
    npm run dev
    ```
    The server will start on `http://localhost:3000`.

2.  **Start the Frontend Application:**
    From the `frontend` directory, run:
    ```bash
    npm run dev
    ```
    The React app will be available at `http://localhost:5173`. Open this URL in your browser to use the application.

---

## 🛠️ Tech Stack

### Backend
- **Node.js**: Asynchronous event-driven JavaScript runtime.
- **TypeScript**: Statically typed superset of JavaScript.
- **Express**: Minimalist web framework for Node.js.
- **Mediasoup**: Powerful WebRTC SFU for Node.js.
- **Socket.IO**: Real-time, bidirectional event-based communication.

### Frontend
- **React**: JavaScript library for building user interfaces.
- **Vite**: Next-generation frontend tooling.
- **TypeScript**: For type-safe component development.
- **Mediasoup-Client**: Client-side library for Mediasoup.
- **Tailwind CSS**: A utility-first CSS framework for rapid UI development.
- **React Router DOM**: For client-side routing.

---

## 🔮 Future Improvements

- **Media Controls**: Add buttons to toggle microphone and camera on/off.
- **Screen Sharing**: Implement a screen sharing producer.
- **Text Chat**: Add a real-time chat feature for participants in a room.
- **Authentication**: Secure rooms with user authentication.
- **Deployment**: Add Docker configurations for easier deployment.

---

## 📄 License

This project is licensed under the MIT License.
