import { OAuth2Client } from "google-auth-library";

const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI!;

const client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI
);

export function buildGoogleAuthUrl(state: string): string {
  return client.generateAuthUrl({
    access_type: "online",
    scope: ["openid", "email", "profile"],
    state,
  });
}

export interface GoogleProfile {
  googleId: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
}

export async function exchangeCodeForProfile(code: string): Promise<GoogleProfile> {
  const { tokens } = await client.getToken({ code, redirect_uri: GOOGLE_REDIRECT_URI });
  const ticket = await client.verifyIdToken({
    idToken: tokens.id_token!,
    audience: process.env.GOOGLE_CLIENT_ID,
  });
  const payload = ticket.getPayload();
  if (!payload || !payload.sub || !payload.email) {
    throw new Error("Não foi possível obter os dados do perfil Google");
  }
  return {
    googleId: payload.sub,
    email: payload.email,
    emailVerified: payload.email_verified ?? false,
    name: payload.name ?? null,
  };
}
