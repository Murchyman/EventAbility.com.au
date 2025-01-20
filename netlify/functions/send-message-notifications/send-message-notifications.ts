import type { Handler } from "@netlify/functions";
import { createClient } from "libsql-stateless-easy";

const BUFFER_MINUTES = 20; // Messages newer than this won't trigger notifications
const NOTIFICATION_WINDOW_HOURS = 24; // Don't send more than one notification per user in this window
const MAILJET_API_KEY = process.env.MAILJET_API_KEY || "";
const MAILJET_API_SECRET = process.env.MAILJET_API_SECRET || "";

// Base64 encode the API key and secret for basic auth
const authHeader = Buffer.from(`${MAILJET_API_KEY}:${MAILJET_API_SECRET}`).toString('base64');

export const handler: Handler = async (event, context) => {
  const turso = createClient({
    url: process.env.TURSO_HTTP_URL || "",
    authToken: process.env.TURSO_AUTH_TOKEN || "",
  });

  try {
    console.log("Function started");
    const now = new Date();
    const cutoffTime = new Date(now.getTime() - BUFFER_MINUTES * 60 * 1000).toISOString();
    const notificationWindowStart = new Date(now.getTime() - NOTIFICATION_WINDOW_HOURS * 60 * 60 * 1000).toISOString();

    // Get users with unread messages who haven't received a notification in the last 24 hours
    const result = await turso.execute({
      sql: `
        WITH UnreadMessages AS (
          SELECT DISTINCT m.receiver_id, m.id as message_id
          FROM messages m
          LEFT JOIN message_notifications mn ON mn.message_id = m.id
          WHERE m.read_at IS NULL
          AND m.timestamp <= ?
          AND m.timestamp >= datetime('now', '-7 days')
          AND mn.id IS NULL
        )
        SELECT 
          u.id as user_id,
          u.email,
          p.first_name,
          COUNT(DISTINCT m.sender_id) as unique_senders,
          GROUP_CONCAT(DISTINCT prof.first_name) as sender_names,
          GROUP_CONCAT(um.message_id) as message_ids
        FROM UnreadMessages um
        JOIN user u ON um.receiver_id = u.id
        JOIN profile p ON u.id = p.user_id
        JOIN messages m ON um.message_id = m.id
        JOIN user sender ON m.sender_id = sender.id
        JOIN profile prof ON sender.id = prof.user_id
        WHERE NOT EXISTS (
          SELECT 1 FROM message_notifications mn
          WHERE mn.user_id = u.id
          AND mn.sent_at > ?
        )
        GROUP BY u.id, u.email, p.first_name
        HAVING COUNT(um.message_id) > 0
        LIMIT 50
      `,
      args: [cutoffTime, notificationWindowStart],
    });

    console.log("Query results:", {
      userCount: result.rows.length,
      firstRow: result.rows[0],
    });

    if (result.rows.length === 0) {
      await turso.close();
      return {
        statusCode: 200,
        body: JSON.stringify({ message: "No notifications to send" }),
      };
    }

    // Process all users and wait for completion
    const emailPromises = await Promise.all(
      result.rows.map(async (user) => {
        try {
          console.log("Sending notification to:", {
            email: user.email,
            name: user.first_name,
            messageCount: user.total_messages
          });

          const response = await fetch('https://api.mailjet.com/v3.1/send', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Basic ${authHeader}`
            },
            body: JSON.stringify({
              Messages: [
                {
                  From: {
                    Email: "noreply@socialspot.com.au",
                    Name: "SocialSpot",
                  },
                  To: [{ Email: user.email }],
                  Subject: `New Messages Waiting for You on SocialSpot! 💌`,
                  HTMLPart: `
                  <!DOCTYPE html>
                  <html>
                    <body style="margin: 0; padding: 0; font-family: 'Arial', sans-serif;">
                      <table role="presentation" style="width: 100%; border-collapse: collapse;">
                        <tr>
                          <td style="padding: 20px;">
                            <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #C5FFE6; border: 3px solid black; border-radius: 12px; box-shadow: 7px 7px 0 rgba(0,0,0,1);">
                              <tr>
                                <td style="padding: 30px;">
                                  <h1 style="margin: 0 0 20px; font-size: 28px; font-weight: bold; color: black;">Hey ${user.first_name}! 💌</h1>
                                  <p style="margin: 0 0 20px; font-size: 18px; line-height: 1.5; color: black;">
                                    <strong>You've got mail!</strong> ${user.unique_senders} ${user.unique_senders === 1 ? 'person has sent you a message' : 'people have sent you messages'}.
                                  </p>
                                  <p style="margin: 0 0 30px; font-size: 16px; line-height: 1.5; color: black;">
                                    Messages waiting from:<br>
                                    <strong>${(user.sender_names as string || '').split(',').join(', ')}</strong>
                                  </p>
                                  <div style="text-align: center;">
                                    <a href="https://socialspot.com.au/chats" 
                                       style="display: inline-block; background-color: black; color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 18px;">
                                       Read Your Messages →
                                     </a>
                                  </div>
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                      </table>
                    </body>
                  </html>`,
                },
              ],
            })
          });

          const emailResponse = await response.json();
          console.log("Email sent successfully:", {
            userId: user.user_id,
            emailResponse: response.status
          });

          // Record notifications for all messages
          const messageIds = (user.message_ids as string || '').split(',').filter(Boolean);
          for (const messageId of messageIds) {
            await turso.execute({
              sql: `INSERT INTO message_notifications (user_id, message_id) VALUES (?, ?)`,
              args: [user.user_id, messageId],
            });
          }

          console.log("Recorded notifications in database:", {
            userId: user.user_id,
            messageCount: messageIds.length
          });

          return { success: true, user_id: user.user_id };
        } catch (error) {
          console.error(`Failed to process user ${user.user_id}:`, error);
          return { success: false, user_id: user.user_id, error };
        }
      })
    );

    await turso.close();

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        processed: emailPromises.length,
        results: emailPromises
      }),
    };
  } catch (error) {
    console.error("Error in send-message-notifications:", error);
    await turso.close();
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal server error" }),
    };
  }
}; 