import Pusher from "pusher";
import { sanitizeObject } from "./sanitize";

const MAX_RETRIES = 3;

export const pusher = new Pusher({
  appId: import.meta.env.PUSHER_APP_ID,
  key: import.meta.env.PUSHER_KEY,
  secret: import.meta.env.PUSHER_SECRET,
  cluster: import.meta.env.PUSHER_CLUSTER,
  useTLS: true,
  timeout: 15000, // 15 second timeout
});

export async function broadcastMessage(
  room: string,
  message: any,
  retryCount = 0
): Promise<boolean> {
  try {
    const sanitizedMessage = sanitizeObject(message);
    await pusher.trigger(room, "message", {
      ...sanitizedMessage,
      timestamp: new Date().toISOString(),
    });
    return true;
  } catch (error) {
    console.error("Pusher broadcast error:", error);

    if (retryCount < MAX_RETRIES) {
      // Exponential backoff retry
      await new Promise((resolve) =>
        setTimeout(resolve, Math.pow(2, retryCount) * 1000)
      );
      return broadcastMessage(room, message, retryCount + 1);
    }

    return false;
  }
}

// Add health check function
export async function checkPusherConnection(): Promise<boolean> {
  try {
    await pusher.trigger("health-check", "ping", {});
    return true;
  } catch (error) {
    console.error("Pusher health check failed:", error);
    return false;
  }
}
