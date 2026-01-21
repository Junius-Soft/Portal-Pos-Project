import { NextRequest, NextResponse } from "next/server";
import { erpGet } from "@/lib/erp";

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
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

    // User'ı email ile bul
    let user;
    try {
      user = await erpGet(`/api/resource/User/${encodeURIComponent(email)}`, token);
      user = user?.data || user;
    } catch (e: any) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Bu kullanıcının Lead'i var mı kontrol et
    // Lead'de email_id veya lead_name ile user'ı eşleştirebiliriz
    try {
      const filters = encodeURIComponent(JSON.stringify([["email_id", "=", email]]));
      const fields = encodeURIComponent(JSON.stringify([
        "name", 
        "email_id", 
        "company_name",
        "custom_registration_status",
        "custom_selected_services",
        "custom_account_holder",
        "custom_company_type"
      ]));
      
      const leadsResult = await erpGet(
        `/api/resource/Lead?filters=${filters}&fields=${fields}`,
        token
      );

      const leads = leadsResult?.data || (Array.isArray(leadsResult) ? leadsResult : []);

      // Eğer en az bir Lead varsa, kullanıcı company information'ı doldurmuş demektir
      if (Array.isArray(leads) && leads.length > 0) {
        const lead = leads[0];
        const registrationStatus = lead.custom_registration_status || "Incomplete";
        const isRegistrationCompleted = registrationStatus === "Completed";
        
        return NextResponse.json({
          hasLead: true,
          lead: lead,
          isRegistrationCompleted: isRegistrationCompleted,
          registrationStatus: registrationStatus,
        });
      } else {
        return NextResponse.json({
          hasLead: false,
          isRegistrationCompleted: false,
          registrationStatus: "No Lead",
        });
      }
    } catch (e: any) {
      console.error("Error checking lead:", e);
      // Lead kontrolü başarısız olursa, yine de false döndürelim (güvenli taraf)
      return NextResponse.json({
        hasLead: false,
      });
    }
  } catch (e: any) {
    console.error("Check lead error:", e);
    return NextResponse.json(
      {
        error: e.message || "Failed to check lead",
      },
      { status: 500 }
    );
  }
}

