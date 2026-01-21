"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is logged in
    if (typeof window !== "undefined") {
      const storedUser = sessionStorage.getItem("user");
      const storedEmail = sessionStorage.getItem("userEmail");

      if (!storedUser || !storedEmail) {
        // Not logged in, redirect to login
        router.push("/");
        return;
      }

      try {
        setUser(JSON.parse(storedUser));
        setUserEmail(storedEmail);
        
        // Check registration status - eğer "Completed" değilse registration sayfasına yönlendir
        const checkRegistrationStatus = async () => {
          try {
            const res = await fetch("/api/erp/get-lead", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ email: storedEmail }),
            });

            const data = await res.json();
            
            if (data.success && data.lead) {
              const registrationStatus = data.lead.custom_registration_status;
              console.log("📋 Dashboard - Registration Status:", registrationStatus);
              
              // Eğer registration "Completed" değilse, ilk sayfaya (services) yönlendir
              if (registrationStatus !== "Completed") {
                console.log("⚠️ Registration not completed, redirecting to services (first page)...");
                router.push("/register/services");
                return;
              }
            } else {
              // Lead bulunamadı, ilk sayfaya (services) yönlendir
              console.log("⚠️ Lead not found, redirecting to services (first page)...");
              router.push("/register/services");
              return;
            }
          } catch (error) {
            console.error("❌ Error checking registration status:", error);
            // Hata durumunda da ilk sayfaya (services) yönlendir (güvenli taraf)
            router.push("/register/services");
            return;
          }
          
          setLoading(false);
        };
        
        checkRegistrationStatus();
      } catch (error) {
        console.error("Error parsing user data:", error);
        router.push("/");
      }
    } else {
      setLoading(false);
    }
  }, [router]);

  const handleLogout = () => {
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("user");
      sessionStorage.removeItem("userEmail");
      localStorage.removeItem("rememberMe");
      localStorage.removeItem("userEmail");
    }
    router.push("/");
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  const displayName =
    typeof user === "string"
      ? user
      : user?.full_name || user?.message || user?.name || "";

  const displayUserText =
    displayName || (user ? JSON.stringify(user) : "N/A");

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <Card className="border-gray-200 shadow-lg">
          <CardHeader className="space-y-1">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-[30px] leading-[36px] font-bold text-[#111827] tracking-[0px]">
                  Dashboard
                </CardTitle>
                <p className="text-sm text-gray-600 mt-2">Welcome back!</p>
              </div>
              <Button
                onClick={handleLogout}
                variant="outline"
                className="text-sm font-semibold border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                Logout
              </Button>
            </div>
          </CardHeader>

          <CardContent>
            <div className="space-y-6">
              {/* User Info */}
              <div className="bg-gray-50 p-6 rounded-lg">
                <h2 className="text-lg font-semibold text-gray-800 mb-4">User Information</h2>
                <div className="space-y-2">
                  <div>
                    <span className="text-sm font-medium text-gray-600">Name:</span>
                    <span className="ml-2 text-sm text-gray-900">{displayUserText}</span>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-600">Email:</span>
                    <span className="ml-2 text-sm text-gray-900">{userEmail || "N/A"}</span>
                  </div>
                </div>
              </div>

              {/* Welcome Message */}
              <div className="bg-green-50 border border-green-200 p-6 rounded-lg">
                <p className="text-green-800">
                  <strong>Login successful!</strong> You have successfully logged in to the system.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
