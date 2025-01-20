import type { APIRoute } from "astro";
import { turso } from "src/lib/turso";
import Mailjet from "node-mailjet";

const mailjet = new Mailjet({
  apiKey: import.meta.env.MAILJET_API_KEY,
  apiSecret: import.meta.env.MAILJET_API_SECRET,
});

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const formData = await request.formData();
    const user_id_1 = locals.user?.id;
    const user_id_2 = formData.get("user_id_2") as string;
    const event_id = formData.get("event_id") as string;
    if (!user_id_1 || !user_id_2 || !event_id) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400 }
      );
    }

    // Check if a connection already exists in either direction
    const existingConnection = await turso.execute({
      sql: `SELECT * FROM matches 
            WHERE ((user_id_1 = ? AND user_id_2 = ?) 
            OR (user_id_1 = ? AND user_id_2 = ?))
            AND event_id = ?`,
      args: [user_id_1, user_id_2, user_id_2, user_id_1, event_id],
    });

    if (existingConnection.rows.length > 0) {
      const connection = existingConnection.rows[0];

      if (
        (connection.user_id_1 === user_id_2 && connection.user_id_2 === user_id_1) ||
        (connection.status === "pending" && connection.user_id_1 !== user_id_1)
      ) {
        await turso.execute({
          sql: `UPDATE matches 
                SET status = 'matched', 
                    matched_at = ?
                WHERE id = ?`,
          args: [new Date().toISOString(), connection.id],
        });

        // Send response immediately
        const response = new Response(
          JSON.stringify({ status: "matched", message: "You're now connected!" }),
          { status: 200 }
        );

        // Get both users and event details for email asynchronously
        const [user1Result, user2Result, eventResult] = await Promise.all([
          turso.execute({
            sql: `SELECT u.email, p.first_name as name 
                  FROM user u 
                  JOIN profile p ON u.id = p.user_id 
                  WHERE u.id = ?`,
            args: [connection.user_id_1],
          }),
          turso.execute({
            sql: `SELECT u.email, p.first_name as name 
                  FROM user u 
                  JOIN profile p ON u.id = p.user_id 
                  WHERE u.id = ?`,
            args: [connection.user_id_2],
          }),
          turso.execute({
            sql: "SELECT name, location FROM events WHERE event_id = ?",
            args: [event_id],
          }),
        ]);

        const user1 = user1Result.rows[0];
        const user2 = user2Result.rows[0];
        const event = eventResult.rows[0];

        if (!user1 || !user2) {
          return new Response(
            JSON.stringify({ error: "User profile not found" }),
            { status: 404 }
          );
        }

        // Send email asynchronously - don't await
        mailjet
          .post("send", { version: "v3.1" })
          .request({
            Messages: [
              {
                From: {
                  Email: "noreply@socialspot.com.au",
                  Name: "SocialSpot",
                },
                To: [
                  {
                    Email: user1.email,
                  },
                ],
                Subject: `New Friend Connection at Social Spot! 🎉`,
                TextPart: `Great news! ${user2.name} from ${event.name} wants to connect with you!`,
                HTMLPart: `
<!DOCTYPE html>
<html>
  <body style="margin: 0; padding: 0; font-family: Arial, sans-serif;">
    <table role="presentation" style="width: 100%; border-collapse: collapse;">
      <tr>
        <td style="padding: 20px;">
          <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #E0B8FF; border: 3px solid black; border-radius: 8px; box-shadow: 7px 7px 0 rgba(0,0,0,1);">
            <tr>
              <td style="padding: 20px;">
                <h1>You've Made a New Friend! 🎉</h1>
                <p><strong>Connected With:</strong> ${user2.name}</p>
                <p><strong>Event:</strong> ${event.name}</p>
                <p>Someone you met at the event wants to stay in touch! Visit your connections page to start chatting and plan future meetups.</p>
                <div style="text-align: center; margin-top: 20px;">
                  <a href="https://socialspot.com.au/matches" 
                     style="display: inline-block; background-color: black; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">
                    View Connections
                  </a>
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
              `,
              },
            ],
          })
          .catch((err) => {
            console.error("Failed to send email:", err);
          });

        return response;
      }

      return new Response(
        JSON.stringify({
          status: "already_exists",
          message: "Connection request already sent",
        }),
        { status: 200 }
      );
    }

    // Create a new pending connection
    await turso.execute({
      sql: `INSERT INTO matches (user_id_1, user_id_2, event_id, status, created_at) 
            VALUES (?, ?, ?, 'pending', ?)`,
      args: [user_id_1, user_id_2, event_id, new Date().toISOString()],
    });

    return new Response(
      JSON.stringify({
        status: "pending",
        message: "Connection request sent",
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error("Match error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to process connection request" }),
      { status: 500 }
    );
  }
};
