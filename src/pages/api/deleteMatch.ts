import type { APIRoute } from "astro";
import { turso } from "src/lib/turso";

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
    const user_id_2 = formData.get("user_id_2") as string;

    if (!user_id_2) {
      return new Response(
        JSON.stringify({
          status: "error",
          error: "Missing required fields"
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json"
          }
        }
      );
    }

    // First verify match exists and user is part of it
    const matchExists = await turso.execute({
      sql: `SELECT id FROM matches 
            WHERE ((user_id_1 = ? AND user_id_2 = ?) 
            OR (user_id_1 = ? AND user_id_2 = ?))
            AND status = 'matched'`,
      args: [user.id, user_id_2, user_id_2, user.id]
    });

    if (matchExists.rows.length === 0) {
      return new Response(
        JSON.stringify({
          status: "error",
          error: "Match not found or already deleted"
        }),
        {
          status: 404,
          headers: {
            "Content-Type": "application/json"
          }
        }
      );
    }

    // Mark all messages between these users as read
    await turso.execute({
      sql: `UPDATE messages 
            SET read_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
            WHERE read_at IS NULL 
            AND ((sender_id = ? AND receiver_id = ?) 
            OR (sender_id = ? AND receiver_id = ?))`,
      args: [user.id, user_id_2, user_id_2, user.id]
    });

    // Update match status to deleted
    const result = await turso.execute({
      sql: `UPDATE matches 
            SET status = 'deleted' 
            WHERE (user_id_1 = ? AND user_id_2 = ?) 
            OR (user_id_1 = ? AND user_id_2 = ?)`,
      args: [user.id, user_id_2, user_id_2, user.id]
    });

    if (result.rowsAffected === 0) {
      throw new Error("No rows were updated");
    }

    return new Response(
      JSON.stringify({
        status: "success",
        message: "Match deleted successfully"
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json"
        }
      }
    );
  } catch (error) {
    console.error("Delete match error:", error);
    return new Response(
      JSON.stringify({
        status: "error",
        error: (error as Error).message || "Failed to delete match"
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json"
        }
      }
    );
  }
};