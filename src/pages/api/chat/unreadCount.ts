import type { APIRoute } from "astro";
import { turso } from "../../../lib/turso";

export const GET: APIRoute = async ({ locals }) => {
  if (!locals.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
    });
  }

  try {
    const result = await turso.execute({
      sql: `
        SELECT COUNT(DISTINCT 
          CASE 
            WHEN receiver_id = ? THEN sender_id 
            ELSE receiver_id 
          END
        ) as count
        FROM messages 
        WHERE receiver_id = ? AND read_at IS NULL
      `,
      args: [locals.user.id, locals.user.id],
    });

    return new Response(
      JSON.stringify({ count: result.rows[0].count }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: "Failed to fetch unread count" }),
      { status: 500 }
    );
  }
};
