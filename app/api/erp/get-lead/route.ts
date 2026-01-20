import { NextRequest, NextResponse } from "next/server";
import { erpGet } from "@/lib/erp";

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 });

    const token = process.env.ERP_API_TOKEN;
    if (!token) return NextResponse.json({ error: "Token missing" }, { status: 500 });

    // 1. Lead'i Bul
    const leadFilters = encodeURIComponent(JSON.stringify([["email_id", "=", email]]));
    const leadResult = await erpGet(`/api/resource/Lead?filters=${leadFilters}&limit_page_length=1`, token);
    const leads = leadResult?.data || (Array.isArray(leadResult) ? leadResult : []);

    if (leads.length === 0) {
      return NextResponse.json({ success: false, message: "No lead found" });
    }

    const lead = leads[0];
    const leadName = lead.name;

    // 2. Detaylı Lead Verisini Çek (Child Table'lar için)
    let fullLead = null;
    try {
        const res = await erpGet(`/api/resource/Lead/${encodeURIComponent(leadName)}`, token);
        fullLead = res?.data || res;
    } catch (e) {
        // Error fetching full lead
    }

    // Mevcut lead objesini fullLead ile birleştir
    if (fullLead) {
        Object.assign(lead, fullLead);
    }

    // --- SERVİS VERİSİNİ PARSE ETME (DÜZELTİLDİ) ---
    let selectedServices: string[] = [];

    // Yöntem A: Önce String Alanına Bak (custom_selected_services)
    // Burası artık hem JSON array'i hem de "Virgüllü String"i kabul eder.
    if (lead.custom_selected_services) {
        const raw = lead.custom_selected_services;
        if (typeof raw === "string") {
            if (raw.trim().startsWith("[")) {
                // JSON formatındaysa (örn: '["Premium", "Basic"]')
                try { selectedServices = JSON.parse(raw); } catch (e) {}
            } else {
                // Virgülle ayrılmışsa (örn: "Premium, Basic")
                selectedServices = raw.split(",").map((s: string) => s.trim()).filter(Boolean);
            }
        }
    }

    // Yöntem B: Eğer String boşsa Child Table'a bak (Yedek)
    // Child table'da service ID'si veya adı olabilir
    if (selectedServices.length === 0 && lead.services && Array.isArray(lead.services)) {
        selectedServices = lead.services.map((row: any) => 
            row.service_name || row.service || row.name
        ).filter(Boolean);
    }

    // Frontend'in kullanacağı temiz formatı hazırla
    // Frontend bu array'i alıp ID/İsim eşleştirmesi yapacak
    lead.custom_selected_services = JSON.stringify(selectedServices);


    // 3. Diğer alanları parse et (Businesses vb.)
    let businesses = [];
    try {
        if (lead.custom_businesses) businesses = JSON.parse(lead.custom_businesses);
    } catch (e) {}

    // 4. Lead'e bağlı Address'leri çek (Ana company address için)
    let mainCompanyAddress = null;
    try {
        // Lead'e bağlı Address'leri filtrele
        const addressFilters = encodeURIComponent(JSON.stringify([
            ["links.link_doctype", "=", "Lead"],
            ["links.link_name", "=", leadName],
            ["address_type", "=", "Billing"] // Ana company address
        ]));
        const addressResult = await erpGet(`/api/resource/Address?filters=${addressFilters}&limit_page_length=1`, token);
        const addresses = addressResult?.data || (Array.isArray(addressResult) ? addressResult : []);
        
        if (addresses.length > 0) {
            mainCompanyAddress = addresses[0];
        }
    } catch (e) {
        console.error("Error fetching addresses:", e);
        // Hata olsa bile devam et
    }

    return NextResponse.json({
      success: true,
      lead: {
        ...lead,
        businesses,
        mainCompanyAddress, // Ana company address'i ekle
        // Frontend'e her zaman string array (JSON) olarak gönderiyoruz
        custom_selected_services: JSON.stringify(selectedServices) 
      }
    });

  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Server Error" }, { status: 500 });
  }
}