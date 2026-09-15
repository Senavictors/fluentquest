import { betterAuth } from "better-auth";
import { pool } from "./db";
export const auth = betterAuth({
  database: pool,
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3215",
  emailAndPassword: {
    enabled: true,
    disableSignUp: process.env.FQ_OWNER_SETUP !== "true",
    minPasswordLength: 12,
  },
  trustedOrigins: [process.env.BETTER_AUTH_URL || "http://localhost:3215"],
  session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24 },
  advanced: {
    useSecureCookies:
      process.env.BETTER_AUTH_URL?.startsWith("https://") || false,
  },
});
