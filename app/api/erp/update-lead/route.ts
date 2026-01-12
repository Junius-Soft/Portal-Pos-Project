import { NextRequest, NextResponse } from "next/server";
import { erpGet, erpPost, erpPut } from "@/lib/erp";
import countries from "i18n-iso-countries";
// Dil paketlerini yüklüyoruz
import tr from "i18n-iso-countries/langs/tr.json";
import en from "i18n-iso-countries/langs/en.json";
import de from "i18n-iso-countries/langs/de.json"; // Almanca desteği de ekleyelim

// Kütüphaneye dilleri tanıtıyoruz
countries.registerLocale(tr);
countries.registerLocale(en);
countries.registerLocale(de);

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";
    let email: string = "";
    let companyInfo: any = null;
    let businesses: any = null;
    let paymentInfo: any = null;
    let documents: any = null;
    let services: any = null;
    let uploadedFiles: Record<string, File[]> = {};

    // --- Veri Ayrıştırma (Aynı Kalıyor) ---
    if (contentType.includes("multipart/form-data")) {
      try {
        const formData = await req.formData();
        email = formData.get("email") as string || "";
        const parseJSON = (key: string) => {
           const val = formData.get(key) as string;
           if (!val) return null;
           try { return JSON.parse(val); } catch (e) { console.warn(`JSON Parse error for ${key}:`, e); return null; }
        };
        companyInfo = parseJSON("companyInfo");
        businesses = parseJSON("businesses");
        paymentInfo = parseJSON("paymentInfo");
        documents = parseJSON("documents");
        services = parseJSON("services");
        // Dosya toplama mantığı...
      } catch (formDataError: any) {
        return NextResponse.json({ error: `FormData error: ${formDataError?.message}` }, { status: 400 });
      }
    } else {
      try {
        const body = await req.json();
        email = body.email || "";
        companyInfo = body.companyInfo || null;
        businesses = body.businesses || null;
        paymentInfo = body.paymentInfo || null;
        documents = body.documents || null;
        services = body.services || null;
      } catch (jsonError: any) {
        return NextResponse.json({ error: "Invalid JSON Body" }, { status: 400 });
      }
    }

    if (!email) return NextResponse.json({ error: "Email is required" }, { status: 400 });
    const token = process.env.ERP_API_TOKEN;
    if (!token) return NextResponse.json({ error: "Server config error" }, { status: 500 });

    // --- Kullanıcı ve Lead Bulma İşlemleri (Aynı Kalıyor) ---
    let user;
    try {
       // ... User bulma mantığı ...
       const userFilters = encodeURIComponent(JSON.stringify([["email", "=", email]]));
       const userResult = await erpGet(`/api/resource/User?filters=${userFilters}&limit_page_length=1`, token);
       const users = userResult?.data || (Array.isArray(userResult) ? userResult : []);
       if (users.length > 0) user = users[0];
       else throw new Error("User not found");
    } catch (e: any) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    let customUserRegister = null;
    try {
      if(user?.name) {
          const filters = encodeURIComponent(JSON.stringify([["user", "=", user.name]]));
          const res = await erpGet(`/api/resource/Custom User Register?filters=${filters}`, token);
          const data = res?.data || res;
          if (Array.isArray(data) && data.length > 0) customUserRegister = data[0];
      }
    } catch (e) {}

    let existingLead = null;
    try {
      const leadFilters = encodeURIComponent(JSON.stringify([["email_id", "=", email]]));
      const res = await erpGet(`/api/resource/Lead?filters=${leadFilters}&limit_page_length=1`, token);
      const leads = res?.data || (Array.isArray(res) ? res : []);
      if (leads.length > 0) existingLead = leads[0];
    } catch (e) {}


    // --- YENİ PROFESYONEL ÜLKE ÇEVİRİ FONKSİYONU ---
    const normalizeCountry = (inputCountry: string | undefined | null): string | undefined => {
      if (!inputCountry) return undefined;

      // 1. Önce gelen verinin dilini tahmin edip ISO Kodunu (Örn: 'TR', 'DE') bulmaya çalışalım.
      // Türkçe (tr), İngilizce (en) veya Almanca (de) olarak deneyelim.
      let isoCode = countries.getAlpha2Code(inputCountry, 'tr') || 
                    countries.getAlpha2Code(inputCountry, 'en') || 
                    countries.getAlpha2Code(inputCountry, 'de');

      // 2. Eğer ISO kodu bulunduysa, bunu ERPNext'in beklediği standart "İngilizce İsme" çevirelim.
      if (isoCode) {
        const englishName = countries.getName(isoCode, 'en');
        if (englishName) return englishName;
      }

      // 3. Hiçbir şey bulunamazsa, gelen veriyi olduğu gibi gönder (Fallback).
      // Belki ERPNext'te o isimle kayıtlıdır.
      return inputCountry;
    };


    // --- Lead Payload Hazırlama ---
    const companyName = customUserRegister?.company_name || companyInfo?.companyName || existingLead?.company_name || user.first_name || email;
    
    const leadPayload: any = {
      email_id: email,
      status: "Open",
      lead_type: "Client",
      company_name: companyName,
    };

    if (!existingLead) {
      leadPayload.lead_name = companyName;
      leadPayload.first_name = user.first_name || "Unknown";
    }

    if (customUserRegister?.telephone || user.mobile_no) {
      leadPayload.mobile_no = customUserRegister?.telephone || user.mobile_no;
    }

    if (companyInfo) {
      let street = (companyInfo.street || "").trim();
      if (!street) {
         const parts = [companyInfo.city, companyInfo.zipCode, companyInfo.country].filter(Boolean);
         street = parts.join(" ");
      }
      if (street) {
        leadPayload.address_line1 = street;
        leadPayload.custom_address_line1 = street;
        leadPayload.custom_address_line_1 = street; 
      }
      if (companyInfo.city) leadPayload.city = companyInfo.city;
      if (companyInfo.zipCode) {
         leadPayload.pincode = companyInfo.zipCode;
         leadPayload.custom_pincode = companyInfo.zipCode;
         leadPayload.custom_postal_code = companyInfo.zipCode;
      }
      if (companyInfo.federalState) {
         leadPayload.state = companyInfo.federalState;
         leadPayload.custom_state = companyInfo.federalState;
      }
      
      // Kullanım:
      if (companyInfo.country) leadPayload.country = normalizeCountry(companyInfo.country);
      
      if (companyInfo.vatIdentificationNumber) leadPayload.custom_vat_identification_number = companyInfo.vatIdentificationNumber;
      if (companyInfo.taxIdNumber) {
         leadPayload.custom_tax_id_number = companyInfo.taxIdNumber;
         leadPayload.custom_custom_tax_id_number = companyInfo.taxIdNumber;
      }
      if (companyInfo.restaurantCount) leadPayload.custom_restaurant_count = parseInt(companyInfo.restaurantCount) || 1;
    }

    if (businesses && Array.isArray(businesses) && businesses.length > 0) {
      leadPayload.custom_businesses = JSON.stringify(businesses);
    }
    
    // (Payment Info ve Services aynı kalıyor...)
    if (paymentInfo) {
       if (paymentInfo.iban) leadPayload.custom_iban = paymentInfo.iban;
       if (paymentInfo.accountHolder) leadPayload.custom_account_holder = paymentInfo.accountHolder;
       if (paymentInfo.bic) leadPayload.custom_bic = paymentInfo.bic;
    }
    if (services && Array.isArray(services)) {
        leadPayload.custom_selected_services = services.join(", ");
    }

    // --- ERP İşlemleri (Create/Update Lead) ---
    let leadResult;
    let leadName = "";

    try {
      if (existingLead?.name) {
        const res = await erpPut(`/api/resource/Lead/${encodeURIComponent(existingLead.name)}`, leadPayload, token);
        leadResult = res?.data || res;
      } else {
        const res = await erpPost("/api/resource/Lead", leadPayload, token);
        leadResult = res?.data || res;
      }
      if (!leadResult || !leadResult.name) throw new Error("No Lead Name returned");
      leadName = leadResult.name;
    } catch (leadError: any) {
      console.error("Lead Error:", leadError);
      return NextResponse.json({ error: `Lead Update Failed: ${leadError.message}` }, { status: 500 });
    }

    // --- Adres Oluşturma ---
    const addressCreationStatus = {
      companyAddress: { success: false, error: null as string | null },
      businessAddresses: [] as any[],
    };

    // 1. Company Address
    if (companyInfo && (companyInfo.street || companyInfo.city)) {
      try {
        const addressTitle = (companyInfo.companyName || "Billing").substring(0, 140);
        const addressPayload = {
          address_title: addressTitle,
          address_type: "Billing",
          address_line1: companyInfo.street || "Unknown",
          city: companyInfo.city,
          country: normalizeCountry(companyInfo.country), // Kullanım
          pincode: companyInfo.zipCode,
          state: companyInfo.federalState,
          links: [{ link_doctype: "Lead", link_name: leadName }]
        };

        // Check & Create Logic (Basitleştirilmiş)
        let addrName = null;
        try {
            const filters = encodeURIComponent(JSON.stringify([["address_title", "=", addressTitle], ["address_type", "=", "Billing"]]));
            const res = await erpGet(`/api/resource/Address?filters=${filters}&limit_page_length=1`, token);
            const d = res?.data || res || [];
            if (d.length > 0) addrName = d[0].name;
        } catch(e) {}

        if (addrName) {
           await erpPut(`/api/resource/Address/${encodeURIComponent(addrName)}`, addressPayload, token);
           addressCreationStatus.companyAddress = { success: true, error: null };
        } else {
           await erpPost("/api/resource/Address", addressPayload, token);
           addressCreationStatus.companyAddress = { success: true, error: null };
        }
      } catch (e: any) {
        addressCreationStatus.companyAddress = { success: false, error: e.message };
      }
    }

    // 2. Business Addresses
    if (businesses && Array.isArray(businesses)) {
      for (let i = 0; i < businesses.length; i++) {
        const bus = businesses[i];
        try {
           if (!bus.businessName && !bus.street) continue;
           const busTitle = (bus.businessName || `Business ${i+1}`).substring(0, 140);
           const busAddrPayload: any = {
             address_title: busTitle,
             address_type: "Shop",
             address_line1: bus.street,
             city: bus.city,
             pincode: bus.postalCode,
             state: bus.federalState,
             country: normalizeCountry(bus.country), // Kullanım
             links: [{ link_doctype: "Lead", link_name: leadName }],
             b1_business_name: bus.businessName,
             b1_owner_director: bus.ownerDirector,
             b1_telephone: bus.ownerTelephone,
             b1_email_address: bus.ownerEmail,
             b1_street_and_house_number: bus.street,
             b1_city: bus.city,
             b1_postal_code: bus.postalCode,
             b1_federal_state: bus.federalState,
             b1_country: normalizeCountry(bus.country) // Kullanım
           };
           // ... (Address Check/Create ve Contact Create logic aynı kalıyor)
           
           // Check logic
           let busAddrName = null;
           const filters = encodeURIComponent(JSON.stringify([["address_title", "=", busTitle], ["address_type", "=", "Shop"]]));
           const res = await erpGet(`/api/resource/Address?filters=${filters}&limit_page_length=1`, token);
           const d = res?.data || res || [];
           if (d.length > 0) {
              busAddrName = d[0].name;
              await erpPut(`/api/resource/Address/${encodeURIComponent(busAddrName)}`, busAddrPayload, token);
           } else {
              const created = await erpPost("/api/resource/Address", busAddrPayload, token);
              busAddrName = created?.data?.name || created?.name;
           }

           addressCreationStatus.businessAddresses.push({ success: true, error: null });

           // Contact
           if (busAddrName) {
             const contactName = bus.differentContact ? bus.contactPerson : bus.ownerDirector;
             if (contactName) {
                // Contact Create logic...
                const contactPayload = {
                   first_name: contactName,
                   email_id: bus.differentContact ? bus.contactEmail : bus.ownerEmail,
                   mobile_no: bus.differentContact ? bus.contactTelephone : bus.ownerTelephone,
                   links: [{ link_doctype: "Lead", link_name: leadName }, { link_doctype: "Address", link_name: busAddrName }]
                };
                try { await erpPost("/api/resource/Contact", contactPayload, token); } catch(e){}
             }
           }

        } catch (busError: any) {
           addressCreationStatus.businessAddresses.push({ success: false, error: busError.message });
        }
      }
    }

    return NextResponse.json({
      success: true,
      lead: leadResult,
      message: existingLead ? "Updated" : "Created",
      addressCreationStatus
    });

  } catch (globalError: any) {
    console.error("Global Error:", globalError);
    return NextResponse.json({ error: globalError.message || "Unknown Server Error" }, { status: 500 });
  }
}