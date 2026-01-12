"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "react-toastify";
import Link from "next/link";

export default function SignupPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccessMessage(null);

    try {
      const res = await fetch("/api/auth/start-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: fullName, email }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Kayıt işlemi başlatılamadı.");
        return;
      }

      // Başarılı
      setSuccessMessage("Doğrulama bağlantısı e-posta adresinize gönderildi. Lütfen gelen kutunuzu (ve spam klasörünü) kontrol edin.");
      toast.success("Doğrulama e-postası gönderildi!");
      
    } catch (error) {
      toast.error("Bir hata oluştu. Lütfen tekrar deneyin.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">Hesap Oluştur</CardTitle>
          <CardDescription className="text-center">
            Devam etmek için bilgilerinizi girin
          </CardDescription>
        </CardHeader>
        <CardContent>
          {successMessage ? (
            <div className="bg-green-50 border border-green-200 text-green-700 p-4 rounded-md text-center">
              <p className="font-medium">E-posta Gönderildi ✅</p>
              <p className="text-sm mt-2">{successMessage}</p>
              <p className="text-sm mt-4 text-gray-500">
                E-postayı onayladıktan sonra otomatik olarak yönlendirileceksiniz.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Ad Soyad</Label>
                <Input
                  id="fullName"
                  placeholder="Adınız Soyadınız"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">E-posta</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="ornek@sirket.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "İşleniyor..." : "Kayıt Ol"}
              </Button>
              
              <div className="text-center text-sm text-gray-500 mt-4">
                Zaten hesabınız var mı?{" "}
                <Link href="/" className="text-blue-600 hover:underline font-medium">
                  Giriş Yap
                </Link>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}