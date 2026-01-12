import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { token: verificationToken } = await req.json();

    if (!verificationToken) {
      return NextResponse.json({ error: "Token bulunamadı." }, { status: 400 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_ERP_BASE_URL;
    const apiToken = process.env.ERP_API_TOKEN;

    // ERP'DEKİ DOĞRULAMA FONKSİYONUNU ÇAĞIR
    const res = await fetch(`${baseUrl}/api/method/portal_onboarding.api.signup.verify_token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": apiToken!,
      },
      body: JSON.stringify({ token: verificationToken }),
    });

    const data = await res.json();

    if (!res.ok) {
        let msg = "Doğrulama başarısız.";
        if (data._server_messages) {
            try {
                const msgs = JSON.parse(data._server_messages);
                const obj = JSON.parse(msgs[0]);
                msg = obj.message || msg;
            } catch {}
        }
        return NextResponse.json({ error: msg }, { status: res.status });
    }

    return NextResponse.json({ success: true, message: "Doğrulama başarılı." });

  } catch (error) {
    return NextResponse.json({ error: "ERP bağlantı hatası." }, { status: 500 });
  }
}