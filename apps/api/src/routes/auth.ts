import { Hono } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import jwt from "jsonwebtoken";
import { verifyToken, verifyCfJwt } from "../middleware/auth.js";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";

export const authRoute = new Hono();

authRoute.get("/login", (c) => {
  const redirectUri = `${c.req.url.replace("/login", "/callback")}`;
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", GOOGLE_CLIENT_ID);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("access_type", "offline");
  return c.redirect(url.toString(), 302);
});

authRoute.get("/callback", async (c) => {
  const code = c.req.query("code");
  if (!code) {
    return c.json({ error: { code: "BAD_REQUEST", message: "Missing code parameter" } }, 400);
  }

  try {
    // Exchange code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: c.req.url.split("?")[0],
        grant_type: "authorization_code",
      }),
    });

    const tokens = await tokenRes.json() as any;

    // Get user info
    const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const user = await userRes.json() as any;

    // Create session JWT
    const sessionToken = jwt.sign(
      { email: user.email, name: user.name },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    setCookie(c, "session", sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Strict",
      maxAge: 7 * 24 * 60 * 60,
      path: "/",
    });

    return c.redirect("/");
  } catch (err) {
    return c.json({ error: { code: "AUTH_FAILED", message: "Authentication failed" } }, 500);
  }
});

authRoute.get("/me", (c) => {
  // Try Cloudflare Access JWT
  const cfJwt = c.req.header("Cf-Access-Jwt-Assertion");
  if (cfJwt) {
    const user = verifyCfJwt(cfJwt);
    if (user) return c.json(user);
  }

  // Try Bearer token
  const authHeader = c.req.header("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const user = verifyToken(authHeader.slice(7));
    if (user) return c.json(user);
  }

  // Try cookie
  const sessionToken = getCookie(c, "session");
  if (sessionToken) {
    const user = verifyToken(sessionToken);
    if (user) return c.json(user);
  }

  return c.json({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } }, 401);
});

authRoute.post("/logout", (c) => {
  setCookie(c, "session", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "Strict",
    maxAge: 0,
    path: "/",
  });
  return c.json({ message: "Logged out" });
});
