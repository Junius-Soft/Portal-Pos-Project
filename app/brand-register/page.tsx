"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function BrandRegisterPage() {
  const router = useRouter();

  useEffect(() => {
    // Ana sayfa brand-selection'a yönlendir
    router.replace("/brand-register/brand-selection");
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-gray-500">Redirecting...</div>
    </div>
  );
}
