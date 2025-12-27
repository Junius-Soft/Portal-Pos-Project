import { NextRequest, NextResponse } from "next/server";
import { erpGet, erpPost, erpPut } from "@/lib/erp";

/**
 * Bu API endpoint'i Lead'i bulur ve günceller, yoksa oluşturur.
 * Her registration sayfasından Next'e basıldığında bu endpoint çağrılacak.
 */
export async function POST(req: NextRequest) {
  try {
    const { 
      email, // User'ı bulmak için
      companyInfo, // Company Information form verileri (opsiyonel)
      businesses, // Business bilgileri (opsiyonel)
      paymentInfo, // Payment Information (opsiyonel)
      documents, // Documents bilgileri (opsiyonel)
      services, // Selected services (opsiyonel)
    } = await req.json();

    if (!email) {
      return NextResponse.json(
        { error: "Email is required to find user" },
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

    // 1) User'ı email ile bul
    let user;
    try {
      user = await erpGet(`/api/resource/User/${encodeURIComponent(email)}`, token);
      user = user?.data || user;
    } catch (e: any) {
      return NextResponse.json(
        { error: "User not found. Please register first." },
        { status: 404 }
      );
    }

    // 2) Custom User Register'dan company_name gibi ek bilgileri al
    let customUserRegister = null;
    try {
      const filters = encodeURIComponent(JSON.stringify([["user", "=", user.name]]));
      const fields = encodeURIComponent(JSON.stringify(["*"]));
      const customUserResult = await erpGet(
        `/api/resource/Custom User Register?filters=${filters}&fields=${fields}`,
        token
      );
      
      if (customUserResult?.data && Array.isArray(customUserResult.data) && customUserResult.data.length > 0) {
        customUserRegister = customUserResult.data[0];
      } else if (Array.isArray(customUserResult) && customUserResult.length > 0) {
        customUserRegister = customUserResult[0];
      }
    } catch (e: any) {
      console.warn("Could not fetch Custom User Register:", e.message);
    }

    // 3) Lead'i email ile bul (yoksa oluşturulacak)
    let existingLead = null;
    try {
      // Email ile Lead ara - farklı formatlarda dene
      const leadFilters = encodeURIComponent(JSON.stringify([["email_id", "=", email]]));
      const leadFields = encodeURIComponent(JSON.stringify(["name", "email_id", "company_name"]));
      
      const leadResult = await erpGet(
        `/api/resource/Lead?filters=${leadFilters}&fields=${leadFields}&limit_page_length=1`,
        token
      );

      // ERPNext response formatını kontrol et
      let leads = [];
      if (leadResult?.data && Array.isArray(leadResult.data)) {
        leads = leadResult.data;
      } else if (Array.isArray(leadResult)) {
        leads = leadResult;
      } else if (leadResult?.message && Array.isArray(leadResult.message)) {
        leads = leadResult.message;
      }

      if (leads.length > 0) {
        existingLead = leads[0];
        console.log("Existing Lead found:", existingLead.name, "for email:", email);
      } else {
        console.log("No existing Lead found for email:", email);
      }
    } catch (e: any) {
      console.error("Error fetching existing Lead:", e);
      // Hata durumunda devam et, yeni Lead oluşturulacak
    }

    // 4) Country isimlerini normalize et
    const normalizeCountry = (country: string | undefined | null): string | undefined => {
      if (!country) return country ?? undefined;

      const map: Record<string, string> = {
        "Türkiye": "Turkey",
        "Turkiye": "Turkey",
        "Republic of Turkey": "Turkey",
        "Deutschland": "Germany",
        "Federal Republic of Germany": "Germany",
        "United States of America": "United States",
      };

      return map[country] || country;
    };

    // 5) Lead payload'ı hazırla (mevcut Lead varsa güncelle, yoksa yeni oluştur)
    const companyName = customUserRegister?.company_name || companyInfo?.companyName || existingLead?.company_name || "";

    const leadPayload: any = {
      email_id: email,
      status: "Open",
      lead_type: "Client",
    };

    // Eğer yeni Lead oluşturuluyorsa lead_name ve company_name ekle
    if (!existingLead) {
      leadPayload.lead_name = companyName || user.first_name || email;
      leadPayload.company_name = companyName;
    } else {
      // Mevcut Lead'i güncelle
      leadPayload.name = existingLead.name;
    }

    // Telefon numarası
    if (customUserRegister?.telephone) {
      leadPayload.phone = customUserRegister.telephone;
      leadPayload.mobile_no = customUserRegister.telephone;
    } else if (user.mobile_no) {
      leadPayload.phone = user.mobile_no;
      leadPayload.mobile_no = user.mobile_no;
    }

    // Company Information (varsa)
    if (companyInfo) {
      console.log("Company Info received:", JSON.stringify(companyInfo, null, 2));
      
      if (companyInfo.street) {
        leadPayload.address_line1 = companyInfo.street;
      }
      if (companyInfo.city) {
        leadPayload.city = companyInfo.city;
      }
      if (companyInfo.zipCode) {
        leadPayload.pincode = companyInfo.zipCode;
      }
      if (companyInfo.federalState) {
        leadPayload.state = companyInfo.federalState;
      }
      if (companyInfo.country) {
        leadPayload.country = normalizeCountry(companyInfo.country);
      }
      if (companyInfo.vatIdentificationNumber) {
        leadPayload.custom_vat_identification_number = companyInfo.vatIdentificationNumber;
        console.log("Added custom_vat_identification_number:", companyInfo.vatIdentificationNumber);
      }
      // taxIdNumber için hem undefined/null hem de boş string kontrolü yap
      // Not: ERPNext'te field adı custom_custom_tax_id_number (double custom prefix)
      if (companyInfo.taxIdNumber && companyInfo.taxIdNumber.trim() !== "") {
        leadPayload.custom_custom_tax_id_number = companyInfo.taxIdNumber.trim();
        console.log("Added custom_custom_tax_id_number:", companyInfo.taxIdNumber);
        console.log("taxIdNumber will be saved to custom_custom_tax_id_number field");
      } else {
        console.log("taxIdNumber is missing or empty. companyInfo.taxIdNumber:", companyInfo.taxIdNumber);
      }
      
      console.log("Lead payload after companyInfo (including taxIdNumber):", JSON.stringify(leadPayload, null, 2));
    } else {
      console.log("No companyInfo provided");
    }

    // Businesses array'ini JSON olarak kaydet
    if (businesses && Array.isArray(businesses) && businesses.length > 0) {
      leadPayload.custom_businesses = JSON.stringify(businesses);
      console.log("Added custom_businesses:", businesses);
    }

    // Lead'i oluştur veya güncelle (Address oluşturmak için Lead'in name'ine ihtiyacımız var)

    // Payment Information (varsa)
    if (paymentInfo) {
      console.log("Processing paymentInfo:", paymentInfo);
      if (paymentInfo.accountHolder) {
        leadPayload.custom_account_holder = paymentInfo.accountHolder;
        console.log("Added custom_account_holder:", paymentInfo.accountHolder);
      }
      if (paymentInfo.iban) {
        leadPayload.custom_iban = paymentInfo.iban;
        console.log("Added custom_iban:", paymentInfo.iban);
      }
      if (paymentInfo.bic) {
        // BIC field'ını kaydet - ERPNext'te field adı custom_bic veya custom_custom_bic olabilir
        leadPayload.custom_bic = paymentInfo.bic;
        // Eğer custom_custom_bic gerekirse (Tax ID gibi double prefix varsa)
        // leadPayload.custom_custom_bic = paymentInfo.bic;
        console.log("Added custom_bic:", paymentInfo.bic);
        console.log("BIC will be saved to custom_bic field");
      } else {
        console.log("BIC is missing or empty. paymentInfo.bic:", paymentInfo.bic);
      }
      console.log("Lead payload after paymentInfo:", JSON.stringify(leadPayload, null, 2));
    } else {
      console.log("No paymentInfo provided");
    }

    // Documents (varsa)
    if (documents) {
      if (documents.typeOfCompany) {
        leadPayload.custom_type_of_company = documents.typeOfCompany;
      }
      if (documents.businessRegistrationFiles) {
        leadPayload.custom_business_registration_files = JSON.stringify(documents.businessRegistrationFiles);
      }
      if (documents.idFiles) {
        leadPayload.custom_id_files = JSON.stringify(documents.idFiles);
      }
      if (documents.shareholdersFiles) {
        leadPayload.custom_shareholders_files = JSON.stringify(documents.shareholdersFiles);
      }
      if (documents.registerExtractFiles) {
        leadPayload.custom_register_extract_files = JSON.stringify(documents.registerExtractFiles);
      }
      if (documents.hrExtractFiles) {
        leadPayload.custom_hr_extract_files = JSON.stringify(documents.hrExtractFiles);
      }
      // Eğer tüm belgeler yüklendiyse registration status'u güncelle
      if (documents.isCompleted) {
        leadPayload.custom_registration_status = "Completed";
      }
    }

    // Services (varsa) - JSON olarak saklanacak
    if (services && Array.isArray(services) && services.length > 0) {
      // Services'i Lead'de custom field'a JSON string olarak kaydet
      // ERPNext'te custom_selected_services field'ı eklenmeli
      leadPayload.custom_selected_services = JSON.stringify(services);
      console.log("Added custom_selected_services:", services);
    }

    // Lead'i oluştur veya güncelle
    let leadResult;
    if (existingLead && existingLead.name) {
      // Mevcut Lead'i güncelle
      console.log("Updating existing Lead:", existingLead.name);
      console.log("Lead payload before update:", JSON.stringify(leadPayload, null, 2));
      // PUT için name field'ını kaldır (path'te zaten var)
      const { name, ...updatePayload } = leadPayload;
      console.log("Update payload:", JSON.stringify(updatePayload, null, 2));
      leadResult = await erpPut(`/api/resource/Lead/${encodeURIComponent(existingLead.name)}`, updatePayload, token);
      console.log("Lead update result:", JSON.stringify(leadResult, null, 2));
    } else {
      // Yeni Lead oluştur
      console.log("Creating new Lead for email:", email);
      // Yeni Lead oluştururken name field'ını gönderme (ERPNext otomatik oluşturur)
      const { name, ...createPayload } = leadPayload;
      
      try {
        leadResult = await erpPost("/api/resource/Lead", createPayload, token);
      } catch (createError: any) {
        // Eğer duplicate error alırsak (email zaten kullanılıyorsa), Lead'i tekrar bul ve güncelle
        if (createError.message?.includes("Email Address must be unique") || createError.message?.includes("DuplicateEntryError")) {
          console.log("Duplicate email detected, trying to find and update existing Lead");
          
          // Lead'i tekrar bul
          const leadFilters = encodeURIComponent(JSON.stringify([["email_id", "=", email]]));
          const leadFields = encodeURIComponent(JSON.stringify(["name", "email_id"]));
          const retryLeadResult = await erpGet(
            `/api/resource/Lead?filters=${leadFilters}&fields=${leadFields}`,
            token
          );

          const retryLeads = retryLeadResult?.data || (Array.isArray(retryLeadResult) ? retryLeadResult : []);
          if (Array.isArray(retryLeads) && retryLeads.length > 0) {
            const foundLead = retryLeads[0];
            console.log("Found existing Lead, updating:", foundLead.name);
            const { name, ...updatePayload } = leadPayload;
            leadResult = await erpPut(`/api/resource/Lead/${encodeURIComponent(foundLead.name)}`, updatePayload, token);
          } else {
            // Bulamadıysak hatayı fırlat
            throw createError;
          }
        } else {
          // Başka bir hata ise fırlat
          throw createError;
        }
      }
    }

    const updatedLead = leadResult?.data || leadResult;
    const leadName = updatedLead.name;
    
    // Debug: Updated Lead'i kontrol et
    console.log("Updated Lead response - checking for custom fields:");
    console.log("custom_custom_tax_id_number in response:", updatedLead.custom_custom_tax_id_number);
    console.log("custom_bic in response:", updatedLead.custom_bic);
    console.log("custom_custom_bic in response:", updatedLead.custom_custom_bic);
    console.log("All custom fields in Lead:", Object.keys(updatedLead).filter(key => key.startsWith('custom_')));

    // Address kaydını oluştur veya güncelle (companyInfo varsa)
    if (companyInfo && (companyInfo.street || companyInfo.city || companyInfo.country)) {
      try {
        // Önce mevcut Address kaydını bul (Lead'e bağlı Billing address)
        const addressFilters = encodeURIComponent(
          JSON.stringify([
            ["link_doctype", "=", "Lead"],
            ["link_name", "=", leadName],
            ["address_type", "=", "Billing"]
          ])
        );
        const addressFields = encodeURIComponent(JSON.stringify(["name", "address_title"]));
        const existingAddressResult = await erpGet(
          `/api/resource/Address?filters=${addressFilters}&fields=${addressFields}`,
          token
        );

        const existingAddresses = existingAddressResult?.data || (Array.isArray(existingAddressResult) ? existingAddressResult : []);
        
        // Address payload'ı hazırla
        const addressTitle = companyInfo.companyName || "Billing";
        const addressPayload: any = {
          address_title: addressTitle,
          address_type: "Billing",
          link_doctype: "Lead",
          link_name: leadName,
        };

        if (companyInfo.street) {
          addressPayload.address_line1 = companyInfo.street;
        }
        if (companyInfo.city) {
          addressPayload.city = companyInfo.city;
          addressPayload.county = companyInfo.city; // County olarak da kaydet
        }
        if (companyInfo.zipCode) {
          addressPayload.pincode = companyInfo.zipCode;
        }
        if (companyInfo.federalState) {
          addressPayload.state = companyInfo.federalState;
        }
        if (companyInfo.country) {
          addressPayload.country = normalizeCountry(companyInfo.country);
        }

        if (Array.isArray(existingAddresses) && existingAddresses.length > 0) {
          // Mevcut Address'i güncelle
          const existingAddress = existingAddresses[0];
          console.log("Updating existing Address:", existingAddress.name);
          const { name, ...updateAddressPayload } = addressPayload;
          await erpPut(`/api/resource/Address/${encodeURIComponent(existingAddress.name)}`, updateAddressPayload, token);
        } else {
          // Yeni Address oluştur
          console.log("Creating new Address for Lead:", leadName);
          await erpPost("/api/resource/Address", addressPayload, token);
        }
      } catch (addressError: any) {
        console.error("Error creating/updating Address:", addressError);
        // Address hatası Lead'i etkilemesin, sadece log'layalım
      }
    }

    return NextResponse.json({
      success: true,
      lead: updatedLead,
      message: existingLead ? "Lead updated successfully" : "Lead created successfully",
    });
  } catch (e: any) {
    console.error("ERP lead update/create error:", e);
    
    const errorMessage = typeof e?.message === "string" ? e.message : "";
    
    return NextResponse.json(
      {
        error: errorMessage || "Failed to update/create lead in ERP",
      },
      { status: 500 }
    );
  }
}

