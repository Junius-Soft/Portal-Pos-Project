import { NextRequest, NextResponse } from "next/server";
import { erpPost } from "@/lib/erp";

export async function POST(req: NextRequest) {
  try {
    const { email, password, firstName, telephone, companyName, reference } = await req.json();

    if (!email || !password || !firstName) {
      return NextResponse.json(
        { error: "Email, password and customer name are required" },
        { status: 400 }
      );
    }

    const token = process.env.ERP_API_TOKEN;

    if (!token) {
      return NextResponse.json(
        { error: "ERP_API_TOKEN environment variable is not set" },
        { status: 500 }
      );
    }

    // 1) Önce ERP'de User oluştur
    const userPayload: any = {
      email,
      first_name: firstName,
      enabled: 1,
      send_welcome_email: 0,
      user_type: "Website User",
      new_password: password,
    };

    if (telephone) {
      userPayload.mobile_no = telephone;
    }

    const userResult = await erpPost("/api/resource/User", userPayload, token);
    const createdUser = userResult?.data || userResult;
    const userName = createdUser?.name || email;

    // 2) Ek bilgileri Custom User Register DocType'ına yaz
    // Not: DocType adı ERP'de oluşturduğun isimle birebir aynı olmalı.
    const registrationPayload: any = {
      user: userName,
      email,
    };

    if (reference) {
      registrationPayload.reference = reference;
    }

    if (companyName) {
      registrationPayload.company_name = companyName;
    }

    if (firstName) {
      registrationPayload.customer_name = firstName;
    }

    if (telephone) {
      registrationPayload.telephone = telephone;
    }

    const registrationDoctype = "Custom User Register";
    const registrationResult = await erpPost(
      `/api/resource/${encodeURIComponent(registrationDoctype)}`,
      registrationPayload,
      token
    );

    return NextResponse.json({
      success: true,
      user: createdUser,
      registration: registrationResult?.data || registrationResult,
    });
  } catch (e: any) {
    console.error("ERP user registration error:", e);
    
    // ERPNext hata mesajını parse et
    const errorMessage = typeof e?.message === "string" ? e.message : "";
    
    // Parola güvenlik hatası kontrolü
    if (
      errorMessage.includes("commonly used password") ||
      errorMessage.includes("All-uppercase") ||
      errorMessage.includes("all-lowercase") ||
      errorMessage.includes("ValidationError") ||
      errorMessage.includes("password")
    ) {
      // ERPNext'in parola hatasını daha anlaşılır hale getir
      let userFriendlyMessage = "Parola çok zayıf. Lütfen daha güçlü bir parola kullanın.";
      
      if (errorMessage.includes("commonly used password")) {
        userFriendlyMessage = "Bu parola çok yaygın kullanılan bir parolaya benziyor. Lütfen daha benzersiz bir parola seçin.";
      } else if (errorMessage.includes("All-uppercase") || errorMessage.includes("all-lowercase")) {
        userFriendlyMessage = "Parola hem büyük hem küçük harf içermelidir.";
      }
      
      return NextResponse.json(
        {
          error: userFriendlyMessage,
          errorType: "password_validation",
        },
        { status: 400 }
      );
    }
    
    // Diğer hatalar için genel mesaj
    return NextResponse.json(
      {
        error: errorMessage || "Kullanıcı kaydı başarısız oldu. Lütfen tekrar deneyin.",
      },
      { status: 500 }
    );
  }
}


