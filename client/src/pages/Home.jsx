import { useState } from "react";
import NavRail from "../components/NavRail.jsx";
import Sidebar from "../components/Sidebar.jsx";
import StatusPanel from "../components/StatusPanel.jsx";
import ChatWindow from "../components/ChatWindow.jsx";
import ProfileModal from "../components/ProfileModal.jsx";
import StarredModal from "../components/StarredModal.jsx";
import { useChats } from "../context/ChatContext.jsx";

export default function Home() {
  const { activeChat } = useChats();

  const [panel, setPanel] = useState("chats");
  const [showProfile, setShowProfile] = useState(false);
  const [showStarred, setShowStarred] = useState(false);

  return (
    <div className="flex h-screen bg-neutral-100 dark:bg-neutral-800">
      {/* The rail is desktop-only; on mobile the panel takes the full width */}
      <div className="hidden sm:flex">
        <NavRail
          panel={panel}
          setPanel={setPanel}
          onOpenProfile={() => setShowProfile(true)}
          onOpenStarred={() => setShowStarred(true)}
        />
      </div>

      {/* One pane at a time on mobile */}
      <div className={`${activeChat ? "hidden sm:flex" : "flex"} h-full`}>
        {panel === "chats" ? <Sidebar /> : <StatusPanel />}
      </div>

      {activeChat ? (
        <ChatWindow />
      ) : (
        <main className="hidden flex-1 items-center justify-center border-l border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 sm:flex">
          <div className="max-w-sm px-6 text-center">
            <p className="text-xl font-light text-neutral-500 dark:text-neutral-400">WhatsApp Clone</p>
            <p className="mt-3 text-sm text-neutral-400 dark:text-neutral-500">
              Select a chat from the list to start messaging.
            </p>
          </div>
        </main>
      )}

      {showProfile && <ProfileModal onClose={() => setShowProfile(false)} />}
      {showStarred && <StarredModal onClose={() => setShowStarred(false)} />}
    </div>
  );
}
