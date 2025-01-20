import type { APIRoute } from "astro";
import { turso } from "src/lib/turso";import { getSignedUrlForFile } from "src/lib/s3";

export const GET: APIRoute = async ({ locals }) => {
  try {
    if (!locals.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
      });
    }

    const result = await turso.execute({
      sql: `
        WITH LatestMessages AS (
          SELECT 
            CASE 
              WHEN sender_id = ? THEN receiver_id 
              ELSE sender_id 
            END as chat_partner_id,
            content as last_message,
            timestamp,
            ROW_NUMBER() OVER (
              PARTITION BY 
                CASE 
                  WHEN sender_id = ? THEN receiver_id 
                  ELSE sender_id 
                END 
              ORDER BY timestamp DESC
            ) as rn
          FROM messages 
          WHERE sender_id = ? OR receiver_id = ?
        )
        SELECT 
          p.user_id,
          p.first_name,
          lm.last_message,
          lm.timestamp
        FROM LatestMessages lm
        JOIN profile p ON p.user_id = lm.chat_partner_id
        WHERE lm.rn = 1
        ORDER BY lm.timestamp DESC
        LIMIT 5
      `,
      args: [
        locals.user.id,
        locals.user.id,
        locals.user.id,
        locals.user.id,
      ],
    });

    // Get profile pictures for all chat partners
    const chats = await Promise.all(
      result.rows.map(async (row) => {
        const profilePicture = await getSignedUrlForFile(
          String(row.user_id),
          "profile-pictures"
        );
        return {
          ...row,
          profile_picture: profilePicture,
        };
      })
    );

    return new Response(JSON.stringify({ chats }), {
      status: 200,
    });
  } catch (error) {
    console.error("Recent chats error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to fetch recent chats" }),
      { status: 500 }
    );
  }
};
