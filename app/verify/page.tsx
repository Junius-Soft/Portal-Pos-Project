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
  const [message, setMessage] = useState("Doğrulanıyor...");

  useEffect(() => {
    const token = searchParams.get("token");

    if (!token) {
      setStatus("error");
      setMessage("Geçersiz veya eksik doğrulama bağlantısı.");
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
          setMessage(data.error || "Doğrulama başarısız oldu.");
          return;
        }

        // Başarılı
        setStatus("success");
        setMessage("E-posta adresiniz başarıyla doğrulandı! Yönlendiriliyorsunuz...");
        
        // Kullanıcı emailini session'a kaydet (wizard'da kullanmak için)
        // Not: Normalde token'dan email'i de döndürebilirdik ama güvenlik için 
        // kullanıcıdan tekrar girmesini istemek veya önceki adımdan hatırlamak gerekebilir.
        // Basitlik için burada localStorage temizliği yapabiliriz.
        
        setTimeout(() => {
          // Kayıt sihirbazına yönlendir
          router.push("/register/company-information");
        }, 2000);

      } catch (error) {
        setStatus("error");
        setMessage("Bir bağlantı hatası oluştu.");
      }
    };

    verifyToken();
  }, [searchParams, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md shadow-lg text-center">
        <CardHeader>
          <CardTitle>E-posta Doğrulama</CardTitle>
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
              <h2 className="text-xl font-semibold text-green-700 mb-2">Başarılı!</h2>
              <p className="text-gray-600 mb-6">{message}</p>
              <Button onClick={() => router.push("/register/company-information")}>
                Hemen Devam Et
              </Button>
            </>
          )}

          {status === "error" && (
            <>
              <XCircle className="h-12 w-12 text-red-500 mb-4" />
              <h2 className="text-xl font-semibold text-red-700 mb-2">Hata</h2>
              <p className="text-gray-600 mb-6">{message}</p>
              <Button variant="outline" onClick={() => router.push("/signup")}>
                Tekrar Kayıt Ol
              </Button>
            </>
          )}

        </CardContent>
      </Card>
    </div>
  );
}