"use client";

import { signIn, signOut } from "next-auth/react";

type AuthButtonProps = {
  className?: string;
  callbackUrl?: string;
  children?: React.ReactNode;
};

export function SignInButton({
  className,
  callbackUrl = "/dashboard",
  children = "Continue with GitHub",
}: AuthButtonProps) {
  return (
    <button
      className={className}
      onClick={() => void signIn("github", { callbackUrl })}
      type="button"
    >
      {children}
    </button>
  );
}

export function SignOutButton({
  className,
  callbackUrl = "/",
  children = "Sign out",
}: AuthButtonProps) {
  return (
    <button
      className={className}
      onClick={() => void signOut({ callbackUrl })}
      type="button"
    >
      {children}
    </button>
  );
}
