import { NextRequest, NextResponse } from "next/server";
import { erpGet } from "@/lib/erp";

/**
 * Bu API endpoint'i kullanıcının Lead'ini getirir.
 * Login olduğunda form verilerini doldurmak için kullanılacak.
 */
export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const token = process.env.ERP_API_TOKEN;
    if (!token) return NextResponse.json({ error: "Token missing" }, { status: 500 });

    // 1. Lead'i email ile bul
    const leadFilters = encodeURIComponent(JSON.stringify([["email_id", "=", email]]));
    const leadResult = await erpGet(`/api/resource/Lead?filters=${leadFilters}&fields=["*"]`, token);
    const leads = leadResult?.data || (Array.isArray(leadResult) ? leadResult : []);

    if (Array.isArray(leads) && leads.length > 0) {
      const lead = leads[0];
      const leadName = lead.name;
      
      // 2. Lead Detaylarını (Child Table'lar dahil) Çek
      try {
        const fullLead = await erpGet(`/api/resource/Lead/${encodeURIComponent(leadName)}`, token);
        const fullLeadData = fullLead?.data || fullLead;
        
        // Servisleri Child Table'dan al (services, custom_services veya lead_services olabilir)
        if (fullLeadData) {
            lead.services = fullLeadData.services || fullLeadData.custom_services || fullLeadData.lead_services || [];
        }
      } catch (e) {
        console.warn("Full lead fetch error:", e);
      }

      // --- ADRES ÇEKME (DÜZELTİLDİ) ---
      // link_doctype yerine address_title (Company Name) kullanıyoruz.
      
      let billingAddress = null;
      try {
        const addressTitle = lead.company_name || lead.lead_name || "Billing";
        
        const addressFilters = encodeURIComponent(JSON.stringify([
          ["address_title", "=", addressTitle],
          ["address_type", "=", "Billing"]
        ]));
        
        const addressResult = await erpGet(`/api/resource/Address?filters=${addressFilters}&fields=["*"]&limit_page_length=1`, token);
        const addresses = addressResult?.data || addressResult || [];
        
        if (addresses.length > 0) {
          billingAddress = addresses[0];
          // Adres bilgilerini Lead'e işle
          lead.address_line1 = billingAddress.address_line1 || lead.address_line1;
          lead.custom_address_line1 = billingAddress.address_line1 || lead.custom_address_line1;
          lead.city = billingAddress.city || lead.city;
          lead.pincode = billingAddress.pincode || lead.pincode;
          lead.custom_pincode = billingAddress.pincode || lead.custom_pincode;
          lead.state = billingAddress.state || lead.state;
          lead.custom_state = billingAddress.state || lead.custom_state;
          lead.country = billingAddress.country || lead.country;
        }
      } catch (addrErr) {
        console.warn("Billing Address fetch error:", addrErr);
      }

      // 3. JSON Alanlarını Parse Et
      const parseJSON = (str: any) => {
          if (!str) return [];
          try { return typeof str === 'string' ? JSON.parse(str) : str; } catch { return []; }
      };

      const businessRegistrationFiles = parseJSON(lead.custom_business_registration_files);
      const idFiles = parseJSON(lead.custom_id_files);
      const shareholdersFiles = parseJSON(lead.custom_shareholders_files);
      const registerExtractFiles = parseJSON(lead.custom_register_extract_files);
      const hrExtractFiles = parseJSON(lead.custom_hr_extract_files);
      
      let businesses = parseJSON(lead.custom_businesses);
      if (!Array.isArray(businesses)) businesses = [];

      // 4. BUSINESS ADDRESSES (DÜZELTİLDİ)
      // Her business için ismine (businessName) göre adresini bulup bilgilerini güncelle
      if (businesses.length > 0) {
          for (let i = 0; i < businesses.length; i++) {
              const bus = businesses[i];
              if (!bus.businessName) continue;

              try {
                  const bFilters = encodeURIComponent(JSON.stringify([
                      ["address_title", "=", bus.businessName],
                      ["address_type", "=", "Shop"]
                  ]));
                  const bRes = await erpGet(`/api/resource/Address?filters=${bFilters}&fields=["*"]&limit_page_length=1`, token);
                  const bAddrs = bRes?.data || bRes || [];

                  if (bAddrs.length > 0) {
                      const addr = bAddrs[0];
                      // Adres bilgilerini business objesine merge et
                      businesses[i] = {
                          ...bus,
                          street: addr.address_line1 || bus.street,
                          city: addr.city || bus.city,
                          postalCode: addr.pincode || bus.postalCode,
                          country: addr.country || bus.country,
                          federalState: addr.state || bus.federalState,
                          // Custom fields
                          ownerDirector: addr.b1_owner_director || bus.ownerDirector,
                          ownerEmail: addr.b1_email_address || bus.ownerEmail,
                          ownerTelephone: addr.b1_telephone || bus.ownerTelephone,
                          // Contact Person Override
                          contactPerson: addr.b1_contact_person || bus.contactPerson,
                          contactEmail: addr.b1_contact_person_email || bus.contactEmail,
                          contactTelephone: addr.b1_contact_person_telephone || bus.contactTelephone,
                          differentContact: !!(addr.b1_contact_person) || bus.differentContact
                      };
                  }
              } catch (bErr) {
                  console.warn(`Business address fetch error for ${bus.businessName}:`, bErr);
              }
          }
      }

      // 5. SERVİS İSİMLERİNİ ALMA (GÜÇLENDİRİLDİ)
      let selectedServices: string[] = [];
      let selectedServiceNames: string[] = [];

      // A) Child Table'dan ID'leri al
      if (lead.services && Array.isArray(lead.services)) {
          selectedServices = lead.services.map((s: any) => s.service || s.name).filter(Boolean);
      }
      
      // B) Child Table boşsa eski JSON alanına bak
      if (selectedServices.length === 0) {
          selectedServices = parseJSON(lead.custom_selected_services);
          // Eğer string array değilse düzelt
          if (Array.isArray(selectedServices) && typeof selectedServices[0] !== 'string') {
             selectedServices = []; // Format bozuksa sıfırla
          }
      }

      // C) ID'leri İsimlere Çevir
      if (selectedServices.length > 0) {
          try {
              const svcFilters = encodeURIComponent(JSON.stringify([["name", "in", selectedServices]]));
              // İsim olabilecek tüm alanları çek
              const svcRes = await erpGet(`/api/resource/Service?filters=${svcFilters}&fields=["name","service_name","item_name","description"]`, token);
              const svcData = svcRes?.data || svcRes || [];
              
              if (Array.isArray(svcData)) {
                  selectedServiceNames = selectedServices.map(id => {
                      const found = svcData.find((s: any) => s.name === id);
                      // Varsa ismi, yoksa ID'yi kullan
                      return found ? (found.service_name || found.item_name || found.description || found.name) : id;
                  });
              } else {
                  selectedServiceNames = selectedServices;
              }
          } catch (svcErr) {
              console.warn("Service name fetch error:", svcErr);
              selectedServiceNames = selectedServices; // Hata durumunda ID'leri göster
          }
      }

      return NextResponse.json({
        success: true,
        lead: {
          ...lead,
          businessRegistrationFiles,
          idFiles,
          shareholdersFiles,
          registerExtractFiles,
          hrExtractFiles,
          businesses,
          // Frontend'in beklediği formatlar
          custom_selected_services: JSON.stringify(selectedServices), // ID listesi (JSON string)
          services: lead.services || [], // Raw child table
          selected_service_names: selectedServiceNames.join(", "), // Virgülle ayrılmış isimler
        },
      });

    } else {
      return NextResponse.json({ success: false, message: "No lead found" });
    }
  } catch (e: any) {
    console.error("ERP get lead error:", e);
    return NextResponse.json({ error: e.message || "Server Error" }, { status: 500 });
  }
}