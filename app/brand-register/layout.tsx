"use client";

import { ReactNode } from "react";

interface BrandRegisterLayoutProps {
  children: ReactNode;
}

export default function BrandRegisterLayout({ children }: BrandRegisterLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      {children}
    </div>
  );
}
