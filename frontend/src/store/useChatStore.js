import { create } from "zustand";
import toast from "react-hot-toast";
import { axiosInstance } from "../lib/axios";
import { useAuthStore } from "./useAuthStore";
import { playNotificationSound, playTypingSound } from "../lib/sound";

export const useChatStore = create((set, get) => ({
  messages: [],
  users: [],
  selectedUser: null,
  currentConversationId: null,
  isUsersLoading: false,
  isMessagesLoading: false,
  isLoadingMore: false,
  hasMoreMessages: false,
  page: 1,
  totalMessages: 0,
  typingUsers: {}, // { [userId]: boolean }

  getUsers: async () => {
    set({ isUsersLoading: true });
    try {
      const res = await axiosInstance.get("/messages/users");
      set({ users: Array.isArray(res.data) ? res.data : [] });
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to load contacts");
    } finally {
      set({ isUsersLoading: false });
    }
  },

  getMessages: async (userId, page = 1) => {
    if (!userId) return;
    set({ isMessagesLoading: true, page: 1 });
    try {
      const res = await axiosInstance.get(`/messages/${userId}?page=${page}&limit=30`);

      const messagesData = Array.isArray(res.data) ? res.data : res.data.messages || [];
      const hasMore = res.data.hasMore || false;
      const total = res.data.totalMessages || messagesData.length;
      const conversationId = res.data.conversationId || null;

      set({
        messages: messagesData,
        hasMoreMessages: hasMore,
        totalMessages: total,
        currentConversationId: conversationId,
        page: 1,
      });

      // Reset unread counter for this user in local sidebar state
      set((state) => ({
        users: state.users.map((u) =>
          u._id === userId ? { ...u, unreadCount: 0 } : u
        ),
      }));

      // Join conversation room & emit read receipt via socket
      const socket = useAuthStore.getState().socket;
      if (socket && conversationId) {
        socket.emit("joinConversation", conversationId);
        socket.emit("markAsRead", conversationId);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to load messages");
    } finally {
      set({ isMessagesLoading: false });
    }
  },

  loadMoreMessages: async () => {
    const { selectedUser, page, hasMoreMessages, isLoadingMore, messages } = get();
    if (!selectedUser || !hasMoreMessages || isLoadingMore) return;

    set({ isLoadingMore: true });

    try {
      // Use oldest message createdAt timestamp as cursor to avoid page drift
      const oldestMessage = messages[0];
      const cursorParam = oldestMessage?.createdAt
        ? `cursor=${encodeURIComponent(oldestMessage.createdAt)}`
        : `page=${page + 1}`;

      const res = await axiosInstance.get(
        `/messages/${selectedUser._id}?${cursorParam}&limit=30`
      );

      const olderMessages = Array.isArray(res.data) ? res.data : res.data.messages || [];
      const hasMore = res.data.hasMore || false;

      // Prepend older messages while filtering duplicates
      const existingIds = new Set(messages.map((m) => m._id));
      const filteredOlder = olderMessages.filter((m) => !existingIds.has(m._id));

      set({
        messages: [...filteredOlder, ...messages],
        page: page + 1,
        hasMoreMessages: hasMore,
      });
    } catch (error) {
      toast.error("Failed to load older messages");
    } finally {
      set({ isLoadingMore: false });
    }
  },

  sendMessage: async (messageData) => {
    const { selectedUser, messages, users } = get();
    if (!selectedUser) return;

    try {
      const res = await axiosInstance.post(
        `/messages/send/${selectedUser._id}`,
        messageData
      );
      const newMessage = res.data;

      set({ messages: [...messages, newMessage] });

      // Update sidebar state: update lastMessage and move active contact to top
      const updatedUsers = users.map((u) => {
        if (u._id === selectedUser._id) {
          return {
            ...u,
            lastMessage: newMessage,
            lastMessageTimestamp: newMessage.createdAt,
          };
        }
        return u;
      });

      // Move contact to top of list
      const targetUser = updatedUsers.find((u) => u._id === selectedUser._id);
      const otherUsers = updatedUsers.filter((u) => u._id !== selectedUser._id);
      set({ users: targetUser ? [targetUser, ...otherUsers] : updatedUsers });
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to send message");
    }
  },

  sendTyping: (isTyping) => {
    const { socket } = useAuthStore.getState();
    const { selectedUser, currentConversationId } = get();
    if (!socket || !selectedUser) return;
    socket.emit("typing", {
      receiverId: selectedUser._id,
      conversationId: currentConversationId,
      isTyping,
    });
  },

  subscribeToMessages: () => {
    const socket = useAuthStore.getState().socket;
    if (!socket) return;

    // Clean prior listeners before attaching
    socket.off("newMessage");
    socket.off("messagesRead");
    socket.off("conversationUpdated");

    // 1. Live new message listener
    socket.on("newMessage", (newMessage) => {
      const { selectedUser, messages, users, currentConversationId } = get();
      const authUser = useAuthStore.getState().authUser;

      const isFromSelectedUser = selectedUser && newMessage.senderId === selectedUser._id;
      const isFromMe = authUser && newMessage.senderId === authUser._id;

      if (isFromSelectedUser) {
        // Prevent duplicate appends
        if (!messages.some((m) => m._id === newMessage._id)) {
          set({ messages: [...messages, newMessage] });
        }
        // If chat is open, immediately acknowledge and mark read
        if (currentConversationId || newMessage.conversationId) {
          socket.emit("markAsRead", currentConversationId || newMessage.conversationId);
        }
      }

      // Play sound if incoming from someone else
      if (!isFromMe) {
        playNotificationSound();
      }

      // Update contact metadata in sidebar
      const partnerId = isFromMe ? newMessage.receiverId : newMessage.senderId;
      const updatedUsers = users.map((u) => {
        if (u._id === partnerId) {
          const shouldIncrement = !selectedUser || selectedUser._id !== partnerId;
          return {
            ...u,
            lastMessage: newMessage,
            lastMessageTimestamp: newMessage.createdAt,
            unreadCount: shouldIncrement ? (u.unreadCount || 0) + 1 : 0,
          };
        }
        return u;
      });

      // Move contact to top
      const partnerUser = updatedUsers.find((u) => u._id === partnerId);
      const restUsers = updatedUsers.filter((u) => u._id !== partnerId);
      set({ users: partnerUser ? [partnerUser, ...restUsers] : updatedUsers });
    });

    // 2. Live Read Receipts Listener
    socket.on("messagesRead", ({ conversationId, readerId }) => {
      const authUser = useAuthStore.getState().authUser;
      // Mark our sent messages as read in local state
      set((state) => ({
        messages: state.messages.map((m) => {
          if (m.senderId === authUser?._id && m.status !== "read") {
            return { ...m, status: "read" };
          }
          return m;
        }),
      }));
    });

    // 3. Live Conversation Sidebar Update Listener
    socket.on(
      "conversationUpdated",
      ({ conversationId, senderId, lastMessage, lastMessageTimestamp, unreadCount }) => {
        const { users, selectedUser } = get();
        const authUser = useAuthStore.getState().authUser;
        const partnerId =
          senderId === authUser?._id
            ? lastMessage?.receiverId || senderId
            : senderId;

        const updatedUsers = users.map((u) => {
          if (u._id === partnerId) {
            const shouldShowUnread = !selectedUser || selectedUser._id !== partnerId;
            return {
              ...u,
              lastMessage,
              lastMessageTimestamp,
              unreadCount: shouldShowUnread ? unreadCount : 0,
            };
          }
          return u;
        });

        const partnerUser = updatedUsers.find((u) => u._id === partnerId);
        const restUsers = updatedUsers.filter((u) => u._id !== partnerId);
        set({ users: partnerUser ? [partnerUser, ...restUsers] : updatedUsers });
      }
    );
  },

  unsubscribeFromMessages: () => {
    const socket = useAuthStore.getState().socket;
    if (!socket) return;
    socket.off("newMessage");
    socket.off("messagesRead");
    socket.off("conversationUpdated");
  },

  listenToTyping: () => {
    const socket = useAuthStore.getState().socket;
    if (!socket) return;

    socket.off("typing");
    socket.on("typing", ({ senderId, isTyping }) => {
      set((state) => ({
        typingUsers: {
          ...state.typingUsers,
          [senderId]: isTyping,
        },
      }));

      const { selectedUser } = get();
      if (isTyping && selectedUser && selectedUser._id === senderId) {
        playTypingSound();
      }
    });
  },

  stopListeningToTyping: () => {
    const socket = useAuthStore.getState().socket;
    if (!socket) return;
    socket.off("typing");
  },

  setSelectedUser: (selectedUser) => {
    const { currentConversationId } = get();
    const socket = useAuthStore.getState().socket;

    if (socket && currentConversationId) {
      socket.emit("leaveConversation", currentConversationId);
    }

    set({ selectedUser, currentConversationId: null });
    if (selectedUser) {
      // Clear unread count for selected user
      set((state) => ({
        users: state.users.map((u) =>
          u._id === selectedUser._id ? { ...u, unreadCount: 0 } : u
        ),
      }));
    }
  },
}));

if (typeof window !== "undefined") {
  window.__chatStore = useChatStore;
}


