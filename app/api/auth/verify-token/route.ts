import { NextRequest, NextResponse } from "next/server";
import { erpPost } from "@/lib/erp";

export async function POST(req: NextRequest) {
  try {
    const { token: verificationToken } = await req.json();

    if (!verificationToken) {
      return NextResponse.json({ error: "Token bulunamadı." }, { status: 400 });
    }

    const apiToken = process.env.ERP_API_TOKEN;

    // ERP'DEKİ DOĞRULAMA FONKSİYONUNU ÇAĞIR
    const data = await erpPost(
      "/api/method/portal_onboarding.api.signup.verify_token",
      { token: verificationToken },
      apiToken!
    );

    if (data?.exc_type || data?.exception || data?.error) {
        let msg = "Doğrulama başarısız.";
        if (data?._server_messages) {
            try {
                const msgs = JSON.parse(data._server_messages);
                const obj = JSON.parse(msgs[0]);
                msg = obj.message || msg;
            } catch {}
        }
        return NextResponse.json({ error: msg }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: "Doğrulama başarılı.", data });

  } catch (error) {
    return NextResponse.json({ error: "ERP bağlantı hatası." }, { status: 500 });
  }
}