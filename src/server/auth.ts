import { betterAuth } from "better-auth";
import { pool } from "./db";
const secret = process.env.BETTER_AUTH_SECRET;
if (process.env.NODE_ENV === "production" && (!secret || secret.length < 32))
  throw new Error("BETTER_AUTH_SECRET precisa ter pelo menos 32 caracteres.");
export const auth = betterAuth({
  database: pool,
  secret,
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
