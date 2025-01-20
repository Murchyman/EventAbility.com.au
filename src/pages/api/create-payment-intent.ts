import type { APIContext } from "astro";
import { stripe, calculateTotalAmount } from "../../lib/stripe";
import { turso } from "src/lib/turso";

export async function POST({ request, locals }: APIContext) {
  try {
    // Check authentication
    const user = locals.user;
    if (!user) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const { eventId } = await request.json();

    // Validate required fields
    if (!eventId) {
      return new Response(
        JSON.stringify({ error: "Event ID is required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Get event details and validate amount
    const eventResult = await turso.execute({
      sql: "SELECT * FROM events WHERE event_id = ?",
      args: [eventId],
    });

    const event = eventResult.rows[0];
    if (!event) {
      return new Response(
        JSON.stringify({ error: "Event not found" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Get event cost from database
    const eventCost = Number(event.cost ?? 0);
    if (eventCost <= 0) {
      return new Response(
        JSON.stringify({ error: "This event is free and doesn't require payment" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Validate event hasn't ended
    if (new Date(event.end_time as string) < new Date()) {
      return new Response(
        JSON.stringify({ error: "Event has ended" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Check if user is already registered
    const existingRegistration = await turso.execute({
      sql: "SELECT 1 FROM event_participants WHERE event_id = ? AND user_id = ?",
      args: [eventId, user.id],
    });

    if (existingRegistration.rows.length > 0) {
      return new Response(
        JSON.stringify({ error: "Already registered for this event" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Calculate total amount including booking fee
    const totalAmount = calculateTotalAmount(eventCost);

    // Create a PaymentIntent with the total amount
    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalAmount,
      currency: "aud",
      metadata: {
        eventId: eventId.toString(),
        userId: user.id,
        baseCost: eventCost.toString(),
        bookingFee: (totalAmount - eventCost).toString(),
      },
      automatic_payment_methods: {
        enabled: true,
      },
    });

    return new Response(
      JSON.stringify({
        clientSecret: paymentIntent.client_secret,
        amount: totalAmount,
        baseCost: eventCost,
        bookingFee: totalAmount - eventCost,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  } catch (err: any) {
    console.error("Payment intent creation error:", err);
    return new Response(
      JSON.stringify({ error: "Failed to create payment intent" }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }
} 