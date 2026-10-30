"use client";

import { useSearchParams } from "next/navigation";
import { AuthConcept } from "@/components/auth-concept";

export function SignupContent() {
  const searchParams = useSearchParams();
  const initialRole = searchParams.get("role") === "mentor" ? "mentor" : "learner";
  return <AuthConcept mode="signup" initialRole={initialRole} />;
}
