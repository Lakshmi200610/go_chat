import { useEffect, useRef } from "react";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import ChatHeader from "./ChatHeader";
import MessageInput from "./MessageInput";
import MessageSkeleton from "./skeletons/MessageSkeleton";
import { Loader2, Check, CheckCheck } from "lucide-react";

const ChatContainer = () => {
  const {
    messages,
    getMessages,
    loadMoreMessages,
    isMessagesLoading,
    isLoadingMore,
    hasMoreMessages,
    selectedUser,
    listenToTyping,
    stopListeningToTyping,
    typingUsers,
  } = useChatStore();
  const { authUser } = useAuthStore();
  
  const messageEndRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const prevScrollHeightRef = useRef(0);
  const isInitialLoadRef = useRef(true);

  // Load initial messages on contact select
  useEffect(() => {
    if (selectedUser?._id) {
      isInitialLoadRef.current = true;
      getMessages(selectedUser._id, 1);
      listenToTyping();
    }

    return () => {
      stopListeningToTyping();
    };
  }, [selectedUser?._id, getMessages, listenToTyping, stopListeningToTyping]);

  // Mark unread messages as read when active in conversation
  useEffect(() => {
    if (selectedUser?._id && messages.length > 0) {
      const unreadIncoming = messages.some((m) => {
        const senderIdStr =
          typeof m.senderId === "object"
            ? m.senderId._id?.toString()
            : m.senderId?.toString();
        return senderIdStr === selectedUser._id && m.status !== "read";
      });

      if (unreadIncoming) {
        const socket = useAuthStore.getState().socket;
        const currentConvId = useChatStore.getState().currentConversationId;
        if (socket && currentConvId) {
          socket.emit("markAsRead", currentConvId);
        }
      }
    }
  }, [messages, selectedUser?._id]);

  // Handle scroll anchoring for pagination vs new messages
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    if (isInitialLoadRef.current && messages.length > 0) {
      // Scroll to bottom on first load
      messageEndRef.current?.scrollIntoView({ behavior: "auto" });
      isInitialLoadRef.current = false;
    } else if (prevScrollHeightRef.current > 0) {
      // Restore scroll offset when older messages prepended
      const heightDifference = container.scrollHeight - prevScrollHeightRef.current;
      container.scrollTop += heightDifference;
      prevScrollHeightRef.current = 0;
    } else {
      // Smooth scroll to bottom on new message
      messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, typingUsers]);

  const handleScroll = (e) => {
    const { scrollTop, scrollHeight } = e.currentTarget;
    if (scrollTop === 0 && hasMoreMessages && !isLoadingMore) {
      prevScrollHeightRef.current = scrollHeight;
      loadMoreMessages();
    }
  };

  const isTyping = selectedUser ? typingUsers[selectedUser._id] : false;

  if (isMessagesLoading && messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col overflow-auto bg-base-100">
        <ChatHeader />
        <MessageSkeleton />
        <MessageInput />
      </div>
    );
  }

  const formatMessageTime = (dateString) => {
    return new Date(dateString).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-base-100">
      <ChatHeader />

      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 space-y-4"
      >
        {/* Load Earlier Messages Button / Indicator */}
        {hasMoreMessages && (
          <div className="flex justify-center my-2">
            <button
              onClick={() => {
                if (scrollContainerRef.current) {
                  prevScrollHeightRef.current = scrollContainerRef.current.scrollHeight;
                }
                loadMoreMessages();
              }}
              disabled={isLoadingMore}
              className="btn btn-xs btn-ghost gap-1.5 text-xs text-base-content/60 hover:text-primary"
            >
              {isLoadingMore ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Loading older messages...
                </>
              ) : (
                "Load earlier messages"
              )}
            </button>
          </div>
        )}

        {messages.map((message) => {
          const senderIdStr =
            typeof message.senderId === "object"
              ? message.senderId._id?.toString()
              : message.senderId?.toString();
          const isSenderMe = senderIdStr === authUser._id?.toString();

          return (
            <div
              key={message._id}
              className={`chat ${isSenderMe ? "chat-end" : "chat-start"}`}
            >
              <div className="chat-image avatar">
                <div className="size-9 rounded-full border border-base-300">
                  <img
                    src={
                      isSenderMe
                        ? authUser.profilePic || "/avatar.png"
                        : selectedUser.profilePic || "/avatar.png"
                    }
                    alt="avatar"
                    onError={(e) => {
                      e.target.src =
                        "https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png";
                    }}
                  />
                </div>
              </div>

              <div className="chat-header mb-1 flex items-center gap-1.5">
                <time className="text-[11px] opacity-60">
                  {formatMessageTime(message.createdAt)}
                </time>
                {isSenderMe && (
                  <span className="text-xs opacity-70">
                    {message.status === "read" ? (
                      <CheckCheck className="size-3.5 text-sky-400" />
                    ) : message.status === "delivered" ? (
                      <CheckCheck className="size-3.5 text-base-content/50" />
                    ) : (
                      <Check className="size-3.5 text-base-content/50" />
                    )}
                  </span>
                )}
              </div>

              <div
                className={`chat-bubble flex flex-col shadow-sm text-sm ${
                  isSenderMe ? "chat-bubble-primary text-primary-content" : "bg-base-200 text-base-content"
                }`}
              >
                {message.image && (
                  <img
                    src={message.image}
                    alt="Attachment"
                    className="max-w-[240px] max-h-[240px] rounded-lg mb-1 object-cover cursor-pointer hover:opacity-95 transition-opacity"
                    onClick={() => window.open(message.image, "_blank")}
                  />
                )}
                {message.text && <p className="break-words leading-relaxed">{message.text}</p>}
              </div>
            </div>
          );
        })}

        {/* Typing indicator */}
        {isTyping && (
          <div className="chat chat-start">
            <div className="chat-image avatar">
              <div className="size-9 rounded-full border border-base-300">
                <img
                  src={selectedUser.profilePic || "/avatar.png"}
                  alt="avatar"
                  onError={(e) => {
                    e.target.src =
                      "https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png";
                  }}
                />
              </div>
            </div>
            <div className="chat-bubble bg-base-200 text-base-content/80 py-2.5 px-4 flex items-center gap-2">
              <span className="text-xs font-medium">{selectedUser.fullName} is typing</span>
              <span className="flex gap-1 items-center">
                <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </span>
            </div>
          </div>
        )}

        <div ref={messageEndRef} />
      </div>

      <MessageInput />
    </div>
  );
};

export default ChatContainer;

