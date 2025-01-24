import type { APIRoute } from "astro";
import { turso } from "src/lib/turso";
import { sanitizeInput } from "src/lib/sanitize";
import Mailjet from "node-mailjet";
const mailjet = new Mailjet({
  apiKey: import.meta.env.MAILJET_API_KEY,
  apiSecret: import.meta.env.MAILJET_API_SECRET,
});
export const POST: APIRoute = async ({ request }) => {
  try {
    const formData = await request.formData();
    const reportedBy = sanitizeInput(formData.get("reportedBy") as string);
    const reportedUserId = sanitizeInput(
      formData.get("reportUserId") as string
    );
    const reason = sanitizeInput(formData.get("reportReason") as string);

    // Validate required fields
    if (!reportedBy || !reportedUserId || !reason) {
      return new Response(
        JSON.stringify({
          error: "Missing required fields",
        }),
        { status: 400 }
      );
    }

    // Insert report into database
    await turso.execute({
      sql: "INSERT INTO reports (reported_by, reported_user_id, reason) VALUES (?, ?, ?)",
      args: [reportedBy, reportedUserId, reason],
    });
      await mailjet.post("send", { version: "v3.1" }).request({
        Messages: [
          {
            From: {
              Email: "noreply@eventability.com.au",
              Name: "Event Ability",
            },
            To: [
              {
                Email: "mitchell@socialspot.com.au",
              },
            ],
            Subject: "New User Report Submitted",
            TextPart: `A new user report has been submitted:
Reporter ID: ${reportedBy}
Reported User ID: ${reportedUserId} 
Reason: ${reason}`,
            HTMLPart: `
<h2>New User Report</h2>
<p><strong>Reporter ID:</strong> ${reportedBy}</p>
<p><strong>Reported User ID:</strong> ${reportedUserId}</p>
<p><strong>Reason:</strong> ${reason}</p>`,
          },
        ],
      });

    return new Response(
      JSON.stringify({
        message: "Report submitted successfully",
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error("Report error:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to submit report",
      }),
      { status: 500 }
    );
  }
};
