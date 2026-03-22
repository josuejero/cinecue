import { auth } from "@/auth";
import { getDb } from "@/db/client";
import { appUsers } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { Session } from "next-auth";
import crypto from "node:crypto";
import { UnauthorizedError } from "./errors";

function createId() {
  return crypto.randomUUID();
}

function getSessionIdentity(session: Session) {
  const user = session.user as Session["user"] & { id?: string | null };
  const authSubject = user.id ?? user.email ?? null;

  if (!authSubject) {
    throw new UnauthorizedError(
      "Authenticated session is missing a stable user identifier.",
    );
  }

  return {
    authSubject,
    email: session.user?.email ?? null,
    name: session.user?.name ?? null,
    image: session.user?.image ?? null,
  };
}

export async function requireSession() {
  const session = await auth();

  if (!session?.user) {
    throw new UnauthorizedError("Sign in required.");
  }

  return session;
}

export async function getOrCreateAppUser() {
  const session = await requireSession();
  const identity = getSessionIdentity(session);
  const db = getDb();

  await db
    .insert(appUsers)
    .values({
      id: createId(),
      authSubject: identity.authSubject,
      email: identity.email,
      name: identity.name,
      image: identity.image,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: appUsers.authSubject,
      set: {
        email: identity.email,
        name: identity.name,
        image: identity.image,
        updatedAt: new Date(),
      },
    });

  const [user] = await db
    .select()
    .from(appUsers)
    .where(eq(appUsers.authSubject, identity.authSubject))
    .limit(1);

  if (!user) {
    throw new UnauthorizedError("Failed to materialize the authenticated app user.");
  }

  return user;
}