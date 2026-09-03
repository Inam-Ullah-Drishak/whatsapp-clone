import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext.jsx";
import { SocketProvider } from "./context/SocketContext.jsx";
import { ChatProvider } from "./context/ChatContext.jsx";
import { MessageProvider } from "./context/MessageContext.jsx";
import App from "./App.jsx";
import "./index.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <SocketProvider>
          <ChatProvider>
            <MessageProvider>
              <App />
            </MessageProvider>
          </ChatProvider>
        </SocketProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);
