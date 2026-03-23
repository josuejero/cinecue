import { index, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { pgTable } from "drizzle-orm/pg-core";

export const appUsers = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    authSubject: text("auth_subject").notNull(),
    email: text("email"),
    name: text("name"),
    image: text("image"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    authSubjectUnique: uniqueIndex("users_auth_subject_unique").on(table.authSubject),
    emailIdx: index("users_email_idx").on(table.email),
  }),
);
