import type { Handler } from "@netlify/functions";
import { createClient } from "libsql-stateless-easy";

const BUFFER_MINUTES = 5;
const MAILJET_API_KEY = process.env.MAILJET_API_KEY || "";
const MAILJET_API_SECRET = process.env.MAILJET_API_SECRET || "";

// Base64 encode the API key and secret for basic auth
const authHeader = Buffer.from(`${MAILJET_API_KEY}:${MAILJET_API_SECRET}`).toString('base64');

export const handler: Handler = async (event, context) => {
  // This function is triggered hourly to send follow-up emails to event participants
  // It checks for events that ended between 1 hour and 1 hour + 5 minutes ago
  // The 5 minute buffer (BUFFER_MINUTES) helps avoid missing events due to timing/scheduling variations
  // 
  // Flow:
  // 1. Gets events that ended between (now - 65 mins) and (now + 5 mins)
  // 2. Finds participants who haven't received a follow-up email yet by checking event_followup_sent table
  // 3. Sends follow-up emails and records in event_followup_sent to prevent duplicate sends
  //
  // Example timeline:
  // Event ends at 2:00 PM
  // Function runs at 3:00 PM (checks 1:55 PM - 3:05 PM window)
  // Sends follow-up emails to participants who aren't in event_followup_sent
  // Records sends in event_followup_sent table
  // Initialize Turso client outside try block
  const turso = createClient({
    url: process.env.TURSO_HTTP_URL || "",
    authToken: process.env.TURSO_AUTH_TOKEN || "",
  });

  try {
    console.log("Function started");
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - (60 + BUFFER_MINUTES) * 60 * 1000);
    const startTime = oneHourAgo.toISOString();
    const endTime = new Date(now.getTime() + BUFFER_MINUTES * 60 * 1000).toISOString();

    console.log("Time range:", { startTime, endTime });

    // Get all participants from recently ended events
    const result = await turso.execute({
      sql: `
        SELECT 
          e.event_id, e.name as event_name, e.location,
          u.email, p.first_name, p.user_id,
          ep.joined_at,
          e.end_time
        FROM events e
        JOIN event_participants ep ON e.event_id = ep.event_id
        JOIN user u ON ep.user_id = u.id
        JOIN profile p ON u.id = p.user_id
        WHERE e.end_time BETWEEN ? AND ?
        AND NOT EXISTS (
          SELECT 1 FROM event_followup_sent efs 
          WHERE efs.event_id = e.event_id 
          AND efs.user_id = ep.user_id
        )
        LIMIT 50
      `,
      args: [startTime, endTime],
    });

    console.log("Query results:", {
      rowCount: result.rows.length,
      firstRow: result.rows[0],
      timeRange: { startTime, endTime }
    });

    if (result.rows.length === 0) {
      await turso.close();
      return {
        statusCode: 200,
        body: JSON.stringify({ 
          message: "No emails to send",
          timeRange: { startTime, endTime }
        }),
      };
    }

    // Process all participants and wait for completion
    const emailPromises = await Promise.all(
      result.rows.map(async (participant) => {
        try {
          console.log("Sending email to:", {
            email: participant.email,
            name: participant.first_name,
            eventName: participant.event_name
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
                    Email: "noreply@eventability.com.au",
                    Name: "Event Ability",
                  },
                  To: [{ Email: participant.email }],
                  Subject: `Reconnect with people you met at ${participant.event_name}!`,
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
                                  <h1 style="margin: 0 0 20px; font-size: 28px; font-weight: bold; color: black;">Hi ${participant.first_name}! 👋</h1>
                                  <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.5; color: black;">We hope you had a great time at ${participant.event_name}!</p>
                                  <p style="margin: 0 0 30px; font-size: 16px; line-height: 1.5; color: black;">Made some connections? Want to stay in touch with the awesome people you met? Check out who else attended and connect with them now!</p>
                                  <div style="text-align: center;">
                                    <a href="https://socialspot.com.au/events/${participant.event_id}/participants" 
                                       style="display: inline-block; background-color: black; color: white; padding: 24px 40px; text-decoration: none; border-radius: 4px; font-weight: bold; font-size: 16px;">
                                      Reconnect with Attendees
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
            userId: participant.user_id,
            emailResponse: response.status
          });

          // Record success in database
          await turso.execute({
            sql: `INSERT INTO event_followup_sent (event_id, user_id) VALUES (?, ?)`,
            args: [participant.event_id, participant.user_id],
          });

          console.log("Recorded in database:", {
            eventId: participant.event_id,
            userId: participant.user_id
          });

          return { success: true, user_id: participant.user_id };
        } catch (error) {
          console.error(`Failed to process participant ${participant.user_id}:`, error);
          return { success: false, user_id: participant.user_id, error };
        }
      })
    );

    // Close the client after all operations are complete
    await turso.close();

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        processed: emailPromises.length,
        results: emailPromises,
        timeRange: { startTime, endTime }
      }),
    };
  } catch (error) {
    console.error("Error in send-event-followup:", error);
    // Close the client in case of error
    await turso.close();
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal server error" }),
    };
  }
}; 