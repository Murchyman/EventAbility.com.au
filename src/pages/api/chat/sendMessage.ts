import type { APIRoute } from "astro";
import { turso } from "src/lib/turso";
import { broadcastMessage } from "src/lib/chatUtils";
import { sanitizeInput } from "src/lib/sanitize";

export const config = {
  runtime: "edge",
};

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const formData = await request.formData();
    const senderId = locals.user?.id;
    const receiverId = sanitizeInput(formData.get("receiverId") as string);
    const content = sanitizeInput(formData.get("content") as string);

    if (!senderId || !receiverId || !content) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400 }
      );
    }

    // Save message to database
    await turso.execute({
      sql: "INSERT INTO messages (sender_id, receiver_id, content, timestamp) VALUES (?, ?, ?, ?)",
      args: [senderId, receiverId, content, new Date().toISOString()],
    });

    // Broadcast via Pusher
    const room = [senderId, receiverId].sort().join("-");
    await broadcastMessage(room, {
      type: "chat",
      sender_id: senderId,
      content: content,
      timestamp: new Date().toISOString(),
    });

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (error) {
    console.error("Send message error:", error);
    return new Response(JSON.stringify({ error: "Failed to send message" }), {
      status: 500,
    });
  }
};
