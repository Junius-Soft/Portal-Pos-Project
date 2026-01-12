import { NextRequest, NextResponse } from "next/server";
import { erpGet, erpPost, erpPut, erpUploadFile } from "@/lib/erp";

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";
    let email: string = "";
    let companyInfo: any = null;
    let businesses: any = null;
    let paymentInfo: any = null;
    let documents: any = null;
    let services: any = null; // ID Listesi: ["id1", "id2"]
    let uploadedFiles: Record<string, File[]> = {};

    // 1. Veri Ayrıştırma
    if (contentType.includes("multipart/form-data")) {
        const formData = await req.formData();
        email = formData.get("email") as string || "";
        const parse = (k: string) => { try { return JSON.parse(formData.get(k) as string); } catch { return null; } };
        
        companyInfo = parse("companyInfo");
        businesses = parse("businesses");
        paymentInfo = parse("paymentInfo");
        documents = parse("documents");
        services = parse("services");
        
        for (const [key, value] of Array.from(formData.entries())) {
            if (value instanceof File && key.startsWith("document_")) {
                const match = key.match(/^document_(.+)_(\d+)$/);
                if (match) {
                    const id = match[1];
                    if (!uploadedFiles[id]) uploadedFiles[id] = [];
                    uploadedFiles[id].push(value);
                }
            }
        }
    } else {
        const body = await req.json();
        email = body.email;
        companyInfo = body.companyInfo;
        businesses = body.businesses;
        paymentInfo = body.paymentInfo;
        documents = body.documents;
        services = body.services;
    }

    if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 });
    const token = process.env.ERP_API_TOKEN;
    if (!token) return NextResponse.json({ error: "Token missing" }, { status: 500 });

    // 2. User/Lead Bulma
    let existingLead = null;
    try {
        const filters = encodeURIComponent(JSON.stringify([["email_id", "=", email]]));
        const res = await erpGet(`/api/resource/Lead?filters=${filters}&limit_page_length=1`, token);
        const data = res?.data || (Array.isArray(res) ? res : []);
        if (data.length > 0) existingLead = data[0];
    } catch(e) {}

    // 3. Payload Hazırlama
    const leadPayload: any = {
        email_id: email,
        company_name: companyInfo?.companyName || existingLead?.company_name || email,
    };

    if (!existingLead) {
        leadPayload.lead_name = leadPayload.company_name;
        leadPayload.status = "Open";
    }

    // Company Info, Payment vb. (Kısaltıldı, standart atamalar)
    if (companyInfo) {
        if (companyInfo.companyName) leadPayload.company_name = companyInfo.companyName;
        if (companyInfo.vatIdentificationNumber) leadPayload.custom_vat_identification_number = companyInfo.vatIdentificationNumber;
        if (companyInfo.taxIdNumber) leadPayload.custom_tax_id_number = companyInfo.taxIdNumber;
        
        let street = companyInfo.street || "";
        if (!street && (companyInfo.city || companyInfo.country)) {
            street = [companyInfo.city, companyInfo.zipCode, companyInfo.country].filter(Boolean).join(" ");
        }
        if (street) leadPayload.address_line1 = street;
        if (companyInfo.city) leadPayload.city = companyInfo.city;
        if (companyInfo.country) leadPayload.country = companyInfo.country;
        if (companyInfo.zipCode) leadPayload.pincode = companyInfo.zipCode;
        if (companyInfo.federalState) leadPayload.state = companyInfo.federalState;
    }

    if (businesses) leadPayload.custom_businesses = JSON.stringify(businesses);
    
    if (paymentInfo) {
        if (paymentInfo.iban) leadPayload.custom_iban = paymentInfo.iban;
        if (paymentInfo.accountHolder) leadPayload.custom_account_holder = paymentInfo.accountHolder;
        if (paymentInfo.bic) leadPayload.custom_bic = paymentInfo.bic;
    }

    // --- SERVİSLERİ İŞLEME (ID -> İSİM) ---
    if (services && Array.isArray(services)) {
        let serviceNamesList: string[] = [];
        
        try {
            // ID'lerden İsimleri Bulmak için ERP'yi sorgula
            // Filtre: ID'si (name) bizim listemizde olanlar
            const idsJson = JSON.stringify(services);
            const filters = `[["name", "in", ${idsJson}]]`;
            const fields = `["name", "service_name", "title"]`;
            
            let serviceData = [];
            // Önce 'Service', olmazsa 'Services' doctype dene
            try {
                const res = await erpGet(`/api/resource/Service?filters=${encodeURIComponent(filters)}&fields=${encodeURIComponent(fields)}`, token);
                serviceData = res?.data || (Array.isArray(res) ? res : []);
            } catch {
                const res = await erpGet(`/api/resource/Services?filters=${encodeURIComponent(filters)}&fields=${encodeURIComponent(fields)}`, token);
                serviceData = res?.data || (Array.isArray(res) ? res : []);
            }

            // ID -> İsim Haritası oluştur
            const idMap = new Map();
            serviceData.forEach((s: any) => {
                // service_name, title veya name(id) hangisi varsa onu kullan
                const name = s.service_name || s.title || s.name;
                idMap.set(s.name, name);
            });

            // Orijinal sırayı bozmadan isim listesini oluştur
            serviceNamesList = services.map((id: string) => idMap.get(id) || id);

        } catch (e) {
            console.warn("Service lookup failed, using IDs as names:", e);
            serviceNamesList = services;
        }

        console.log("Saving Service Names to ERP:", serviceNamesList);

        // 1. String Alanına İsimleri Yaz (Kullanıcı İsteği: İsim Görünsün)
        leadPayload.custom_selected_services = serviceNamesList.join(", ");
        leadPayload.custom_selected_service_names = serviceNamesList.join(", "); 

        // 2. Child Table (Teknik Eşleşme)
        // Link alanı ID ister, İsim alanı Name ister.
        leadPayload.services = services.map((id: string, idx: number) => ({
            service: id, // Link (ID)
            service_name: serviceNamesList[idx], // Display Name
            terms_accepted: 1
        }));
    }

    // --- 4. Kaydetme İşlemi (Güvenli Mod) ---
    let leadResult;
    const save = async (data: any) => {
        if (existingLead?.name) return await erpPut(`/api/resource/Lead/${encodeURIComponent(existingLead.name)}`, data, token);
        return await erpPost("/api/resource/Lead", data, token);
    };

    try {
        // İlk deneme: Full paket (Child Table dahil)
        leadResult = await save(leadPayload);
    } catch (e) {
        console.warn("Full update failed, retrying without child table...", e);
        // Hata verirse Child Table'ı silip sadece String alanları kaydet (En azından isimler gitsin)
        if (leadPayload.services) {
            delete leadPayload.services;
            leadResult = await save(leadPayload);
        } else {
            throw e; 
        }
    }

    // Dosyaları yükle...
    const leadName = (leadResult?.data || leadResult).name;
    if (uploadedFiles && Object.keys(uploadedFiles).length > 0) {
        for (const [key, files] of Object.entries(uploadedFiles)) {
            for (const f of files) {
                try { 
                    await erpUploadFile(f, token, "Lead", leadName); 
                } catch {}
            }
        }
    }
    return NextResponse.json({ success: true, lead: leadResult?.data || leadResult });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}