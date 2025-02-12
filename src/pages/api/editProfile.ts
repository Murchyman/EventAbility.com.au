import type { APIRoute } from "astro";
import { turso } from "src/lib/turso";
import { uploadFile } from "src/lib/s3";
import Jimp from "jimp";
import { sanitizeInput } from "src/lib/sanitize";

const isValidImage = (file: File) => {
  const acceptedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  const maxSize = 20 * 1024 * 1024; // Standardized to 20MB in bytes
  return acceptedTypes.includes(file.type) && file.size <= maxSize;
};

export const PUT: APIRoute = async ({ request, locals }) => {
  try {
    const user = locals.user;
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
      });
    }

    const formData = await request.formData();
    const firstName = sanitizeInput(formData.get("first_name") as string).trim();
    const age = parseInt(sanitizeInput(formData.get("age") as string));
    const interests = sanitizeInput(formData.get("interests") as string);
    const photo = formData.get("profile_photo") as File;

    // Validate required inputs
    if (!firstName || !interests || !age) {
      return new Response(
        JSON.stringify({ error: "Required fields are missing" }),
        { status: 400 }
      );
    }

    // Validate first name length
    if (firstName.length > 25) {
      return new Response(
        JSON.stringify({ error: "First name must be 25 characters or less" }),
        { status: 400 }
      );
    }

    // Server-side age validation
    if (isNaN(age) || age < 18 || age > 120) {
      return new Response(
        JSON.stringify({ error: "Age must be between 18 and 120" }),
        { status: 400 }
      );
    }

    // Validate interests is a valid JSON array
    try {
      JSON.parse(interests);
    } catch (e) {
      return new Response(
        JSON.stringify({ error: "Invalid interests format" }),
        { status: 400 }
      );
    }

    // Update profile data in database
    const result = await turso.execute({
      sql: `UPDATE profile 
            SET first_name = ?, 
                interests = ?,
                age = ?
            WHERE user_id = ?`,
      args: [firstName, interests, age, user.id],
    });

    // Upload new photo if provided
    if (photo && photo.size > 0) {
      if (!isValidImage(photo)) {
        return new Response(
          JSON.stringify({
            error: photo.size > 20 * 1024 * 1024 
              ? "Image file size must be less than 20MB"
              : "Invalid file type. Please upload an image."
          }),
          { status: 400 }
        );
      }

      const buffer = Buffer.from(await photo.arrayBuffer());

      // Compress and resize the image
      const image = await Jimp.read(buffer);
      const processedImageBuffer = await image
        .scaleToFit(800, 800)
        .quality(80)
        .getBufferAsync(Jimp.MIME_JPEG);

      await uploadFile(
        processedImageBuffer,
        `${user.id}.jpg`,
        "profile-pictures"
      );
    }

    if (result.rowsAffected === 0) {
      return new Response(JSON.stringify({ error: "Profile update failed" }), {
        status: 500,
      });
    }

    return new Response(
      JSON.stringify({ message: "Profile updated successfully" }),
      { status: 200 }
    );
  } catch (error) {
    console.error("Profile update error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
    });
  }
};
