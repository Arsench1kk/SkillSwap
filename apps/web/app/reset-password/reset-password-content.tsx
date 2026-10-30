"use client";

import { useSearchParams } from "next/navigation";
import { AuthConcept } from "@/components/auth-concept";

export function ResetPasswordContent() {
  const searchParams = useSearchParams();
  return <AuthConcept mode="reset" token={searchParams.get("token") ?? undefined} />;
}
