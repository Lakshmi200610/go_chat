import mongoose from "mongoose";
import Message from "../models/Message.js";
import Conversation from "../models/Conversation.js";
import { conversationService } from "./conversation.service.js";
import cloudinary from "../lib/cloudinary.js";
import { io, isUserOnline } from "../lib/socket.js";
import { env } from "../lib/env.js";

class MessageService {
  /**
   * Creates, stores, and broadcasts a new message in real-time.
   */
  async sendMessage({ senderId, targetId, text, image }) {
    if (!text?.trim() && !image) {
      throw new Error("Message must contain text or an image");
    }

    if (!mongoose.Types.ObjectId.isValid(targetId)) {
      throw new Error("Invalid recipient ID");
    }

    // 1. Resolve or create Conversation
    let conversation = await Conversation.findOne({
      participants: { $all: [senderId, targetId], $size: 2 },
    });

    if (!conversation) {
      conversation = await conversationService.getConversationById(targetId, senderId);
    }

    if (!conversation) {
      conversation = await conversationService.getOrCreateConversation(senderId, targetId);
    }

    const receiverId = conversation.participants.find(
      (p) => p.toString() !== senderId.toString()
    );

    // 2. Handle Image Upload via Cloudinary
    let imageUrl = "";
    if (image) {
      if (!env.CLOUDINARY_CLOUD_NAME) {
        console.log("[Cloudinary Mock] Saving base64 message image attachment");
        imageUrl = image;
      } else {
        const uploadResponse = await cloudinary.uploader.upload(image, {
          folder: "go_chat/messages",
        });
        imageUrl = uploadResponse.secure_url;
      }
    }

    // 3. Persist Message Document
    const isReceiverOnline = receiverId ? isUserOnline(receiverId) : false;

    const newMessage = new Message({
      conversationId: conversation._id,
      senderId,
      receiverId,
      text: text?.trim() || "",
      image: imageUrl,
      status: isReceiverOnline ? "delivered" : "sent",
      readBy: [senderId],
    });

    await newMessage.save();

    // 4. Update Conversation Metadata atomically
    const updatedConversation = await conversationService.updateLastMessage(
      conversation._id,
      newMessage,
      receiverId
    );

    const receiverUnreadCount =
      (updatedConversation?.unreadCounts &&
        (updatedConversation.unreadCounts instanceof Map
          ? updatedConversation.unreadCounts.get(receiverId?.toString())
          : updatedConversation.unreadCounts[receiverId?.toString()])) || 1;

    // 5. Emit real-time Socket.IO events
    if (receiverId) {
      io.to(receiverId.toString()).emit("newMessage", newMessage);
      io.to(receiverId.toString()).emit("conversationUpdated", {
        conversationId: conversation._id,
        senderId,
        lastMessage: newMessage,
        lastMessageTimestamp: newMessage.createdAt,
        unreadCount: receiverUnreadCount,
      });
    }

    io.to(senderId.toString()).emit("conversationUpdated", {
      conversationId: conversation._id,
      senderId,
      lastMessage: newMessage,
      lastMessageTimestamp: newMessage.createdAt,
      unreadCount: 0,
    });

    return newMessage;
  }

  /**
   * Retrieves message history supporting both cursor-based and offset-based pagination.
   */
  async getMessagesHistory({ myId, targetId, page = 1, limit = 30, before, cursor }) {
    if (!mongoose.Types.ObjectId.isValid(targetId)) {
      throw new Error("Invalid contact or conversation ID");
    }

    const pageSize = Math.min(100, Math.max(1, parseInt(limit, 10) || 30));

    // 1. Resolve conversation
    let conversation = await Conversation.findOne({
      participants: { $all: [myId, targetId], $size: 2 },
    });

    if (!conversation) {
      conversation = await conversationService.getConversationById(targetId, myId);
    }

    // Handle legacy message linking if conversation not yet created
    if (!conversation) {
      const legacyCount = await Message.countDocuments({
        $or: [
          { senderId: myId, receiverId: targetId },
          { senderId: targetId, receiverId: myId },
        ],
      });

      if (legacyCount > 0) {
        conversation = await conversationService.getOrCreateConversation(myId, targetId);
        await Message.updateMany(
          {
            $or: [
              { senderId: myId, receiverId: targetId },
              { senderId: targetId, receiverId: myId },
            ],
            conversationId: { $exists: false },
          },
          { $set: { conversationId: conversation._id } }
        );
      } else {
        return {
          messages: [],
          totalMessages: 0,
          totalPages: 0,
          currentPage: page,
          hasMore: false,
          nextCursor: null,
          conversationId: null,
        };
      }
    }

    const totalMessages = await Message.countDocuments({
      conversationId: conversation._id,
    });

    const activeCursor = cursor || before;
    let query = { conversationId: conversation._id };

    if (activeCursor) {
      // Cursor pagination: fetch messages created before the cursor timestamp
      const cursorDate = new Date(activeCursor);
      if (!isNaN(cursorDate.getTime())) {
        query.createdAt = { $lt: cursorDate };
      }
    }

    let rawMessages;
    let hasMore = false;

    if (activeCursor) {
      // Use compound index { conversationId: 1, createdAt: -1 }
      rawMessages = await Message.find(query)
        .select("conversationId senderId receiverId text image status readBy createdAt")
        .sort({ createdAt: -1 })
        .limit(pageSize)
        .lean();

      if (rawMessages.length > 0) {
        const oldestMsgInSlice = rawMessages[rawMessages.length - 1];
        const remainingCount = await Message.countDocuments({
          conversationId: conversation._id,
          createdAt: { $lt: oldestMsgInSlice.createdAt },
        });
        hasMore = remainingCount > 0;
      }
    } else {
      // Offset pagination fallback
      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const skip = (pageNum - 1) * pageSize;

      rawMessages = await Message.find(query)
        .select("conversationId senderId receiverId text image status readBy createdAt")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageSize)
        .lean();

      hasMore = skip + rawMessages.length < totalMessages;
    }

    // Reverse to chronological order (oldest to newest for the requested slice)
    const messages = rawMessages.reverse();
    const nextCursor = rawMessages.length > 0 ? rawMessages[0].createdAt : null;

    // Reset unread count for current user
    await conversationService.resetUnreadCount(conversation._id, myId);

    // Mark messages sent to current user as read
    await Message.updateMany(
      {
        conversationId: conversation._id,
        receiverId: myId,
        status: { $ne: "read" },
      },
      {
        $set: { status: "read" },
        $addToSet: { readBy: myId },
      }
    );

    return {
      messages,
      totalMessages,
      totalPages: Math.ceil(totalMessages / pageSize),
      currentPage: parseInt(page, 10) || 1,
      hasMore,
      nextCursor,
      conversationId: conversation._id,
    };
  }

  /**
   * Marks unread messages in a conversation as read and broadcasts real-time read receipts.
   */
  async markMessagesAsRead(conversationId, readerId) {
    if (!mongoose.Types.ObjectId.isValid(conversationId) || !mongoose.Types.ObjectId.isValid(readerId)) {
      return { success: false };
    }

    const updateResult = await Message.updateMany(
      {
        conversationId,
        receiverId: readerId,
        status: { $ne: "read" },
      },
      {
        $set: { status: "read" },
        $addToSet: { readBy: readerId },
      }
    );

    // Reset unread count
    await conversationService.resetUnreadCount(conversationId, readerId);

    const conversation = await Conversation.findById(conversationId);
    if (conversation) {
      // Broadcast read receipt to conversation room and to each other participant
      const payload = {
        conversationId: conversation._id.toString(),
        readerId: readerId.toString(),
        readAt: new Date().toISOString(),
      };

      io.to(conversationId.toString()).emit("messagesRead", payload);

      conversation.participants.forEach((p) => {
        const participantId = p.toString();
        if (participantId !== readerId.toString()) {
          io.to(participantId).emit("messagesRead", payload);
        }
      });
    }

    return { success: true, count: updateResult.modifiedCount };
  }
}

export const messageService = new MessageService();

