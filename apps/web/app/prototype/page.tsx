import { Suspense } from "react";
import { PrototypeApp } from "./prototype-app";

export default function PrototypePage() {
  return (
    <Suspense fallback={null}>
      <PrototypeApp />
    </Suspense>
  );
}
