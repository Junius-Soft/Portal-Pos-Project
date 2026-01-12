import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { full_name, email } = await req.json();

    if (!full_name || !email) {
      return NextResponse.json({ error: "Ad Soyad ve Email zorunludur." }, { status: 400 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_ERP_BASE_URL;
    const token = process.env.ERP_API_TOKEN;

    if (!baseUrl || !token) {
      return NextResponse.json({ error: "Sunucu ayarları eksik (.env kontrol edin)." }, { status: 500 });
    }

    // İŞLEMİ ERP'YE DEVRET
    // Bu Python fonksiyonu ERP'de yüklü olmalı: portal_onboarding.api.signup.start_signup
    const res = await fetch(`${baseUrl}/api/method/portal_onboarding.api.signup.start_signup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": token,
      },
      body: JSON.stringify({ full_name, email }),
    });

    const data = await res.json();

    if (!res.ok) {
      // ERP'den dönen hatayı okunaklı hale getir
      let errorMessage = "Bir hata oluştu.";
      if (data._server_messages) {
        try {
          const msgs = JSON.parse(data._server_messages);
          const msgObj = JSON.parse(msgs[0]);
          errorMessage = msgObj.message || errorMessage;
        } catch {}
      } else if (data.message) {
        errorMessage = data.message;
      } else if (data.exception) {
        errorMessage = data.exception;
      }
      
      return NextResponse.json({ error: errorMessage }, { status: res.status });
    }

    return NextResponse.json({ 
        success: true, 
        message: data.message?.message || "Doğrulama e-postası ERP tarafından gönderildi." 
    });

  } catch (error: any) {
    console.error("Proxy error:", error);
    return NextResponse.json({ error: "ERP sunucusuna bağlanılamadı." }, { status: 500 });
  }
}