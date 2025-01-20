import { defineCollection, z } from 'astro:content';
import { turso } from "src/lib/turso";

const events = defineCollection({
  loader: async () => {
    try {
      // Fetch all events from the database
      const result = await turso.execute({
        sql: "SELECT * FROM events",
        args: [],
      });

  

      // Convert rows to entries with required id property
      const entries = result.rows.map((row) => {
        const entry = result.columns.reduce((obj: any, column, index) => {
          obj[column] = row[index];
          return obj;
        }, {});


        return {
          id: entry.event_id.toString(),
          name: entry.name,
          age: entry.age,
          imageURL: entry.imageURL,
          description: entry.description,
          location: entry.location,
          start_time: new Date(entry.start_time),
          end_time: new Date(entry.end_time),
          timezone: entry.timezone || "UTC",
          is_participating: false,
          event_id: entry.event_id,
          repeating_event_id: entry.repeating_event_id,
          cost: entry.cost,
          max_participants: entry.max_participants,
        };
      });

  

      return entries;
    } catch (error) {
      console.error("Content loader: Error loading events", error);
      throw error;
    }
  },
  schema: z.object({
    id: z.string(),
    name: z.string(),
    age: z.string(),
    imageURL: z.string(),
    description: z.string(),
    location: z.string(),
    start_time: z.date(),
    end_time: z.date(),
    timezone: z.string().default("UTC"),
    is_participating: z.boolean().default(false),
    event_id: z.number(),
    repeating_event_id: z.number().nullable(),
    cost: z.number(),
    max_participants: z.number().nullable(),
  })
});

export const collections = { events }; 