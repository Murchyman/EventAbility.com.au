import { betterAuth } from "better-auth";
import { LibsqlDialect } from "@libsql/kysely-libsql";
import Mailjet from "node-mailjet";
const mailjet = new Mailjet({
  apiKey: import.meta.env.MAILJET_API_KEY,
  apiSecret: import.meta.env.MAILJET_API_SECRET,
});
const dialect = new LibsqlDialect({
  url: import.meta.env.TURSO_DATABASE_URL || "",
  authToken: import.meta.env.TURSO_AUTH_TOKEN || "",
});

export const auth = betterAuth({
  user: {
        changeEmail: {
            enabled: true,
        }
    },
  emailVerification: {
    sendVerificationEmail: async ({ user, url, token }, request) => {
      await mailjet.post("send", { version: "v3.1" }).request({
        Messages: [
          {
            From: {
              Email: "noreply@socialspot.com.au",
              Name: "EventAbility",
            },
            To: [
              {
                Email: user.email,
              },
            ],
            Subject: "Verify your email address",
            TextPart: `Click the link to verify your email: ${url}`,
            HTMLPart: `
<!DOCTYPE html>
<html>
  <body style="margin: 0; padding: 0; font-family: 'Arial', sans-serif;">
    <table role="presentation" style="width: 100%;  border-collapse: collapse;">
      <tr>
        <td style="padding: 20px;">
          <table role="presentation" style="max-width:  600px; margin: 0 auto; background-color: #C5FFE6; border: 3px solid black; border-radius: 12px; box-shadow: 7px 7px 0 rgba(0,0,0,1);">
            <tr>
              <td style="padding: 30px;">
                <h1 style="margin: 0 0 20px; font-size: 28px; font-weight: bold; color: black;">Email Verification Required</h1>
                <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.5; color: #4B5563;">Welcome to EventAbility</p>
                <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.5; color: #4B5563;">To complete your registration and access all features, please verify your email address.</p>
                <p style="margin: 0 0 30px; font-size: 16px; line-height: 1.5; color: #4B5563;">Click the button below to verify your email address and get started!</p>
                <div style="text-align: center;">
                  <a href="${url}" 
                     style="display: inline-block; background-color: black; color: white; padding: 24px 40px; text-decoration: none; border-radius: 4px; font-weight: bold; font-size: 16px;">
                    Verify Email
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
      });
    },
  },

  session: {
        expiresIn: 60 * 60 * 24 * 365, // 365 days
        updateAge: 60 * 60 * 24 // 1 day (every 1 day the session expiration is updated)
    },

  socialProviders: {
        google: { 
            clientId: import.meta.env.GOOGLE_CLIENT_ID as string, 
            clientSecret: import.meta.env.GOOGLE_CLIENT_SECRET as string, 
        }, 
    },

  emailAndPassword: {
    sendResetPassword: async ({ user, url, token }, request) => {
      await mailjet.post("send", { version: "v3.1" }).request({
        Messages: [
          {
            From: {
              Email: "noreply@socialspot.com.au",
              Name: "EventAbility",
            },
            To: [
              {
                Email: user.email,
              },
            ],
            Subject: "Reset your password",
            TextPart: `Click the link to reset your password: ${url}`,
            HTMLPart: `
<!DOCTYPE html>
<html>
  <body style="margin: 0; padding: 0; font-family: 'Arial', sans-serif;">
    <table role="presentation" style="width: 100%; border-collapse: collapse;">
      <tr>
        <td style="padding: 20px;">
          <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: white; border: 3px solid black; border-radius: 12px; box-shadow: 7px 7px 0 rgba(0,0,0,1);">
            <tr>
              <td style="padding: 30px;">
                <h1 style="margin: 0 0 20px; font-size: 28px; font-weight: bold; color: black;">Password Reset Request</h1>
                <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.5; color: #4B5563;">We received a request to reset your password. If you didn't make this request, you can ignore this email.</p>
                <p style="margin: 0 0 30px; font-size: 16px; line-height: 1.5; color: #4B5563;">Click the button below to choose a new password:</p>
                <div style="text-align: center;">
                  <a href="${url}" 
                     style="display: inline-block; background-color: black; color: white; padding: 24px 40px; text-decoration: none; border-radius: 4px; font-weight: bold; font-size: 16px;">
                    Reset Password
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
      });
    },
    enabled: true,
  },
  database: {
    dialect,
    type: "sqlite",
  },
});
