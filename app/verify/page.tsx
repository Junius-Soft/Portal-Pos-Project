"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function VerifyPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Verifying...");

  useEffect(() => {
    const token = searchParams.get("token");

    if (!token) {
      setStatus("error");
      setMessage("Invalid or missing verification link.");
      return;
    }

    const verifyToken = async () => {
      try {
        const res = await fetch("/api/auth/verify-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });

        const data = await res.json();

        if (!res.ok) {
          setStatus("error");
          setMessage(data.error || "Verification failed.");
          return;
        }

        // Success
        setStatus("success");
        setMessage("Your email has been successfully verified! Redirecting...");
        
        // Save user email to session (to use in wizard)
        // Note: Normally we could return email from token but for security 
        // we may need to ask the user to re-enter or remember from previous step.
        // For simplicity, we can clean localStorage here.
        
        // If there's data in localStorage, create user and lead
        if (typeof window !== "undefined") {
          const initialDataRaw = localStorage.getItem("initialRegistrationData");
          if (initialDataRaw) {
            try {
              const initialData = JSON.parse(initialDataRaw);
              const completeRes = await fetch("/api/auth/complete-signup", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  email: initialData.email,
                  companyName: initialData.companyName,
                  firstName: initialData.firstName,
                  lastName: initialData.lastName,
                  password: initialData.password,
                }),
              });

              const completeData = await completeRes.json();
              if (completeRes.ok && completeData.success) {
                localStorage.setItem("signupCompleted", "true");
                sessionStorage.setItem("userEmail", initialData.email);
              } else {
                console.error("complete-signup failed:", completeData);
              }
            } catch (error) {
              console.error("complete-signup error:", error);
            }
          }
        }

        setTimeout(() => {
          // Redirect to registration wizard (first step)
          router.push("/register");
        }, 2000);

      } catch (error) {
        setStatus("error");
        setMessage("A connection error occurred.");
      }
    };

    verifyToken();
  }, [searchParams, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md shadow-lg text-center">
        <CardHeader>
          <CardTitle>Email Verification</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center py-8">
          
          {status === "loading" && (
            <>
              <Loader2 className="h-12 w-12 text-blue-500 animate-spin mb-4" />
              <p className="text-gray-600">{message}</p>
            </>
          )}

          {status === "success" && (
            <>
              <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
              <h2 className="text-xl font-semibold text-green-700 mb-2">Success!</h2>
              <p className="text-gray-600 mb-6">{message}</p>
              <Button onClick={() => router.push("/register")}>
                Continue Now
              </Button>
            </>
          )}

          {status === "error" && (
            <>
              <XCircle className="h-12 w-12 text-red-500 mb-4" />
              <h2 className="text-xl font-semibold text-red-700 mb-2">Error</h2>
              <p className="text-gray-600 mb-6">{message}</p>
              <Button variant="outline" onClick={() => router.push("/signup")}>
                Register Again
              </Button>
            </>
          )}

        </CardContent>
      </Card>
    </div>
  );
}
