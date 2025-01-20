import type { APIContext } from "astro";
import { turso } from "src/lib/turso";
import { stripe, calculateTotalAmount } from "src/lib/stripe";
import Mailjet from "node-mailjet";

export async function POST(context: APIContext): Promise<Response> {
  try {
    const formData = await context.request.formData();
    const user = context.locals.user;
    const eventId = formData.get("eventId");
    const paymentIntentId = formData.get("paymentIntentId");

    if (!user) {
      return new Response(null, {
        status: 302,
        headers: {
          Location: `/createprofile?event=${eventId}`,
        },
      });
    }

    // Validate event ID format
    if (!eventId || typeof eventId !== 'string' || !/^\d+$/.test(eventId)) {
      return new Response(null, {
        status: 302,
        headers: {
          Location: `/?error=Invalid+event+ID`,
        },
      });
    }

    // Check if user has a profile
    const result = await turso.execute({
      sql: "SELECT * FROM profile WHERE user_id = ?",
      args: [user.id],
    });

    if (result.rows.length === 0) {
      return new Response(null, {
        status: 302,
        headers: {
          Location: `/createprofile?event=${eventId}`,
        },
      });
    }

    // Get event details
    const eventResult = await turso.execute({
      sql: "SELECT * FROM events WHERE event_id = ?",
      args: [eventId],
    });

    const event = eventResult.rows[0];
    
    if (!event) {
      return new Response(null, {
        status: 302,
        headers: {
          Location: `/?error=Event+not+found`,
        },
      });
    }

    // Check if event has ended
    const eventEndTime = event.end_time as string;
    if (new Date(eventEndTime) < new Date()) {
      return new Response(null, {
        status: 302,
        headers: {
          Location: `/?error=Cannot+register+for+ended+events`,
        },
      });
    }

    // Check if event is at capacity
    if (event.max_participants !== null) {
      const participantCount = await turso.execute({
        sql: "SELECT COUNT(*) as count FROM event_participants WHERE event_id = ?",
        args: [eventId],
      });
      
      const count = participantCount.rows[0]?.count ?? 0;
      if (count >= event.max_participants) {
        return new Response(null, {
          status: 302,
          headers: {
            Location: `/events/${eventId}?error=Event+is+at+capacity`,
          },
        });
      }
    }

    // Check if user is already registered
    const existingRegistration = await turso.execute({
      sql: "SELECT 1 FROM event_participants WHERE event_id = ? AND user_id = ?",
      args: [eventId, user.id],
    });

    if (existingRegistration.rows.length > 0) {
      return new Response(null, {
        status: 302,
        headers: {
          Location: `/events/${eventId}?error=Already+registered`,
        },
      });
    }

    const eventCost = Number(event.cost ?? 0);
    const expectedTotal = calculateTotalAmount(eventCost);

    // If event has a cost, verify payment
    if (eventCost > 0) {
      if (!paymentIntentId) {
        return new Response(null, {
          status: 302,
          headers: {
            Location: `/events/${eventId}?error=Payment+required`,
          },
        });
      }

      try {
        // Verify payment intent
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId as string);
        
        // Verify payment status, amount, and currency
        if (paymentIntent.status !== 'succeeded' || 
            paymentIntent.amount !== expectedTotal ||
            paymentIntent.currency !== 'aud') {
          return new Response(null, {
            status: 302,
            headers: {
              Location: `/events/${eventId}?error=Invalid+payment`,
            },
          });
        }

        // Verify payment intent metadata matches this registration
        if (paymentIntent.metadata.eventId !== eventId || 
            paymentIntent.metadata.userId !== user.id ||
            Number(paymentIntent.metadata.baseCost) !== eventCost) {
          console.error('Payment intent metadata mismatch:', {
            paymentIntent: {
              eventId: paymentIntent.metadata.eventId,
              userId: paymentIntent.metadata.userId,
              baseCost: paymentIntent.metadata.baseCost,
            },
            request: {
              eventId,
              userId: user.id,
              baseCost: eventCost,
            },
          });
          return new Response(null, {
            status: 302,
            headers: {
              Location: `/events/${eventId}?error=Invalid+payment`,
            },
          });
        }
      } catch (error) {
        console.error('Payment verification error:', error);
        return new Response(null, {
          status: 302,
          headers: {
            Location: `/events/${eventId}?error=Payment+verification+failed`,
          },
        });
      }
    }

    // All checks passed, register the user
    await turso.execute({
      sql: `INSERT INTO event_participants (event_id, user_id, joined_at) VALUES (?, ?, ?)`,
      args: [
        eventId.toString(),
        user.id,
        new Date().toISOString()
      ],
    });

    // Send confirmation email asynchronously - don't await the result
    try {
      console.log('Starting email confirmation process...');
      
      // Get user's email and name
      const userResult = await turso.execute({
        sql: `SELECT u.email, p.first_name 
              FROM user u 
              JOIN profile p ON u.id = p.user_id 
              WHERE u.id = ?`,
        args: [user.id],
      });

      const userProfile = userResult.rows[0];
      
      if (!userProfile) {
        console.error('User profile not found for ID:', user.id);
        // Don't throw, just log and continue
      } else {
        const eventStartTime = new Date(event.start_time as string);
        const formattedStartTime = eventStartTime.toLocaleString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });

        // Initialize Mailjet and send email without awaiting
        const mailjet = new Mailjet({
          apiKey: import.meta.env.MAILJET_API_KEY,
          apiSecret: import.meta.env.MAILJET_API_SECRET,
        });

        mailjet
          .post("send", { version: "v3.1" })
          .request({
            Messages: [
              {
                From: {
                  Email: "noreply@socialspot.com.au",
                  Name: "SocialSpot",
                },
                To: [{ Email: userProfile.email }],
                Subject: `You're registered for ${event.name}! 🕺`,
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
                                <h1 style="margin: 0 0 20px; font-size: 28px; font-weight: bold; color: black;">Hi ${userProfile.first_name}! 🎉</h1>
                                <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.5; color: black;">You're all set for ${event.name}!</p>
                                <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
                                  <h2 style="margin: 0 0 15px; color: black;">Event Details:</h2>
                                  <p style="margin: 0 0 10px; color: black;"><strong>When:</strong> ${formattedStartTime}</p>
                                  <p style="margin: 0 0 10px; color: black;"><strong>Where:</strong> ${event.location}</p>
                                </div>
                                <p style="margin: 0 0 30px; font-size: 16px; line-height: 1.5; color: black;">We'll send you a reminder before the event. Get ready to meet some amazing people!</p>
                                <div style="text-align: center;">
                                  <a href="https://socialspot.com.au/events/${eventId}" 
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
          .then(() => {
            console.log('Email sent successfully');
          })
          .catch((error) => {
            console.error('Failed to send confirmation email:', {
              error,
              errorMessage: error instanceof Error ? error.message : 'Unknown error',
              errorStack: error instanceof Error ? error.stack : undefined
            });
          });
      }
    } catch (error) {
      console.error('Error in email confirmation process:', {
        error,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        errorStack: error instanceof Error ? error.stack : undefined
      });
    }

    // Return success response immediately after registration
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Failed to register' 
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
}
