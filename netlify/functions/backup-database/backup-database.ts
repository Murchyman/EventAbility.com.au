import type { Handler } from "@netlify/functions";
import { createClient } from "libsql-stateless-easy";
import { S3Client, PutObjectCommand, HeadBucketCommand } from "@aws-sdk/client-s3";

// Log environment variables (excluding sensitive values)
const checkEnvVars = () => {
  const requiredVars = [
    'ACCOUNT_ID',
    'MYAWS_ACCESS_KEY_ID',
    'MYAWS_SECRET_ACCESS_KEY',
    'TURSO_DATABASE_URL',
    'TURSO_AUTH_TOKEN'
  ];
  
  const missing = requiredVars.filter(varName => !process.env[varName]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
};

const s3Client = new S3Client({
  region: "us-east-1", // Required but ignored for R2
  endpoint: `https://${process.env.ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.MYAWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.MYAWS_SECRET_ACCESS_KEY || "",
  },
});

const turso = createClient({
  url: process.env.TURSO_HTTP_URL || "",
  authToken: process.env.TURSO_AUTH_TOKEN || "",
});

// Check if bucket exists and is accessible
const checkBucketAccess = async () => {
  try {
    console.log("Checking R2 bucket access...");
    await s3Client.send(new HeadBucketCommand({ Bucket: "database-backups" }));
    console.log("R2 bucket access confirmed");
  } catch (error: any) {
    if (error.name === 'NotFound') {
      throw new Error('The database-backups bucket does not exist. Please create it in your R2 dashboard.');
    } else if (error.name === 'AccessDenied') {
      throw new Error(
        'Access denied to R2 bucket. Please check:\n' +
        '1. Your R2 credentials are correct\n' +
        '2. The API token has bucket read/write permissions\n' +
        '3. Your ACCOUNT_ID matches your Cloudflare account'
      );
    }
    throw error;
  }
};

export const handler: Handler = async (event, context) => {
  try {
    console.log("Starting database backup...");
    
    // Check environment variables first
    checkEnvVars();

    // Check R2 bucket access before proceeding
    await checkBucketAccess();

    // Get current timestamp and determine environment from database URL
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const dbUrl = process.env.TURSO_DATABASE_URL || "";
    const environment = dbUrl.includes("-prod-") ? 'prod' : 'dev';
    const backupFileName = `backup-${environment}-${timestamp}.sql`;

    // Test database connection
    console.log("Testing database connection...");
    await turso.execute("SELECT 1");
    console.log("Database connection successful");

    // Dump the database
    console.log("Fetching table list...");
    const tables = await turso.execute(`
      SELECT name FROM sqlite_master 
      WHERE type='table' 
      AND name NOT LIKE 'sqlite_%'
      AND name NOT LIKE '_sqlx%'
    `);

    console.log(`Found ${tables.rows.length} tables to backup`);
    let dumpContent = "";

    // For each table, get its schema and data
    for (const table of tables.rows) {
      const tableName = table.name as string;
      console.log(`Processing table: ${tableName}`);
      
      // Get table schema
      const schema = await turso.execute(`
        SELECT sql FROM sqlite_master 
        WHERE type='table' 
        AND name='${tableName}'
      `);
      
      if (!schema.rows[0]?.sql) {
        throw new Error(`Failed to get schema for table ${tableName}`);
      }
      
      dumpContent += schema.rows[0].sql + ";\n\n";

      // Get table data
      const data = await turso.execute(`SELECT * FROM ${tableName}`);
      console.log(`Found ${data.rows.length} rows in ${tableName}`);
      
      for (const row of data.rows) {
        const columns = Object.keys(row).join(", ");
        const values = Object.values(row)
          .map(value => 
            value === null ? "NULL" : 
            typeof value === "string" ? `'${value.replace(/'/g, "''")}'` : 
            value
          )
          .join(", ");
        
        dumpContent += `INSERT INTO ${tableName} (${columns}) VALUES (${values});\n`;
      }
      dumpContent += "\n";
    }

    // Upload to R2
    console.log("Uploading backup file...");
    const uploadCommand = new PutObjectCommand({
      Bucket: "database-backups",
      Key: backupFileName,
      Body: dumpContent,
      ContentType: "application/sql",
    });

    await s3Client.send(uploadCommand);

    console.log(`Database backup completed: ${backupFileName}`);

    return {
      statusCode: 200,
      body: JSON.stringify({ 
        message: "Database backup completed successfully",
        file: backupFileName
      }),
    };
  } catch (error) {
    console.error("Database backup error:", error);
    // Get detailed error information
    const errorDetails = {
      message: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined,
    };
    
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: "Failed to backup database",
        details: errorDetails
      }),
    };
  } finally {
    try {
      await turso.close();
      console.log("Database connection closed");
    } catch (closeError) {
      console.error("Error closing database connection:", closeError);
    }
  }
}; 