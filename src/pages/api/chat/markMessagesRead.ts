import type { APIRoute } from "astro";
import { turso } from "../../../lib/turso";

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const user = locals.user;
    if (!user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const senderId = formData.get("senderId")?.toString();

    if (!senderId) {
      return new Response(
        JSON.stringify({ error: "Missing required parameters" }),
        { status: 400 }
      );
    }

    // Mark all unread messages from sender to receiver as read
    // Only mark messages where the current user is the receiver
    await turso.execute({
      sql: `
        UPDATE messages 
        SET read_at = ? 
        WHERE sender_id = ? 
        AND receiver_id = ? 
        AND read_at IS NULL
      `,
      args: [new Date().toISOString(), senderId, user.id],
    });
    return new Response(JSON.stringify({ success: true }));
  } catch (error) {
    console.error("Error marking messages as read:", error);
    return new Response(
      JSON.stringify({ error: "Failed to mark messages as read" }),
      { status: 500 }
    );
  }
};