import { turso } from "src/lib/turso";
import type { APIRoute } from "astro";
import { sanitizeInput, sanitizeObject } from "src/lib/sanitize";

export const GET: APIRoute = async ({ request, locals }) => {
  try {
    const user = locals.user;
    if (!user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { 
          status: 401,
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-store",
          },
        }
      );
    }

    const url = new URL(request.url);
    const senderId = sanitizeInput(url.searchParams.get("senderId")?.trim());
    const receiverId = sanitizeInput(
      url.searchParams.get("receiverId")?.trim()
    );

    if (!senderId || !receiverId) {
      return new Response(
        JSON.stringify({
          error: "Missing required parameters",
          debug: {
            receivedSenderId: senderId || null,
            receivedReceiverId: receiverId || null,
            urlParams: Object.fromEntries(url.searchParams),
          },
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-store",
          },
        }
      );
    }

    // Verify that the current user is either the sender or receiver
    if (user.id !== senderId && user.id !== receiverId) {
      return new Response(
        JSON.stringify({ error: "Unauthorized access to messages" }),
        { 
          status: 403,
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-store",
          },
        }
      );
    }

    const messages = await turso.execute({
      sql: `
        SELECT * FROM messages 
        WHERE (sender_id = ? AND receiver_id = ?) 
        OR (sender_id = ? AND receiver_id = ?)
        ORDER BY timestamp ASC
      `,
      args: [senderId, receiverId, receiverId, senderId],
    });

    // Sanitize the output messages
    const sanitizedMessages = messages.rows.map((msg) => sanitizeObject(msg));

    return new Response(JSON.stringify({ messages: sanitizedMessages }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    console.error("API Error:", error);
    return new Response(
      JSON.stringify({
        error: "Internal Server Error",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }
};
