import { conversationService } from "../services/conversation.service.js";
import { messageService } from "../services/message.service.js";

/**
 * Controller: GET /api/messages/users
 * Retrieves contacts enriched with conversation metadata.
 */
export const getUsersForSidebar = async (req, res) => {
  try {
    const loggedInUserId = req.user._id;
    const contacts = await conversationService.getContactsWithConversations(loggedInUserId);
    res.status(200).json(contacts);
  } catch (error) {
    console.error("Error in getUsersForSidebar controller:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * Controller: GET /api/messages/:id
 * Supports both cursor-based (?cursor=<timestamp>&limit=30) and offset-based (?page=1&limit=30) pagination.
 */
export const getMessages = async (req, res) => {
  try {
    const { id: targetId } = req.params;
    const myId = req.user._id;
    const { page, limit, cursor, before } = req.query;

    const result = await messageService.getMessagesHistory({
      myId,
      targetId,
      page,
      limit,
      cursor,
      before,
    });

    res.status(200).json(result);
  } catch (error) {
    console.error("Error in getMessages controller:", error.message);
    const status = error.message.includes("Invalid") ? 400 : 500;
    res.status(status).json({ message: error.message || "Internal server error" });
  }
};

/**
 * Controller: POST /api/messages/send/:id
 * Handles message creation, attachment storage, and real-time dispatch.
 */
export const sendMessage = async (req, res) => {
  try {
    const { text, image } = req.body;
    const { id: targetId } = req.params;
    const senderId = req.user._id;

    const newMessage = await messageService.sendMessage({
      senderId,
      targetId,
      text,
      image,
    });

    res.status(201).json(newMessage);
  } catch (error) {
    console.error("Error in sendMessage controller:", error.message);
    const status = error.message.includes("must contain") || error.message.includes("Invalid") ? 400 : 500;
    res.status(status).json({ message: error.message || "Internal server error" });
  }
};


