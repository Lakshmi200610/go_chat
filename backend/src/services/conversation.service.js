import mongoose from "mongoose";
import User from "../models/User.js";
import Conversation from "../models/Conversation.js";

class ConversationService {
  /**
   * Atomically finds or initializes a 1-on-1 conversation between two users.
   */
  async getOrCreateConversation(userAId, userBId) {
    if (!mongoose.Types.ObjectId.isValid(userAId) || !mongoose.Types.ObjectId.isValid(userBId)) {
      throw new Error("Invalid participant user ID");
    }

    let conversation = await Conversation.findOne({
      participants: { $all: [userAId, userBId], $size: 2 },
    });

    if (!conversation) {
      conversation = new Conversation({
        participants: [userAId, userBId],
        unreadCounts: new Map([
          [userAId.toString(), 0],
          [userBId.toString(), 0],
        ]),
      });
      await conversation.save();
    }

    return conversation;
  }

  /**
   * Finds a conversation by its direct ID, ensuring the requesting user is a participant.
   */
  async getConversationById(conversationId, userId) {
    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      return null;
    }

    return await Conversation.findOne({
      _id: conversationId,
      participants: userId,
    });
  }

  /**
   * Retrieves all users for the sidebar enriched with conversation metadata.
   * Runs in a single indexed query to completely eliminate N+1 database queries.
   */
  async getContactsWithConversations(loggedInUserId) {
    // 1. Fetch all other registered users with lean projection
    const users = await User.find({ _id: { $ne: loggedInUserId } })
      .select("fullName email profilePic")
      .lean();

    // 2. Fetch all active conversations for the logged-in user with populated lastMessage
    const conversations = await Conversation.find({
      participants: loggedInUserId,
    })
      .select("participants lastMessage lastMessageTimestamp unreadCounts updatedAt")
      .populate({
        path: "lastMessage",
        select: "text image senderId createdAt status",
      })
      .lean();

    // 3. Fast O(1) in-memory lookup map by partner ID
    const conversationMap = new Map();
    conversations.forEach((conv) => {
      const partnerId = conv.participants.find(
        (p) => p.toString() !== loggedInUserId.toString()
      );
      if (partnerId) {
        const unreadCount =
          (conv.unreadCounts && conv.unreadCounts[loggedInUserId.toString()]) ||
          (conv.unreadCounts instanceof Map
            ? conv.unreadCounts.get(loggedInUserId.toString())
            : 0) ||
          0;

        conversationMap.set(partnerId.toString(), {
          conversationId: conv._id,
          lastMessage: conv.lastMessage || null,
          lastMessageTimestamp: conv.lastMessageTimestamp || conv.updatedAt,
          unreadCount,
        });
      }
    });

    // 4. Enrich users with metadata
    const enrichedUsers = users.map((user) => {
      const convData = conversationMap.get(user._id.toString());
      return {
        ...user,
        conversationId: convData?.conversationId || null,
        lastMessage: convData?.lastMessage || null,
        lastMessageTimestamp: convData?.lastMessageTimestamp || null,
        unreadCount: convData?.unreadCount || 0,
      };
    });

    // 5. Sort: contacts with latest conversation activity first
    enrichedUsers.sort((a, b) => {
      if (a.lastMessageTimestamp && b.lastMessageTimestamp) {
        return new Date(b.lastMessageTimestamp) - new Date(a.lastMessageTimestamp);
      }
      if (a.lastMessageTimestamp) return -1;
      if (b.lastMessageTimestamp) return 1;
      return a.fullName.localeCompare(b.fullName);
    });

    return enrichedUsers;
  }

  /**
   * Updates last message reference and increments unread count for the receiver.
   */
  async updateLastMessage(conversationId, messageDoc, receiverId) {
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) return null;

    conversation.lastMessage = messageDoc._id;
    conversation.lastMessageTimestamp = messageDoc.createdAt;

    if (!conversation.unreadCounts) {
      conversation.unreadCounts = new Map();
    }

    if (receiverId) {
      const currentUnread =
        (conversation.unreadCounts instanceof Map
          ? conversation.unreadCounts.get(receiverId.toString())
          : conversation.unreadCounts[receiverId.toString()]) || 0;

      const nextUnread = currentUnread + 1;
      if (conversation.unreadCounts instanceof Map) {
        conversation.unreadCounts.set(receiverId.toString(), nextUnread);
      } else {
        conversation.unreadCounts[receiverId.toString()] = nextUnread;
      }
    }

    await conversation.save();
    return conversation;
  }

  /**
   * Resets the unread count for a given user in a conversation.
   */
  async resetUnreadCount(conversationId, userId) {
    const conversation = await Conversation.findById(conversationId);
    if (!conversation || !conversation.unreadCounts) return;

    const currentUnread =
      conversation.unreadCounts instanceof Map
        ? conversation.unreadCounts.get(userId.toString())
        : conversation.unreadCounts[userId.toString()];

    if (currentUnread > 0) {
      if (conversation.unreadCounts instanceof Map) {
        conversation.unreadCounts.set(userId.toString(), 0);
      } else {
        conversation.unreadCounts[userId.toString()] = 0;
      }
      await conversation.save();
    }
  }
}

export const conversationService = new ConversationService();
