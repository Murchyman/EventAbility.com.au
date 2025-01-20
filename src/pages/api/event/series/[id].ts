import type { APIRoute } from "astro";
import { turso } from "src/lib/turso";
// this is where qr codes link to it redirects to the latest event in the series
export const GET: APIRoute = async ({ params, redirect }) => {
  try {
    const repeatingEventId = params.id;

    if (!repeatingEventId) {
      return new Response("Repeating event ID is required", { status: 400 });
    }

    // Query to get the latest event in the series times are in UTC
    const result = await turso.execute({
      sql: `
        SELECT event_id 
        FROM events 
        WHERE repeating_event_id = ? 
        AND end_time > datetime('now') 
        ORDER BY start_time ASC 
        LIMIT 1
      `,
      args: [repeatingEventId],
    });

    if (result.rows.length === 0) {
      // If no upcoming events, get the most recent past event
      const pastResult = await turso.execute({
        sql: `
          SELECT event_id 
          FROM events 
          WHERE repeating_event_id = ? 
          ORDER BY start_time DESC 
          LIMIT 1
        `,
        args: [repeatingEventId],
      });

      if (pastResult.rows.length === 0) {
        return new Response("No events found in this series", { status: 404 });
      }

      // For expired events, redirect directly to the event page
      return redirect(`/events/${pastResult.rows[0].event_id}`);
    }

    // For upcoming events, redirect to the create profile page
    return redirect(`/createprofile?event=${result.rows[0].event_id}`);

  } catch (error) {
    console.error("Error fetching series event:", error);
    return new Response("Internal server error", { status: 500 });
  }
}; 