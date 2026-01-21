import { NextRequest, NextResponse } from "next/server";
import { erpLogin } from "@/lib/erp";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email ve şifre zorunludur." },
        { status: 400 }
      );
    }

    // DÜZELTME BURADA: Parametreleri tek bir obje içinde gönderiyoruz
    // ERPNext 'usr' ve 'pwd' alanlarını bekler.
    const result = await erpLogin({ usr: email, pwd: password });

    return NextResponse.json({
      success: true,
      message: "Giriş başarılı",
      user: result, // ERP'den dönen user bilgisi
    });

  } catch (error: any) {
    console.error("Login error:", error.message);
    return NextResponse.json(
      { error: error.message || "Giriş başarısız. Bilgilerinizi kontrol edin." },
      { status: 401 }
    );
  }
}