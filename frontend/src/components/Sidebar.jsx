import { useEffect, useState } from "react";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import SidebarSkeleton from "./skeletons/SidebarSkeleton";
import { Users, Search, Image as ImageIcon } from "lucide-react";

const formatTime = (dateString) => {
  if (!dateString) return "";
  const date = new Date(dateString);
  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  if (isToday) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  if (isYesterday) return "Yesterday";

  return date.toLocaleDateString([], { month: "short", day: "numeric" });
};

const Sidebar = () => {
  const { getUsers, users, selectedUser, setSelectedUser, isUsersLoading, subscribeToMessages } =
    useChatStore();
  const { onlineUsers } = useAuthStore();
  const [showOnlineOnly, setShowOnlineOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    getUsers();
    subscribeToMessages();
  }, [getUsers, subscribeToMessages]);

  const filteredUsers = users.filter((user) => {
    const matchesOnline = showOnlineOnly ? onlineUsers.includes(user._id) : true;
    const matchesSearch = user.fullName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesOnline && matchesSearch;
  });

  if (isUsersLoading) return <SidebarSkeleton />;

  return (
    <aside className="h-full w-20 lg:w-80 border-r border-base-300 flex flex-col transition-all duration-200 bg-base-100">
      <div className="border-b border-base-300 w-full p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            <span className="font-semibold text-base hidden lg:inline">Chats</span>
          </div>
          <span className="text-xs text-zinc-500 hidden lg:inline font-medium">
            {onlineUsers.length - 1 > 0 ? onlineUsers.length - 1 : 0} online
          </span>
        </div>

        {/* Search Input on Desktop */}
        <div className="relative hidden lg:block">
          <Search className="absolute left-3 top-2.5 size-4 text-base-content/40" />
          <input
            type="text"
            placeholder="Search contacts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input input-sm input-bordered w-full pl-9 bg-base-200/60 text-xs rounded-lg"
          />
        </div>

        {/* Online filter toggle */}
        <div className="hidden lg:flex items-center gap-2">
          <label className="cursor-pointer flex items-center gap-2">
            <input
              type="checkbox"
              checked={showOnlineOnly}
              onChange={(e) => setShowOnlineOnly(e.target.checked)}
              className="checkbox checkbox-xs checkbox-primary"
            />
            <span className="text-xs text-base-content/70">Show online only</span>
          </label>
        </div>
      </div>

      <div className="overflow-y-auto w-full py-2 flex-1">
        {filteredUsers.map((user) => {
          const isOnline = onlineUsers.includes(user._id);
          const isSelected = selectedUser?._id === user._id;
          const unreadCount = user.unreadCount || 0;

          return (
            <button
              key={user._id}
              onClick={() => setSelectedUser(user)}
              className={`
                w-full p-3 flex items-center gap-3 transition-colors relative text-left
                hover:bg-base-200
                ${isSelected ? "bg-base-200/90 ring-1 ring-primary/30" : ""}
              `}
            >
              {/* Avatar + Online Badge + Small Screen Unread Dot */}
              <div className="relative mx-auto lg:mx-0 shrink-0">
                <img
                  src={user.profilePic || "/avatar.png"}
                  alt={user.fullName}
                  className="size-11 object-cover rounded-full border border-base-300"
                  onError={(e) => {
                    e.target.src =
                      "https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png";
                  }}
                />
                {isOnline && (
                  <span className="absolute bottom-0 right-0 size-3 bg-emerald-500 ring-2 ring-base-100 rounded-full" />
                )}
                {unreadCount > 0 && (
                  <span className="lg:hidden absolute -top-1 -right-1 size-4 bg-primary text-[10px] text-white rounded-full flex items-center justify-center font-bold">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </div>

              {/* User and Conversation Metadata (Desktop) */}
              <div className="hidden lg:flex flex-col flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1 mb-0.5">
                  <span className="font-semibold text-sm truncate text-base-content">
                    {user.fullName}
                  </span>
                  {user.lastMessageTimestamp && (
                    <span className="text-[11px] text-base-content/50 shrink-0">
                      {formatTime(user.lastMessageTimestamp)}
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs text-base-content/60 truncate flex items-center gap-1">
                    {user.lastMessage ? (
                      <>
                        {user.lastMessage.image && !user.lastMessage.text ? (
                          <span className="flex items-center gap-1 text-primary">
                            <ImageIcon className="size-3" /> Photo
                          </span>
                        ) : (
                          <span className="truncate">{user.lastMessage.text}</span>
                        )}
                      </>
                    ) : (
                      <span className="text-base-content/40 italic">No messages yet</span>
                    )}
                  </div>

                  {unreadCount > 0 && (
                    <span className="badge badge-primary badge-sm text-[11px] font-bold shrink-0">
                      {unreadCount}
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}

        {filteredUsers.length === 0 && (
          <div className="text-center text-base-content/40 py-8 px-4 text-xs">
            {searchQuery ? "No contacts found matching search" : "No contacts available"}
          </div>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;

