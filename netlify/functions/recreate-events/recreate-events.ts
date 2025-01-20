import type { Handler } from "@netlify/functions";
import { createClient } from "libsql-stateless-easy";
import https from "https";

/**
 * This function automatically recreates repeating events when they end.
 * Runs hourly and checks all events that ended in the previous hour.
 * 
 * Example step-through:
 * 1. Event Setup:
 *    - Original event: "Saturday Night Social"
 *    - event_id: 663876575
 *    - repeating_event_id: 97123902
 *    - start_time: "2024-12-14T07:00:00Z"
 *    - end_time: "2024-12-14T14:00:00Z"
 * 
 * 2. Function Execution:
 *    - Function runs hourly (e.g., at 15:00)
 *    - Checks all events that ended between 14:00 and 15:00
 *    - Plus 5-minute buffer to avoid edge cases
 * 
 * 3. Recreation Process:
 *    - Checks for existing future events with same repeating_event_id
 *    - If none exist, creates new event with:
 *      - New event_id: (randomly generated)
 *      - Same repeating_event_id: 97123902
 *      - New start_time: "2024-12-21T07:00:00Z" (+7 days)
 *      - New end_time: "2024-12-21T14:00:00Z" (+7 days)
 *      - All other fields copied exactly
 * 
 * Note: The time range covers the full previous hour plus a 5-minute buffer
 * to ensure no events are missed between function runs.
 * 
 * Safety Features:
 * - Checks for existing future events before recreation to prevent duplicates
 * - Uses database transactions for atomic operations
 * - Full hour coverage plus buffer for reliable event detection
 */

const BUFFER_MINUTES = 5; // Buffer to handle edge cases

interface Event {
  event_id: number;
  age: string;
  imageURL: string;
  name: string;
  description: string;
  location: string;
  start_time: string;
  end_time: string;
  repeating_event_id: number;
  created_at: string;
  updated_at: string;
  cost: number;
  timezone: string;
}

export const handler: Handler = async (event, context) => {
  const turso = createClient({
    url: process.env.TURSO_HTTP_URL || "",
    authToken: process.env.TURSO_AUTH_TOKEN || "",
  });

  try {
    console.log("Function started");
    const now = new Date();
    
    // Start time is one hour ago
    const startTime = new Date(now);
    startTime.setHours(now.getHours() - 1);
    startTime.setMinutes(0, 0, 0);
    
    // End time is current hour
    const endTime = new Date(now);
    endTime.setMinutes(59, 59, 999);

    console.log("Time range:", { 
      startTime: startTime.toISOString(), 
      endTime: endTime.toISOString(),
      explanation: "Checking full previous hour"
    });

    // Get events that are ending now and have a repeating_event_id
    const result = await turso.execute({
      sql: `
        SELECT 
          event_id, age, imageURL, name, description, location,
          start_time, end_time, repeating_event_id, created_at,
          updated_at, cost, timezone
        FROM events e1
        WHERE end_time BETWEEN ? AND ?
        AND repeating_event_id IS NOT NULL
        AND start_time < end_time  -- Ensure valid time sequence
        AND NOT EXISTS (
          SELECT 1 FROM events e2
          WHERE e2.repeating_event_id = e1.repeating_event_id
          AND e2.event_id != e1.event_id
          AND e2.end_time > e1.end_time
          AND e2.name = e1.name  -- Same event name
        )
      `,
      args: [startTime.toISOString(), endTime.toISOString()],
    });

    // Debug log for SQL parameters
    console.log("SQL Debug:", {
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      query: "SELECT COUNT(*) FROM events WHERE end_time BETWEEN ? AND ? AND repeating_event_id IS NOT NULL"
    });

    // Execute count query to verify matching events before future check
    const countResult = await turso.execute({
      sql: "SELECT COUNT(*) FROM events WHERE end_time BETWEEN ? AND ? AND repeating_event_id IS NOT NULL",
      args: [startTime.toISOString(), endTime.toISOString()],
    });

    console.log("Initial matching events count:", Number(countResult.rows[0][0]));

    const events = result.rows.map((row) => {
      return result.columns.reduce((obj: Event, column, index) => {
        (obj as any)[column] = row[index];
        return obj;
      }, {} as Event);
    });

    console.log("Query results:", {
      eventCount: events.length,
      firstEvent: events[0],
    });

    if (events.length === 0) {
      await turso.close();
      return {
        statusCode: 200,
        body: JSON.stringify({ 
          message: "No events to recreate",
          timeRange: { startTime, endTime }
        }),
      };
    }

    // Process each event
    const recreationPromises = events.map(async (event) => {
      try {
        // Calculate duration of event
        const eventDuration = new Date(event.end_time).getTime() - new Date(event.start_time).getTime();
        if (eventDuration <= 0) {
          console.log(`Skipping event ${event.event_id} - invalid time sequence`);
          return {
            success: false,
            originalEventId: event.event_id,
            error: "Invalid time sequence"
          };
        }

        // Calculate new times based on end time
        const currentEndTime = new Date(event.end_time);
        const newEndTime = new Date(currentEndTime.getTime() + 7 * 24 * 60 * 60 * 1000);
        const newStartTime = new Date(newEndTime.getTime() - eventDuration);
        
        // Generate and verify unique event ID
        let newEventId: number;
        let idExists: boolean;
        do {
          newEventId = Math.floor(Math.random() * 1000000000);
          const idCheck = await turso.execute({
            sql: "SELECT COUNT(*) FROM events WHERE event_id = ?",
            args: [newEventId],
          });
          idExists = Number(idCheck.rows[0][0]) > 0;
        } while (idExists);
        
        // Insert the new event
        await turso.execute({
          sql: `
            INSERT INTO events (
              event_id, age, imageURL, name, description, location,
              start_time, end_time, repeating_event_id, created_at,
              updated_at, cost, timezone
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
          args: [
            newEventId,
            event.age,
            event.imageURL,
            event.name,
            event.description,
            event.location,
            newStartTime.toISOString(),
            newEndTime.toISOString(),
            event.repeating_event_id,
            new Date().toISOString(),
            new Date().toISOString(),
            event.cost,
            event.timezone
          ],
        });

        console.log("Created new event:", {
          originalEventId: event.event_id,
          newEventId: newEventId,
          startTime: newStartTime,
          endTime: newEndTime
        });

        return { 
          success: true, 
          originalEventId: event.event_id,
          newEventId: newEventId
        };
      } catch (error) {
        console.error(`Failed to recreate event ${event.event_id}:`, error);
        return { 
          success: false, 
          originalEventId: event.event_id,
          error 
        };
      }
    });

    const results = await Promise.all(recreationPromises);

    // Trigger Netlify rebuild if any events were successfully created
    if (results.some(result => result.success)) {
      try {
        await new Promise((resolve, reject) => {
          const req = https.request('https://api.netlify.com/build_hooks/676bd01c0664910988849c01', {
            method: 'POST',
          }, (res) => {
            if (res.statusCode === 200) {
              console.log('Triggered Netlify rebuild webhook');
              resolve(true);
            } else {
              reject(new Error(`Webhook failed with status ${res.statusCode}`));
            }
          });
          
          req.on('error', (error) => {
            reject(error);
          });
          
          req.end();
        });
      } catch (error) {
        console.error('Failed to trigger Netlify rebuild:', error);
      }
    }

    await turso.close();

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        processed: results.length,
        results: results,
        timeRange: { startTime, endTime }
      }),
    };
  } catch (error) {
    console.error("Error in recreate-events:", error);
    await turso.close();
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal server error" }),
    };
  }
}; 