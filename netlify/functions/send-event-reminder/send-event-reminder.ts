import type { Handler } from "@netlify/functions";
import { createClient } from "libsql-stateless-easy";

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
    // Calculate the time window for events starting in ~24 hours
    const startTime = new Date(now.getTime() + 23 * 60 * 60 * 1000); // 23 hours from now
    const endTime = new Date(now.getTime() + 25 * 60 * 60 * 1000);   // 25 hours from now

    console.log("Time range:", { startTime: startTime.toISOString(), endTime: endTime.toISOString() });

    // Get all participants from upcoming events who haven't received a reminder
    const result = await turso.execute({
      sql: `
        SELECT 
          e.event_id, e.name as event_name, e.location,
          e.start_time, e.end_time,
          u.email, p.first_name, p.user_id
        FROM events e
        JOIN event_participants ep ON e.event_id = ep.event_id
        JOIN user u ON ep.user_id = u.id
        JOIN profile p ON u.id = p.user_id
        WHERE e.start_time BETWEEN ? AND ?
        AND NOT EXISTS (
          SELECT 1 FROM event_reminders er 
          WHERE er.event_id = e.event_id 
          AND er.user_id = ep.user_id
        )
        LIMIT 50
      `,
      args: [startTime.toISOString(), endTime.toISOString()],
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
          message: "No reminders to send",
          timeRange: { startTime, endTime }
        }),
      };
    }

    // Process all participants
    const emailPromises = await Promise.all(
      result.rows.map(async (participant) => {
        try {
          const eventStartTime = new Date(participant.start_time as string);
          const formattedStartTime = eventStartTime.toLocaleString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          });

          console.log("Sending reminder to:", {
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
                  Subject: `Reminder: ${participant.event_name} is tomorrow!`,
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
                                  <h1 style="margin: 0 0 20px; font-size: 28px; font-weight: bold; color: black;">Hi ${participant.first_name}! 🎉</h1>
                                  <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.5; color: black;">This is a friendly reminder that ${participant.event_name} is happening tomorrow!</p>
                                  <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
                                    <h2 style="margin: 0 0 15px; color: black;">Event Details:</h2>
                                    <p style="margin: 0 0 10px; color: black;"><strong>When:</strong> ${formattedStartTime}</p>
                                    <p style="margin: 0 0 10px; color: black;"><strong>Where:</strong> ${participant.location}</p>
                                  </div>
                                  <p style="margin: 0 0 30px; font-size: 16px; line-height: 1.5; color: black;">We're looking forward to seeing you there!</p>
                                  <div style="text-align: center;">
                                    <a href="https://eventability.com.au/events/${participant.event_id}" 
                                       style="display: inline-block; background-color: black; color: white; padding: 24px 40px; text-decoration: none; border-radius: 4px; font-weight: bold; font-size: 16px;">
                                      View Event Details
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
            sql: `INSERT INTO event_reminders (event_id, user_id) VALUES (?, ?)`,
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
    console.error("Error in send-event-reminder:", error);
    await turso.close();
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal server error" }),
    };
  }
}; 