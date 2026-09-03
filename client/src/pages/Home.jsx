import Sidebar from "../components/Sidebar.jsx";
import ChatWindow from "../components/ChatWindow.jsx";
import { useChats } from "../context/ChatContext.jsx";

export default function Home() {
  const { activeChat } = useChats();

  return (
    <div className="flex h-screen bg-neutral-100">
      {/* On mobile, show one pane at a time */}
      <div className={`${activeChat ? "hidden sm:flex" : "flex"} h-full`}>
        <Sidebar />
      </div>

      {activeChat ? (
        <ChatWindow />
      ) : (
        <main className="hidden flex-1 items-center justify-center border-l border-neutral-200 bg-neutral-50 sm:flex">
          <div className="max-w-sm px-6 text-center">
            <p className="text-xl font-light text-neutral-500">WhatsApp Clone</p>
            <p className="mt-3 text-sm text-neutral-400">
              Select a chat from the list to start messaging.
            </p>
          </div>
        </main>
      )}
    </div>
  );
}
