"use client";

import { signIn, signOut } from "next-auth/react";
import { ActionButton } from "@/components/ui";
import type { ReactNode } from "react";

type AuthButtonProps = {
  className?: string;
  callbackUrl?: string;
  children?: ReactNode;
  icon?: ReactNode;
  size?: "sm" | "md" | "lg";
  variant?: "primary" | "secondary" | "ghost" | "danger";
};

export function SignInButton({
  className,
  callbackUrl = "/dashboard",
  children = "Continue with GitHub",
  icon,
  size = "lg",
  variant = "primary",
}: AuthButtonProps) {
  return (
    <ActionButton
      className={className}
      icon={icon}
      onClick={() => void signIn("github", { callbackUrl })}
      size={size}
      variant={variant}
    >
      {children}
    </ActionButton>
  );
}

export function SignOutButton({
  className,
  callbackUrl = "/",
  children = "Sign out",
  icon,
  size = "md",
  variant = "secondary",
}: AuthButtonProps) {
  return (
    <ActionButton
      className={className}
      icon={icon}
      onClick={() => void signOut({ callbackUrl })}
      size={size}
      variant={variant}
    >
      {children}
    </ActionButton>
  );
}
