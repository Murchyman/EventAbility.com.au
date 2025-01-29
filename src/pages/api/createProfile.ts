import type { APIRoute } from "astro";
import { uploadFile } from "src/lib/s3";
import { turso } from "src/lib/turso";
import sharp from "sharp";
import { sanitizeInput } from "src/lib/sanitize";

const isValidImage = (file: File) => {
  const acceptedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  const maxSize = 20 * 1024 * 1024; // Standardized to 20MB in bytes
  return acceptedTypes.includes(file.type) && file.size <= maxSize;
};

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    console.log("Starting profile creation process...");
    const user = locals.user;
    if (!user) {
      console.log("Unauthorized: No user found in locals");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }

    console.log("Processing form data...");
    const formData = await request.formData();
    const firstName = sanitizeInput(formData.get("first_name") as string).trim();
    const age = parseInt(sanitizeInput(formData.get("age") as string));
    const interests = sanitizeInput(formData.get("interests") as string);
    const photo = formData.get("profile_photo") as File;
    const instagramHandle = sanitizeInput(formData.get("instagram_handle") as string)?.trim() || null;

    // Add validation logging
    console.log("Validating inputs...", {
      hasFirstName: !!firstName,
      hasAge: !!age,
      hasInterests: !!interests,
      hasPhoto: !!photo
    });

    // Validate inputs
    if (!firstName || !age || !interests) {
      return new Response(
        JSON.stringify({ error: "All fields are required" }),
        { 
          status: 400,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
    }
    if(firstName.length > 25){
      return new Response(
        JSON.stringify({ error: "First name must be 25 characters or less" }),
        { status: 400 }
      );
    }

    // Validate Instagram handle format if provided
    if (instagramHandle) {
      const instagramRegex = /^[a-zA-Z0-9._]{1,30}$/;
      if (!instagramRegex.test(instagramHandle)) {
        return new Response(
          JSON.stringify({ error: "Invalid Instagram handle format. Only letters, numbers, dots and underscores are allowed." }),
          { status: 400 }
        );
      }
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

    // Validate photo
    if (!photo || !isValidImage(photo)) {
      return new Response(
        JSON.stringify({ 
          error: photo && photo.size > 20 * 1024 * 1024 
            ? "Image file size must be less than 20MB" 
            : "Please upload a valid image file" 
        }),
        { status: 400 }
      );
    }

    console.log("Inserting profile into database...");
    const result = await turso.execute({
      sql: `INSERT INTO profile (user_id, first_name, age, interests, instagram_handle) 
            VALUES (?, ?, ?, ?, ?)`,
      args: [user.id, firstName, age, interests, instagramHandle || null],
    });
    console.log("Database insert result:", result);

    // Wrap image processing in try-catch to handle sharp errors specifically
    try {
      console.log("Starting image processing...");
      const buffer = Buffer.from(await photo.arrayBuffer());
      console.log("Image buffer created, size:", buffer.length);
      
      const processedImageBuffer = await sharp(buffer)
        .resize(800, 800, {
          fit: "inside",
          withoutEnlargement: true,
        })
        .jpeg({
          quality: 95,
          mozjpeg: true,
        })
        .toBuffer();
      console.log("Image processed successfully, new size:", processedImageBuffer.length);

      console.log("Uploading image to S3...");
      await uploadFile(processedImageBuffer, `${user.id}.jpg`, "profile-pictures");
      console.log("Image upload complete");
    } catch (imageError) {
      console.error("Image processing error:", {
        error: imageError,
        message: imageError instanceof Error ? imageError.message : "Unknown error",
        stack: imageError instanceof Error ? imageError.stack : undefined
      });
      
      // Attempt to rollback the profile creation since image processing failed
      try {
        await turso.execute({
          sql: "DELETE FROM profile WHERE user_id = ?",
          args: [user.id],
        });
        console.log("Profile creation rolled back due to image processing error");
      } catch (rollbackError) {
        console.error("Failed to rollback profile creation:", rollbackError);
      }

      return new Response(
        JSON.stringify({ 
          error: "Failed to process image", 
          details: imageError instanceof Error ? imageError.message : "Unknown image processing error" 
        }), {
          status: 500,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
    }

    console.log("Profile creation completed successfully");
    // On successful profile creation
    return new Response(
      JSON.stringify({ message: "Profile created successfully" }),
      { 
        status: 200,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
  } catch (error) {
    console.error("Profile creation error:", {
      error,
      message: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
      type: error instanceof Error ? error.constructor.name : typeof error
    });
    
    // Ensure we return a properly formatted error response
    return new Response(
      JSON.stringify({ 
        error: "Internal server error", 
        details: error instanceof Error ? error.message : "Unknown error",
        errorType: error instanceof Error ? error.constructor.name : "Unknown"
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
  }
};
