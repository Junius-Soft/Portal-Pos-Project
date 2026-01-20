import { NextRequest, NextResponse } from "next/server";
import { erpGet, erpPost, erpPut } from "@/lib/erp";

export async function POST(req: NextRequest) {
  try {
    const { email, companyName, firstName, lastName, password, companyTypeId } = await req.json();

    if (!email) {
      return NextResponse.json({ error: "Email zorunludur." }, { status: 400 });
    }

    const token = process.env.ERP_API_TOKEN;
    if (!token) {
      return NextResponse.json({ error: "ERP API token eksik." }, { status: 500 });
    }

    const result: any = {
      user: { created: false, exists: false },
      lead: { created: false, updated: false },
    };

    // 1) USER OLUŞTUR
    let userExists = false;
    try {
      const userRes = await erpGet(`/api/resource/User/${encodeURIComponent(email)}`, token);
      if (userRes && (userRes as any).data) {
        userExists = true;
        result.user.exists = true;
      }
    } catch {
      // ignore
    }

    if (!userExists) {
      if (!password) {
        return NextResponse.json(
          { error: "Şifre bulunamadı. Lütfen tekrar kayıt olun." },
          { status: 400 }
        );
      }

      const userPayload: any = {
        doctype: "User",
        email,
        first_name: companyName || firstName || email,
        last_name: lastName || "",
        enabled: 1,
        send_welcome_email: 0,
        user_type: "Website User",
        new_password: password,
      };

      const userCreate = await erpPost("/api/resource/User", userPayload, token);
      if (userCreate?.exc_type || userCreate?.exception || userCreate?.error) {
        return NextResponse.json(
          { error: "User oluşturulamadı.", details: userCreate },
          { status: 400 }
        );
      }

      result.user.created = true;
    }

    // 2) LEAD OLUŞTUR / GÜNCELLE
    const leadFilters = encodeURIComponent(JSON.stringify([["email_id", "=", email]]));
    const leadRes = await erpGet(`/api/resource/Lead?filters=${leadFilters}&limit_page_length=1`, token);
    const leads = (leadRes as any)?.data || (Array.isArray(leadRes) ? leadRes : []);

    if (!leads || leads.length === 0) {
      const leadPayload: any = {
        email_id: email,
        company_name: companyName || email,
        lead_name: companyName || email,
        status: "Open",
        source: "Website",
      };

      const leadCreate = await erpPost("/api/resource/Lead", leadPayload, token);
      if (leadCreate?.exc_type || leadCreate?.exception || leadCreate?.error) {
        return NextResponse.json(
          { error: "Lead oluşturulamadı.", details: leadCreate },
          { status: 400 }
        );
      }

      result.lead.created = true;
      
      // Company Type'ı kaydet (yeni Lead oluşturulduysa)
      if (companyTypeId) {
        const leadName = (leadCreate?.data?.name || leadCreate?.name || leadCreate?.message?.name || "");
        if (leadName) {
          try {
            await erpPut(
              `/api/resource/Lead/${encodeURIComponent(leadName)}`,
              { custom_company_type: companyTypeId },
              token
            );
            console.log("✅ Company type saved to Lead:", companyTypeId);
          } catch (e) {
            console.error("Error saving company type:", e);
          }
        }
      }
    } else if (companyName || companyTypeId) {
      const leadName = leads[0].name;
      const updatePayload: any = {};
      if (companyName) {
        updatePayload.company_name = companyName;
        updatePayload.lead_name = companyName;
      }
      if (companyTypeId) {
        updatePayload.custom_company_type = companyTypeId;
      }
      
      const leadUpdate = await erpPut(
        `/api/resource/Lead/${encodeURIComponent(leadName)}`,
        updatePayload,
        token
      );

      if (!(leadUpdate?.exc_type || leadUpdate?.exception || leadUpdate?.error)) {
        result.lead.updated = true;
        if (companyTypeId) {
          console.log("✅ Company type saved to Lead:", companyTypeId);
        }
      }
    }

    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    console.error("complete-signup error:", error);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
}
