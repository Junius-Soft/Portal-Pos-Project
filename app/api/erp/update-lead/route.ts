import { NextRequest, NextResponse } from "next/server";
import { erpGet, erpPost, erpPut, erpUploadFile } from "@/lib/erp";

export const dynamic = 'force-dynamic';

// Country isimlerini ERPNext Country doc name'ine normalize et (Link field için İngilizce isim gerekli)
const normalizeCountry = (country: string | undefined | null): string | undefined => {
    if (!country) return country ?? undefined;

    const map: Record<string, string> = {
        "Türkiye": "Turkey",
        "Turkiye": "Turkey",
        "Republic of Turkey": "Turkey",
        "Deutschland": "Germany",
        "Federal Republic of Germany": "Germany",
        "United States of America": "United States",
        "İspanya": "Spain",
        "Ispanya": "Spain",
        "Spain": "Spain", // Zaten İngilizce ise olduğu gibi
        "España": "Spain",
        "Espana": "Spain",
    };

    return map[country] || country;
};

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

    // 1. VERİ AYRIŞTIRMA
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

    // 2. LEAD BULMA (Tam veri ile)
    let existingLead: any = null;
    try {
        const filters = encodeURIComponent(JSON.stringify([["email_id", "=", email]]));
        const res = await erpGet(`/api/resource/Lead?filters=${filters}&limit_page_length=1`, token);
        const data = res?.data || (Array.isArray(res) ? res : []);
        if (data.length > 0) {
            // Lead'in tam verisini al
            const leadName = data[0].name;
            const fullLeadRes = await erpGet(`/api/resource/Lead/${encodeURIComponent(leadName)}`, token);
            existingLead = fullLeadRes?.data || fullLeadRes || data[0];
        }
    } catch(e) {
        // Error finding Lead
    }

    // 3. PAYLOAD HAZIRLAMA
    const trimmedCompanyName = (companyInfo?.companyName || "").trim();
    const leadPayload: any = {
        email_id: email,
    };
    
    // Company name koruması - HER ZAMAN mevcut değeri koru, yeni değer varsa güncelle
    if (trimmedCompanyName) {
        leadPayload.company_name = trimmedCompanyName;
        leadPayload.lead_name = trimmedCompanyName;
    } else if (existingLead?.company_name && existingLead.company_name.trim()) {
        leadPayload.company_name = existingLead.company_name;
        leadPayload.lead_name = existingLead.company_name;
    } else if (existingLead?.lead_name && existingLead.lead_name.trim() && existingLead.lead_name !== email) {
        leadPayload.company_name = existingLead.lead_name;
        leadPayload.lead_name = existingLead.lead_name;
    }

    if (!existingLead) {
        leadPayload.status = "Open";
        leadPayload.source = "Website";
    }

    // --- ALAN İSİMLERİ GÜNCELLENDİ ---
    if (companyInfo) {
        
        if (companyInfo.companyName) {
            const cleanedCompanyName = companyInfo.companyName.trim();
            if (cleanedCompanyName) {
                leadPayload.company_name = cleanedCompanyName;
                leadPayload.lead_name = cleanedCompanyName; // Lead name de company name olsun
                console.log("✅ Company Name set:", cleanedCompanyName);
            }
        }
        
        // YENİ ALAN İSİMLERİ BURADA:
        if (companyInfo.vatIdentificationNumber) {
            leadPayload.custom_vat_number = companyInfo.vatIdentificationNumber;
        }
        
        if (companyInfo.taxIdNumber) {
            const taxIdValue = companyInfo.taxIdNumber.trim();
            if (taxIdValue) {
                leadPayload.custom_tax_id = taxIdValue;
                leadPayload.tax_id = taxIdValue;
            }
        }
        
        if (companyInfo.restaurantCount) {
            leadPayload.custom_restaurant_count = parseInt(companyInfo.restaurantCount) || 1;
        }
        
        // Adres Bilgileri
        if (companyInfo.street) {
            leadPayload.address_line1 = companyInfo.street.trim();
        }
        
        if (companyInfo.zipCode) {
            leadPayload.pincode = companyInfo.zipCode.trim();
        }
        
        if (companyInfo.city) {
            leadPayload.city = companyInfo.city.trim();
        }
        
        if (companyInfo.federalState) {
            leadPayload.state = companyInfo.federalState.trim();
        }
        
        if (companyInfo.country) {
            const normalizedCountry = normalizeCountry(companyInfo.country.trim());
            leadPayload.country = normalizedCountry;
        }
    }

    if (businesses) {
        leadPayload.custom_businesses = JSON.stringify(businesses);
    }
    
    // PAYMENT ALANLARI (Listede olduğu gibi korundu)
    if (paymentInfo) {
        if (paymentInfo.iban) leadPayload.custom_iban = paymentInfo.iban;
        if (paymentInfo.accountHolder) leadPayload.custom_account_holder = paymentInfo.accountHolder;
        if (paymentInfo.bic) leadPayload.custom_bic = paymentInfo.bic;
    }

    // SERVİSLER
    let selectedServicesJson = "";
    let selectedServiceNamesText = "";
    if (services && Array.isArray(services) && services.length > 0) {
        let serviceNamesList: string[] = [];
        
        try {
            const idsJson = JSON.stringify(services);
            const filters = `[["name", "in", ${idsJson}]]`;
            const fields = `["name", "service_name", "title"]`;
            
            let serviceData: any[] = [];
            const BASE_URL_SERVICES = process.env.NEXT_PUBLIC_ERP_BASE_URL;
            
            try {
                console.log("🔍 Fetching service names from Services DocType (using direct fetch like get-services)...");
                // get-services endpoint'indeki gibi direkt fetch kullan - tüm field'ları getir
                const fields = encodeURIComponent(JSON.stringify(["*"]));
                const apiUrl = `/api/resource/Services?fields=${fields}`;
                console.log("  - Full API URL:", apiUrl);
                
                if (BASE_URL_SERVICES) {
                    const response = await fetch(`${BASE_URL_SERVICES}${apiUrl}`, {
                        method: "GET",
                        headers: {
                            "Content-Type": "application/json",
                            "Authorization": token,
                        },
                        cache: "no-store",
                    });

                    if (response.ok) {
                        const res = await response.json();
                        console.log("  - Raw API Response keys:", Object.keys(res || {}));
                        
                        // Response formatını kontrol et (get-services endpoint'indeki gibi)
                        if (res?.data && Array.isArray(res.data)) {
                            serviceData = res.data;
                        } else if (Array.isArray(res)) {
                            serviceData = res;
                        } else if (res?.message && Array.isArray(res.message)) {
                            serviceData = res.message;
                        }
                        
                        // Şimdi ID'lere göre filtrele
                        const serviceIdSet = new Set(services);
                        serviceData = serviceData.filter((s: any) => {
                            const serviceId = s.name || s.id;
                            return serviceIdSet.has(serviceId);
                        });
                    } else {
                        const errorText = await response.text();
                        console.error("❌ Services API failed:", response.status, errorText.substring(0, 200));
                        
                        // Service (singular) dene
                        try {
                            const apiUrl2 = `/api/resource/Service?fields=${fields}`;
                            const response2 = await fetch(`${BASE_URL_SERVICES}${apiUrl2}`, {
                                method: "GET",
                                headers: {
                                    "Content-Type": "application/json",
                                    "Authorization": token,
                                },
                                cache: "no-store",
                            });
                            
                            if (response2.ok) {
                                const res2 = await response2.json();
                                if (res2?.data && Array.isArray(res2.data)) {
                                    serviceData = res2.data;
                                } else if (Array.isArray(res2)) {
                                    serviceData = res2;
                                }
                                
                                const serviceIdSet = new Set(services);
                                serviceData = serviceData.filter((s: any) => {
                                    const serviceId = s.name || s.id;
                                    return serviceIdSet.has(serviceId);
                                });
                                
                                console.log("✅ Service (singular) response:", serviceData.length, "items");
                            }
                        } catch (e2: any) {
                            console.error("❌ Service (singular) also failed:", e2?.message || e2);
                        }
                    }
                }
            } catch (e1: any) {
                console.error("❌ Services fetch failed:", e1?.message || e1);
                console.error("  - Error stack:", e1?.stack);
            }

            if (serviceData.length > 0) {
                const idMap = new Map<string, string>();
                serviceData.forEach((s: any) => {
                    const serviceName = s.service_name || s.title || s.name;
                    idMap.set(s.name, serviceName);
                });
                
                serviceNamesList = services.map((id: string) => {
                    const name = idMap.get(id);
                    return name || id;
                });
            } else {
                serviceNamesList = services;
            }

        } catch (e: any) {
            console.error("❌ Service lookup failed:", e?.message || e);
            console.error("Error stack:", e?.stack);
            serviceNamesList = services;
        }

        // Services için belirtilen alan adları:
        // custom_selected_services: JSON array olarak servis ID'lerini tutar (Text field)
        // custom_selected_services_name: Virgülle ayrılmış servis isimleri (Small Text, Read Only, tekil!)
        selectedServicesJson = JSON.stringify(services);
        selectedServiceNamesText = serviceNamesList.join(", ");
        
        // Lead payload'a ekle
        leadPayload.custom_selected_services = selectedServicesJson;
        leadPayload.custom_selected_services_name = selectedServiceNamesText;

        // Child table için (optional - hata verebilir)
        leadPayload.services = services.map((id: string, idx: number) => ({
            service: id,
            service_name: serviceNamesList[idx] || id,
            terms_accepted: 1
        }));
    }

    // DOCUMENTS VE REGISTRATION STATUS
    let companyTypeNameForLead = "";
    let documentDataJson = "";
    if (documents) {
        if (documents.typeOfCompany) {
            leadPayload.custom_company_type = documents.typeOfCompany;
            if (documents.typeOfCompanyName) {
                companyTypeNameForLead = documents.typeOfCompanyName;
                leadPayload.custom_company_type_name = documents.typeOfCompanyName;
            }
        }
        
        if (documents.documentData) {
            documentDataJson = JSON.stringify(documents.documentData);
            leadPayload.custom_document_data = documentDataJson;
        }
        
        if (documents.isCompleted === true) {
            leadPayload.custom_registration_status = "Completed";
        } else if (documents.typeOfCompany || documents.documentData) {
            leadPayload.custom_registration_status = "In Progress";
        }
    }

    // KAYDETME İŞLEMİ
    let leadResult;
    const save = async (data: any) => {
        if (existingLead?.name) return await erpPut(`/api/resource/Lead/${encodeURIComponent(existingLead.name)}`, data, token);
        return await erpPost("/api/resource/Lead", data, token);
    };

    try {
        leadResult = await save(leadPayload);
    } catch (e: any) {
        if (leadPayload.services) {
            delete leadPayload.services;
            leadResult = await save(leadPayload);
        } else {
            throw e; 
        }
    }

    // ADRES VE CONTACT OLUŞTURMA
    const leadName = existingLead?.name || leadResult?.data?.name || leadResult?.name || leadResult?.message?.name || "";
    const BASE_URL = process.env.NEXT_PUBLIC_ERP_BASE_URL;

    // 1. Ana Company Address'i Address DocType olarak oluştur ve Lead'e bağla
    let mainCompanyAddressName = "";
    if (companyInfo) {
        try {
            const addressLine1 = (companyInfo.street && companyInfo.street.trim()) || "";
            if (addressLine1) {
                const mainAddressPayload: any = {
                    address_title: companyInfo.companyName || "Main Company Address",
                    address_type: "Billing", // Ana şirket için Billing
                    address_line1: addressLine1,
                    city: companyInfo.city || "",
                    state: companyInfo.federalState || "",
                    pincode: companyInfo.zipCode || "",
                    country: normalizeCountry(companyInfo.country) || "Germany",
                    links: [
                        {
                            link_doctype: "Lead",
                            link_name: leadName,
                            link_title: companyInfo.companyName || leadName
                        }
                    ]
                };

                // Email ve telefon varsa ekle
                if (companyInfo.email) {
                    mainAddressPayload.email_id = companyInfo.email;
                }
                if (companyInfo.phone) {
                    mainAddressPayload.phone = companyInfo.phone;
                }

                console.log("📤 Creating main company address with payload:", JSON.stringify(mainAddressPayload, null, 2));
                console.log("  - Lead Name:", leadName);
                console.log("  - Lead Name type:", typeof leadName);
                
                const mainAddressResult = await erpPost("/api/resource/Address", mainAddressPayload, token);
                console.log("📥 Main company address API response:", JSON.stringify(mainAddressResult, null, 2));
                
                // ERPNext hata kontrolü
                if (mainAddressResult?.exc_type || mainAddressResult?.exception || mainAddressResult?.error) {
                    console.error("❌ Address creation failed!");
                    console.error("  - Error type:", mainAddressResult?.exc_type);
                    console.error("  - Exception:", mainAddressResult?.exception);
                    console.error("  - Error:", mainAddressResult?.error);
                    if (mainAddressResult?._server_messages) {
                        try {
                            const msgs = JSON.parse(mainAddressResult._server_messages);
                            const msgObj = JSON.parse(msgs[0]);
                            console.error("  - Server message:", msgObj.message);
                        } catch {}
                    }
                    throw new Error(`Address creation failed: ${mainAddressResult?.exception || mainAddressResult?.error || "Unknown error"}`);
                }
                
                mainCompanyAddressName = mainAddressResult?.data?.name || mainAddressResult?.name || mainAddressResult?.message?.name || "";
                console.log("✅ Main company address created successfully:", mainCompanyAddressName);
                
                if (!mainCompanyAddressName) {
                    console.error("❌ Address name is empty! Response structure:", Object.keys(mainAddressResult || {}));
                    console.error("  - Full response:", JSON.stringify(mainAddressResult, null, 2));
                }
            } else {
                console.log("⚠️ Main company address_line1 (street) is empty. Address will not be created.");
            }
        } catch (e: any) {
            console.error("❌ Error creating main company address:", e);
            console.error("Error details:", e?.response?.data || e?.message);
            console.error("Full error:", JSON.stringify(e, null, 2));
        }
    } else {
        console.log("⚠️ No companyInfo provided, skipping main company address creation");
    }

    // 2. Business Address'leri ve Contact'ları Oluştur
    if (businesses && Array.isArray(businesses) && businesses.length > 0) {
        console.log(`Processing ${businesses.length} businesses...`);
        
        for (let i = 0; i < businesses.length; i++) {
            const business = businesses[i];
            let businessAddressName = "";
            
            console.log(`📋 Business ${i + 1} data:`, JSON.stringify(business, null, 2));
            
            // Business Address oluştur
            try {
                const addressLine1 = (business.street && business.street.trim()) || "";
                if (!addressLine1) {
                    console.error(`❌ Business ${i + 1} address_line1 (street and house number) is empty. Address will not be created.`);
                    continue;
                }
                const businessAddressPayload: any = {
                    address_title: business.businessName || `Business ${i + 1}`,
                    address_type: "Shop",
                    address_line1: addressLine1,
                    city: business.city || "",
                    state: business.federalState || "",
                    pincode: business.postalCode || "",
                    country: normalizeCountry(business.country || companyInfo?.country) || "Germany", // Fallback to main company country
                    links: [
                        {
                            link_doctype: "Lead",
                            link_name: leadName,
                            link_title: companyInfo?.companyName || leadName
                        }
                    ]
                };

                console.log(`📤 Creating business ${i + 1} address with payload:`, JSON.stringify(businessAddressPayload, null, 2));
                console.log(`  - Lead Name:`, leadName);
                console.log(`  - Lead Name type:`, typeof leadName);
                
                const businessAddressResult = await erpPost("/api/resource/Address", businessAddressPayload, token);
                console.log(`📥 Business ${i + 1} address API response:`, JSON.stringify(businessAddressResult, null, 2));
                
                // ERPNext hata kontrolü
                if (businessAddressResult?.exc_type || businessAddressResult?.exception || businessAddressResult?.error) {
                    console.error(`❌ Business ${i + 1} address creation failed!`);
                    console.error("  - Error type:", businessAddressResult?.exc_type);
                    console.error("  - Exception:", businessAddressResult?.exception);
                    console.error("  - Error:", businessAddressResult?.error);
                    if (businessAddressResult?._server_messages) {
                        try {
                            const msgs = JSON.parse(businessAddressResult._server_messages);
                            const msgObj = JSON.parse(msgs[0]);
                            console.error("  - Server message:", msgObj.message);
                        } catch {}
                    }
                    throw new Error(`Business ${i + 1} address creation failed: ${businessAddressResult?.exception || businessAddressResult?.error || "Unknown error"}`);
                }
                
                businessAddressName = businessAddressResult?.data?.name || businessAddressResult?.name || businessAddressResult?.message?.name || "";
                console.log(`✅ Business ${i + 1} address created successfully:`, businessAddressName);
                
                if (!businessAddressName) {
                    console.error(`❌ Business ${i + 1} address name is empty! Response structure:`, Object.keys(businessAddressResult || {}));
                    console.error("  - Full response:", JSON.stringify(businessAddressResult, null, 2));
                }
            } catch (e: any) {
                console.error(`❌ Error creating business ${i + 1} address:`, e);
                console.error("Error details:", e?.response?.data || e?.message);
                console.error("Full error:", JSON.stringify(e, null, 2));
            }

            // Owner/Director Contact Oluştur (Address'e bağlı)
            if (business.ownerDirector || business.ownerEmail) {
                try {
                    const ownerContactPayload: any = {
                        first_name: business.ownerDirector || "Owner",
                        email_id: business.ownerEmail || "",
                        phone: business.ownerTelephone || "",
                        is_primary_contact: i === 0 ? 1 : 0,
                        links: [
                            {
                                link_doctype: "Lead",
                                link_name: leadName,
                                link_title: companyInfo?.companyName || leadName
                            }
                        ]
                    };

                    // Contact'ı Address'e bağla (hem links ile hem de address field'ı ile)
                    if (businessAddressName) {
                        if (!ownerContactPayload.links) ownerContactPayload.links = [];
                        ownerContactPayload.links.push({
                            link_doctype: "Address",
                            link_name: businessAddressName
                        });
                        // Default address olarak ayarla
                        ownerContactPayload.address = businessAddressName;
                    }

                    console.log(`📤 Creating business ${i + 1} owner contact:`, JSON.stringify(ownerContactPayload, null, 2));
                    await erpPost("/api/resource/Contact", ownerContactPayload, token);
                    console.log(`✅ Business ${i + 1} owner contact created successfully`);
                } catch (e: any) {
                    console.error(`❌ Error creating business ${i + 1} owner contact:`, e);
                    console.error("Error details:", e?.response?.data || e?.message);
                }
            } else {
                console.log(`⚠️ Business ${i + 1}: No owner/director info to create contact`);
            }

            // Contact Person Oluştur (Contact bilgisi varsa - Address'e bağlı)
            if (business.contactPerson || business.contactEmail || business.contactTelephone) {
                try {
                    const contactPersonPayload: any = {
                        first_name: business.contactPerson || "Contact Person",
                        email_id: business.contactEmail || "",
                        phone: business.contactTelephone || "",
                        is_primary_contact: 0,
                        links: [
                            {
                                link_doctype: "Lead",
                                link_name: leadName,
                                link_title: companyInfo?.companyName || leadName
                            }
                        ]
                    };

                    // Contact'ı Address'e bağla (hem links ile hem de address field'ı ile)
                    if (businessAddressName) {
                        if (!contactPersonPayload.links) contactPersonPayload.links = [];
                        contactPersonPayload.links.push({
                            link_doctype: "Address",
                            link_name: businessAddressName
                        });
                        // Default address olarak ayarla
                        contactPersonPayload.address = businessAddressName;
                    }

                    console.log(`📤 Creating business ${i + 1} contact person:`, JSON.stringify(contactPersonPayload, null, 2));
                    await erpPost("/api/resource/Contact", contactPersonPayload, token);
                    console.log(`✅ Business ${i + 1} contact person created successfully`);
                } catch (e: any) {
                    console.error(`❌ Error creating business ${i + 1} contact person:`, e);
                    console.error("Error details:", e?.response?.data || e?.message);
                }
            } else {
                console.log(`⚠️ Business ${i + 1}: No contact person info`);
            }
        }
    } else {
        console.log("⚠️ No businesses to process");
    }

    // DOSYA YÜKLEME VE URL'LERİNİ KAYDETME
    
    if (uploadedFiles && Object.keys(uploadedFiles).length > 0) {
        // Mevcut document data'yı al (varsa)
        let documentDataWithUrls: any = {};
        if (documents?.documentData) {
            try {
                documentDataWithUrls = { ...documents.documentData };
            } catch (e) {
                documentDataWithUrls = {};
            }
        }

        // Her belge için dosyaları yükle ve URL'lerini kaydet
        for (const [docId, files] of Object.entries(uploadedFiles)) {
            if (!documentDataWithUrls[docId]) {
                documentDataWithUrls[docId] = { 
                    files: [], 
                    fileNames: [], 
                    urls: [],
                    documentName: docId // Varsayılan olarak docId kullan
                };
            }
            
            // Eğer documentData'da zaten metadata varsa, onu koru
            if (documents?.documentData?.[docId]) {
                documentDataWithUrls[docId] = { 
                    ...documents.documentData[docId],
                    urls: documentDataWithUrls[docId].urls || [],
                    documentName: documents.documentData[docId].documentName || docId
                };
            }
            
            // Required documents listesinden document name'i bul
            if (documents?.requiredDocuments && Array.isArray(documents.requiredDocuments)) {
                const reqDoc = documents.requiredDocuments.find((rd: any) => rd.id === docId || rd.documentType === docId);
                if (reqDoc && reqDoc.name) {
                    documentDataWithUrls[docId].documentName = reqDoc.name;
                }
            }

            for (const file of files) {
                try {
                    const uploadResult = await erpUploadFile(file, token, {
                        doctype: "Lead", 
                        docname: leadName, 
                        is_private: 0
                    });

                    let fileUrl = "";
                    let fileName = file.name;
                    
                    if (uploadResult?.message) {
                        const msg = uploadResult.message;
                        if (typeof msg === "object" && msg.file_url) {
                            // Relative path'i absolute URL'e çevir
                            const relativePath = msg.file_url.startsWith("/") ? msg.file_url : `/${msg.file_url}`;
                            fileUrl = BASE_URL ? `${BASE_URL}${relativePath}` : relativePath;
                            fileName = msg.file_name || file.name;
                        } else if (typeof msg === "string") {
                            // Eğer message string ise (eski format)
                            const relativePath = msg.startsWith("/") ? msg : `/${msg}`;
                            fileUrl = BASE_URL ? `${BASE_URL}${relativePath}` : relativePath;
                        }
                    } else {
                        console.error("❌ No 'message' in upload result");
                    }

                    // Eğer hala URL yoksa, dosya adından URL oluştur (fallback)
                    if (!fileUrl && BASE_URL) {
                        const sanitizedFileName = encodeURIComponent(fileName);
                        // Private dosyalar için /private/files/, public için /files/
                        fileUrl = `${BASE_URL}/files/${sanitizedFileName}`;
                    }

                    // URL'leri document data'ya ekle
                    if (fileUrl) {
                        if (!documentDataWithUrls[docId].urls) {
                            documentDataWithUrls[docId].urls = [];
                        }
                        if (!documentDataWithUrls[docId].files) {
                            documentDataWithUrls[docId].files = [];
                        }
                        if (!documentDataWithUrls[docId].fileNames) {
                            documentDataWithUrls[docId].fileNames = [];
                        }
                        
                        documentDataWithUrls[docId].urls.push(fileUrl);
                        documentDataWithUrls[docId].files.push(fileUrl); // Geriye dönük uyumluluk için
                        documentDataWithUrls[docId].fileNames.push(fileName);
                    } else {
                    }

                    // Tarih bilgisini koru (varsa)
                    if (documents?.documentData?.[docId]?.date) {
                        documentDataWithUrls[docId].date = documents.documentData[docId].date;
                    }
                } catch (e: any) {
                    // Upload error
                }
            }
        }

        // Document data'yı URL'lerle birlikte güncelle
        // Eğer yeni dosya yüklenmediyse ama mevcut documents varsa, onları da kullan
        let allDocumentData = { ...documentDataWithUrls };
        
        // Eğer hiç dosya yüklenmediyse ama mevcut documents varsa, onları kullan
        if (Object.keys(allDocumentData).length === 0 && existingLead?.custom_document_data) {
            try {
                const existingDocData = typeof existingLead.custom_document_data === 'string' 
                    ? JSON.parse(existingLead.custom_document_data)
                    : existingLead.custom_document_data;
                
                if (existingDocData && typeof existingDocData === 'object') {
                    allDocumentData = { ...existingDocData };
                }
            } catch (e) {
                console.error("❌ Error parsing existing document data:", e);
            }
        }
        
        // Mevcut Lead'deki documents'ları da kontrol et ve birleştir
        if (existingLead?.custom_document_data) {
            try {
                const existingDocData = typeof existingLead.custom_document_data === 'string' 
                    ? JSON.parse(existingLead.custom_document_data)
                    : existingLead.custom_document_data;
                
                console.log("📋 Found existing document data in Lead:", Object.keys(existingDocData || {}).length, "documents");
                
                // Mevcut documents'ları birleştir (yeni olanlar öncelikli)
                if (existingDocData && typeof existingDocData === 'object') {
                    for (const [docId, docInfo] of Object.entries(existingDocData)) {
                        if (!allDocumentData[docId]) {
                            allDocumentData[docId] = docInfo as any;
                            console.log(`  ✅ Added existing document: ${docId}`);
                        } else {
                            // Mevcut document'ı güncelle (yeni URL'leri ekle)
                            const existing = allDocumentData[docId] as any;
                            const existingInfo = docInfo as any;
                            
                            // URL'leri birleştir (duplicate'leri önle) - string'e çevir
                            const existingUrlsRaw = existing.urls || existing.files || [];
                            const newUrlsRaw = existingInfo.urls || existingInfo.files || [];
                            
                            // URL'leri string'e çevir (obje ise url property'sini al)
                            const normalizeUrl = (url: any): string => {
                                if (typeof url === 'string') return url;
                                if (url && typeof url === 'object') {
                                    return url.url || url.file_url || url.file || String(url);
                                }
                                return String(url || "");
                            };
                            
                            const existingUrls = existingUrlsRaw.map(normalizeUrl).filter((u: string) => u);
                            const newUrls = newUrlsRaw.map(normalizeUrl).filter((u: string) => u);
                            const allUrls = Array.from(new Set([...existingUrls, ...newUrls]));
                            
                            // File name'leri birleştir
                            const existingFileNames = existing.fileNames || [];
                            const newFileNames = existingInfo.fileNames || [];
                            const allFileNames = Array.from(new Set([...existingFileNames, ...newFileNames]));
                            
                            allDocumentData[docId] = {
                                ...existingInfo,
                                ...existing,
                                urls: allUrls,
                                files: allUrls,
                                fileNames: allFileNames,
                                documentName: existing.documentName || existingInfo.documentName || docId
                            };
                        }
                    }
                }
            } catch (e) {
                console.error("❌ Error parsing existing document data:", e);
            }
        }
        
        // Eğer documents varsa (yeni veya mevcut), HTML oluştur
        if (Object.keys(allDocumentData).length > 0) {
            try {
                // Mevcut lead'i al
                const currentLeadName = existingLead?.name || (leadResult?.data || leadResult).name;
                if (currentLeadName) {
                    // HTML formatında document listesi oluştur - TIKLANABİLİR LİNKLER
                    // ERPNext'te field tipi: HTML veya Text Editor olmalı
                    let htmlDocuments = `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">`;
                    htmlDocuments += `<h4 style="margin-bottom: 15px; color: #333;">📁 Uploaded Documents</h4>`;
                    
                    for (const [docId, docInfo] of Object.entries(allDocumentData)) {
                        const docName = (docInfo as any).documentName || docId;
                        htmlDocuments += `<div style="margin-bottom: 15px; padding: 10px; background: #f8f9fa; border-radius: 5px;">`;
                        htmlDocuments += `<strong style="color: #1a73e8;">📄 ${docName}</strong><br>`;
                        
                        const fileNames = (docInfo as any).fileNames;
                        const urls = (docInfo as any).urls || (docInfo as any).files;
                        if (fileNames && Array.isArray(fileNames) && fileNames.length > 0) {
                            htmlDocuments += `<ul style="margin: 8px 0 0 0; padding-left: 20px;">`;
                            fileNames.forEach((fileName: string, index: number) => {
                                const fileUrl = urls?.[index] || "";
                                if (fileUrl) {
                                    htmlDocuments += `<li style="margin: 5px 0;"><a href="${fileUrl}" target="_blank" style="color: #1a73e8; text-decoration: underline;">${fileName}</a></li>`;
                                } else {
                                    htmlDocuments += `<li style="margin: 5px 0;">${fileName}</li>`;
                                }
                            });
                            htmlDocuments += `</ul>`;
                        } else if (urls && Array.isArray(urls) && urls.length > 0) {
                            // Eğer fileNames yoksa ama URLs varsa, URL'lerden dosya adını çıkar
                            htmlDocuments += `<ul style="margin: 8px 0 0 0; padding-left: 20px;">`;
                            urls.forEach((fileUrl: any) => {
                                // fileUrl obje olabilir (örneğin {name: "file.pdf"}), string'e çevir
                                let urlString = "";
                                let fileName = "";
                                
                                if (typeof fileUrl === 'string') {
                                    urlString = fileUrl;
                                    fileName = fileUrl.split('/').pop() || fileUrl;
                                } else if (fileUrl && typeof fileUrl === 'object') {
                                    // Obje formatında ise (örneğin {name: "file.pdf", url: "..."})
                                    urlString = fileUrl.url || fileUrl.file_url || fileUrl.file || "";
                                    fileName = fileUrl.name || fileUrl.file_name || fileUrl.fileName || urlString.split('/').pop() || "Unknown";
                                } else {
                                    urlString = String(fileUrl || "");
                                    fileName = urlString.split('/').pop() || urlString;
                                }
                                
                                if (urlString) {
                                    htmlDocuments += `<li style="margin: 5px 0;"><a href="${urlString}" target="_blank" style="color: #1a73e8; text-decoration: underline;">${fileName}</a></li>`;
                                } else {
                                    htmlDocuments += `<li style="margin: 5px 0;">${fileName || "Unknown file"}</li>`;
                                }
                            });
                            htmlDocuments += `</ul>`;
                        }
                        
                        if ((docInfo as any).date) {
                            htmlDocuments += `<small style="color: #666;">📅 Date: ${(docInfo as any).date}</small>`;
                        }
                        
                        htmlDocuments += `</div>`;
                    }
                    
                    htmlDocuments += `</div>`;
                    
                    
                    // Dosya yükleme sonrası registration status'u kontrol et ve güncelle
                    const finalStatusPayload: any = {
                        custom_document_data: JSON.stringify(allDocumentData),
                        custom_uploaded_documents: htmlDocuments // HTML field - tıklanabilir linkler
                    };
                    
                    // Eğer documents.isCompleted === true ise, status'u "Completed" olarak set et
                    if (documents?.isCompleted === true) {
                        finalStatusPayload.custom_registration_status = "Completed";
                        console.log("✅ Registration Status updated to: Completed (after file upload)");
                    }
                    
                    
                    try {
                        // custom_document_data ve custom_uploaded_documents'ı BİRLİKTE güncelle
                        // Read Only kaldırıldığı için normal PUT request yeterli
                        const documentUpdatePayload: any = {
                            custom_document_data: JSON.stringify(allDocumentData),
                            custom_uploaded_documents: htmlDocuments // HTML field - tıklanabilir linkler
                        };
                        
                        if (documents?.isCompleted === true) {
                            documentUpdatePayload.custom_registration_status = "Completed";
                        }
                        
                        
                        const documentUpdateResult = await erpPut(
                            `/api/resource/Lead/${encodeURIComponent(currentLeadName)}`,
                            documentUpdatePayload,
                            token
                        );
                        
                        console.log("  - Response keys:", Object.keys(documentUpdateResult || {}));
                        
                        // Response'da field'ları kontrol et
                        const responseData = documentUpdateResult?.data || documentUpdateResult;
                        if (responseData) {
                            const uploadedDocsInResponse = responseData.custom_uploaded_documents;
                            const documentDataInResponse = responseData.custom_document_data;
                            
                            console.log("  - custom_uploaded_documents in response:", !!uploadedDocsInResponse);
                            console.log("  - custom_uploaded_documents length in response:", uploadedDocsInResponse?.length || 0);
                            console.log("  - custom_document_data in response:", !!documentDataInResponse);
                            
                            if (uploadedDocsInResponse) {
                                console.log("  ✅ Field successfully updated and visible in API response!");
                            } else {
                                console.log("  ⚠️ Field updated but not in response (may need verification)");
                            }
                        }
                        
                        
                        // Güncelleme sonrası field'ı kontrol et (biraz bekle - ERPNext'in veritabanını güncellemesi için)
                        await new Promise(resolve => setTimeout(resolve, 1000)); // 1 saniye bekle (Read Only field'lar için daha uzun süre gerekebilir)
                        
                        try {
                            // Field'ı tekrar çek ve kontrol et
                            // Read Only field'lar bazen ilk response'da görünmeyebilir ama veritabanında güncellenmiş olabilir
                            const verifyRes = await erpGet(`/api/resource/Lead/${encodeURIComponent(currentLeadName)}`, token);
                            const verifyData = verifyRes?.data || verifyRes;
                            
                            // Alternatif field adlarını tanımla
                            const alternativeFields = [
                                'custom_services_documents',
                                'custom_uploaded_documents',
                                'custom_documents',
                                'custom_services_documents_html',
                                'custom_uploaded_docs',
                                'custom_documents_html'
                            ];
                            
                            // Tüm custom field'ları listele
                            const allCustomFields = Object.keys(verifyData || {}).filter(k => k.startsWith('custom_'));
                            
                            // Document/upload ile ilgili field'ları bul
                            const documentFields = allCustomFields.filter(k => 
                                k.includes('document') || 
                                k.includes('upload') || 
                                k.includes('service') ||
                                k.includes('file')
                            );
                            
                            // Her bir document field'ını kontrol et
                            documentFields.forEach(fieldName => {
                                const fieldValue = verifyData?.[fieldName];
                                console.log(`  - ${fieldName}:`, {
                                    hasValue: !!fieldValue,
                                    type: typeof fieldValue,
                                    length: fieldValue?.length || 0,
                                    preview: typeof fieldValue === 'string' ? fieldValue.substring(0, 100) : String(fieldValue).substring(0, 100)
                                });
                            });
                            
                            // Önce custom_uploaded_documents'ı kontrol et, yoksa alternatifleri dene
                            let uploadedDocsValue = verifyData?.custom_uploaded_documents;
                            let verifiedFieldName = 'custom_uploaded_documents';
                            
                            if (!uploadedDocsValue) {
                                // Alternatif field adlarını dene
                                for (const altField of alternativeFields) {
                                    if (verifyData?.[altField]) {
                                        uploadedDocsValue = verifyData[altField];
                                        verifiedFieldName = altField;
                                        console.log(`  🔄 Using alternative field: ${altField}`);
                                        break;
                                    }
                                }
                            }
                            
                            console.log(`🔍 Verification - ${verifiedFieldName} field value:`);
                            console.log("  - Has value:", !!uploadedDocsValue);
                            console.log("  - Value type:", typeof uploadedDocsValue);
                            console.log("  - Value length:", uploadedDocsValue?.length || 0);
                            console.log("  - Value preview (first 300 chars):", uploadedDocsValue?.substring(0, 300) || "EMPTY");
                            
                            // Alternatif field adlarını kontrol et
                            let foundField = "";
                            alternativeFields.forEach(altField => {
                                if (verifyData?.[altField]) {
                                    console.log(`  ✅ Found alternative field ${altField} with value (length: ${verifyData[altField]?.length || 0})`);
                                    if (!foundField) foundField = altField;
                                }
                            });
                            
                            // Eğer hala boşsa, field adını kontrol et
                            if (!uploadedDocsValue && !foundField) {
                                console.error("❌ Documents HTML field is still empty after update!");
                                console.error("  - Tried field names:", alternativeFields);
                                console.error("  - Available document fields:", documentFields);
                                console.error("  - ⚠️ Read Only field'lar bazen API response'da görünmeyebilir");
                                console.error("  - ERPNext UI'da field'ı manuel olarak kontrol edin");
                                console.error("  - Field ayarlarını kontrol edin:");
                                console.error("     - Field Name: custom_uploaded_documents");
                                console.error("     - Field Type: HTML");
                                console.error("     - Read Only: ✅ (API ile güncellenebilir olmalı)");
                                console.error("     - Hidden: ❌ (görünür olmalı)");
                            } else if (foundField) {
                                console.log(`  ✅ Documents found in field: ${foundField}`);
                                console.log(`  ✅ Field value length: ${uploadedDocsValue?.length || 0} characters`);
                            } else if (uploadedDocsValue) {
                                console.log(`  ✅ Documents found in field: ${verifiedFieldName}`);
                                console.log(`  ✅ Field value length: ${uploadedDocsValue?.length || 0} characters`);
                            }
                        } catch (verifyError) {
                            console.error("⚠️ Could not verify field update:", verifyError);
                        }
                    } catch (updateError: any) {
                        console.error("❌ Error updating document data:", updateError?.message || updateError);
                        console.error("  - Error response:", JSON.stringify(updateError?.response?.data || {}, null, 2));
                        console.error("  - Error status:", updateError?.response?.status);
                        throw updateError;
                    }
                }
            } catch (e) {
                console.error("❌ Error updating document data:", e);
            }
        }
    }

    // OPSIYONEL: Eğer services gönderilmemişse ama Lead'de varsa, name'lerini update et
    // AYRICA: Eğer services gönderildiyse ama isimler fetch edilemediyse, tekrar dene
    const existingServicesRaw = existingLead?.custom_selected_services;
    
    // Eğer selectedServiceNamesText boşsa veya ID gibi görünüyorsa, mevcut Lead'deki servislerden fetch et
    const needsServiceNameUpdate = !selectedServiceNamesText || 
                                   selectedServiceNamesText.trim() === "" || 
                                   selectedServiceNamesText.split(", ").some((name: string) => name.length < 3 || /^[0-9a-z]{8,}$/i.test(name));
    
    if (needsServiceNameUpdate && existingServicesRaw) {
        try {
            let existingServices: string[] = [];
            
            if (typeof existingServicesRaw === 'string') {
                const trimmed = existingServicesRaw.trim();
                if (trimmed.startsWith('[')) {
                    try {
                        existingServices = JSON.parse(trimmed);
                    } catch (e) {
                        console.log("⚠️ JSON parse failed, trying comma split");
                        existingServices = trimmed.split(',').map((s: string) => s.trim()).filter(Boolean);
                    }
                } else {
                    existingServices = trimmed.split(',').map((s: string) => s.trim()).filter(Boolean);
                }
            } else if (Array.isArray(existingServicesRaw)) {
                existingServices = existingServicesRaw;
            }
            
            console.log("📋 Parsed existing services:", existingServices);
            
            if (existingServices.length > 0) {
                // selectedServicesJson'ı da set et (eğer set edilmemişse)
                if (!selectedServicesJson) {
                    selectedServicesJson = JSON.stringify(existingServices);
                }
                
                // Servis isimlerini fetch et
                const idsJson = JSON.stringify(existingServices);
                const filters = `[["name", "in", ${idsJson}]]`;
                const fields = `["name", "service_name", "title"]`;
                
                console.log("🔍 API Request Details:");
                console.log("  - Service IDs to fetch:", existingServices);
                console.log("  - Filters:", filters);
                console.log("  - Fields:", fields);
                
                let serviceData: any[] = [];
                const BASE_URL = process.env.NEXT_PUBLIC_ERP_BASE_URL;
                
                // get-services endpoint'indeki gibi direkt fetch kullan
                try {
                    console.log("🔍 Fetching service names from Services DocType (using direct fetch like get-services)...");
                    
                    // Önce tüm servisleri getir (filter yerine) - get-services endpoint'indeki gibi tüm field'ları getir
                    const fields = encodeURIComponent(JSON.stringify(["*"]));
                    const apiUrl = `/api/resource/Services?fields=${fields}`;
                    console.log("  - Full API URL:", apiUrl);
                    
                    if (BASE_URL) {
                        const response = await fetch(`${BASE_URL}${apiUrl}`, {
                            method: "GET",
                            headers: {
                                "Content-Type": "application/json",
                                "Authorization": token,
                            },
                            cache: "no-store",
                        });

                        if (response.ok) {
                            const res = await response.json();
                            console.log("  - Raw API Response type:", typeof res);
                            console.log("  - Raw API Response keys:", Object.keys(res || {}));
                            
                            // Response formatını kontrol et (get-services endpoint'indeki gibi)
                            if (res?.data && Array.isArray(res.data)) {
                                serviceData = res.data;
                            } else if (Array.isArray(res)) {
                                serviceData = res;
                            } else if (res?.message && Array.isArray(res.message)) {
                                serviceData = res.message;
                            }
                            
                            console.log("✅ Services response:", serviceData.length, "items");
                            
                            // Şimdi ID'lere göre filtrele
                            const serviceIdSet = new Set(existingServices);
                            serviceData = serviceData.filter((s: any) => {
                                const serviceId = s.name || s.id;
                                return serviceIdSet.has(serviceId);
                            });
                            
                            console.log("✅ Filtered services by IDs:", serviceData.length, "items");
                            if (serviceData.length > 0) {
                                console.log("📋 Service data sample:", JSON.stringify(serviceData[0], null, 2));
                            }
                        } else {
                            const errorText = await response.text();
                            console.error("❌ Services API failed:", response.status, errorText.substring(0, 200));
                            
                            // Service (singular) dene
                            try {
                                const apiUrl2 = `/api/resource/Service?fields=${fields}`;
                                const response2 = await fetch(`${BASE_URL}${apiUrl2}`, {
                                    method: "GET",
                                    headers: {
                                        "Content-Type": "application/json",
                                        "Authorization": token,
                                    },
                                    cache: "no-store",
                                });
                                
                                if (response2.ok) {
                                    const res2 = await response2.json();
                                    if (res2?.data && Array.isArray(res2.data)) {
                                        serviceData = res2.data;
                                    } else if (Array.isArray(res2)) {
                                        serviceData = res2;
                                    }
                                    
                                    const serviceIdSet = new Set(existingServices);
                                    serviceData = serviceData.filter((s: any) => {
                                        const serviceId = s.name || s.id;
                                        return serviceIdSet.has(serviceId);
                                    });
                                    
                                    console.log("✅ Service (singular) response:", serviceData.length, "items");
                                }
                            } catch (e2: any) {
                                console.error("❌ Service (singular) also failed:", e2?.message || e2);
                            }
                        }
                    }
                } catch (e: any) {
                    console.error("❌ Services fetch failed:", e?.message || e);
                    console.error("  - Error stack:", e?.stack);
                }
                
                if (serviceData.length > 0) {
                    // ID -> Name mapping oluştur
                    const idToNameMap = new Map<string, string>();
                    serviceData.forEach((s: any) => {
                        const serviceName = s.service_name || s.title || s.name;
                        idToNameMap.set(s.name, serviceName);
                        console.log(`  ✅ Service mapping: ${s.name} → ${serviceName}`);
                    });
                    
                    // Servis isimlerini sırayla al
                    const namesList = existingServices.map(id => {
                        const name = idToNameMap.get(id);
                        if (!name) {
                            console.warn(`⚠️ Service name not found for ID: ${id}`);
                        }
                        return name || id;
                    });
                    selectedServiceNamesText = namesList.join(", ");
                    console.log("✅ Updated service names text:", selectedServiceNamesText);
                } else {
                    console.log("⚠️ No service data found from API");
                }
            }
        } catch (e: any) {
            console.error("❌ Error updating existing service names:", e?.message || e);
        }
    } else if (selectedServicesJson && (!selectedServiceNamesText || selectedServiceNamesText.trim() === "" || selectedServiceNamesText.split(", ").some(name => name.startsWith("0") || name.length < 3))) {
        // Services gönderildi ama isimler fetch edilemedi veya ID'ler gelmiş - tekrar dene
        console.log("🔄 Services sent but names not properly fetched. Retrying service name lookup...");
        try {
            const servicesArray = JSON.parse(selectedServicesJson);
            const idsJson = JSON.stringify(servicesArray);
            const filters = `[["name", "in", ${idsJson}]]`;
            const fields = `["name", "service_name", "title"]`;
            
            let serviceData: any[] = [];
            try {
                console.log("🔍 Retrying: Fetching service names from Services DocType...");
                const res = await erpGet(`/api/resource/Services?filters=${encodeURIComponent(filters)}&fields=${encodeURIComponent(fields)}`, token);
                serviceData = res?.data || (Array.isArray(res) ? res : []);
                console.log("✅ Retry - Services response:", serviceData.length, "items");
                if (serviceData.length > 0) {
                    console.log("📋 Retry - Service data sample:", JSON.stringify(serviceData[0], null, 2));
                }
            } catch (e: any) {
                console.log("⚠️ Retry - Services DocType failed:", e?.message || e);
                try {
                    const res = await erpGet(`/api/resource/Service?filters=${encodeURIComponent(filters)}&fields=${encodeURIComponent(fields)}`, token);
                    serviceData = res?.data || (Array.isArray(res) ? res : []);
                    console.log("✅ Retry - Service (singular) response:", serviceData.length, "items");
                } catch (e2: any) {
                    console.error("❌ Retry - Both Service DocTypes failed:", e2?.message || e2);
                }
            }
            
            if (serviceData.length > 0) {
                const idToNameMap = new Map<string, string>();
                serviceData.forEach((s: any) => {
                    const serviceName = s.service_name || s.title || s.name;
                    idToNameMap.set(s.name, serviceName);
                    console.log(`  ✅ Retry - Service mapping: ${s.name} → ${serviceName}`);
                });
                const namesList = servicesArray.map((id: string) => {
                    const name = idToNameMap.get(id);
                    if (!name) {
                        console.warn(`⚠️ Retry - Service name not found for ID: ${id}`);
                    }
                    return name || id;
                });
                selectedServiceNamesText = namesList.join(", ");
                console.log("✅ Retry - Updated service names text:", selectedServiceNamesText);
            }
        } catch (e: any) {
            console.error("❌ Retry - Error updating service names:", e?.message || e);
        }
    }
    
    // Kritik alanlar için güvenli güncelleme (ERP'nin bazı durumlarda alanları atlamasını engellemek için)
    // ÖZELLİKLE: Services gönderildiğinde veya mevcut Lead'de varsa, servis isimlerini MUTLAKA güncelle
    try {
        const safePayload: any = {};
        
        // Services gönderildiyse veya mevcut Lead'de varsa, servis isimlerini güncelle
        if (selectedServicesJson) {
            safePayload.custom_selected_services = selectedServicesJson;
            console.log("📝 Adding custom_selected_services to safe payload:", selectedServicesJson);
        }
        
        // Servis isimlerini MUTLAKA güncelle
        // Eğer selectedServiceNamesText varsa ve düzgün görünüyorsa (ID değilse), kullan
        if (selectedServiceNamesText && selectedServiceNamesText.trim()) {
            // Eğer isimler ID gibi görünüyorsa (kısa veya sayısal), tekrar fetch et
            const namesArray = selectedServiceNamesText.split(", ");
            const looksLikeIds = namesArray.some(name => name.length < 3 || /^[0-9a-z]{8,}$/i.test(name));
            
            if (looksLikeIds && selectedServicesJson) {
                console.log("⚠️ Service names look like IDs, fetching real names in safe update...");
                console.log("  - Current names (looks like IDs):", selectedServiceNamesText);
                console.log("  - Services JSON:", selectedServicesJson);
                try {
                    const servicesArray = JSON.parse(selectedServicesJson);
                    const idsJson = JSON.stringify(servicesArray);
                    const filters = `[["name", "in", ${idsJson}]]`;
                    const fields = `["name", "service_name", "title"]`;
                    
                    console.log("  - Safe update API Request:");
                    console.log("    - Service IDs:", servicesArray);
                    console.log("    - Filters:", filters);
                    console.log("    - Fields:", fields);
                    
                    let serviceData: any[] = [];
                    const BASE_URL_SAFE = process.env.NEXT_PUBLIC_ERP_BASE_URL;
                    
                    try {
                        // get-services endpoint'indeki gibi direkt fetch kullan - tüm field'ları getir
                        const fields = encodeURIComponent(JSON.stringify(["*"]));
                        const apiUrl = `/api/resource/Services?fields=${fields}`;
                        console.log("    - Full API URL:", apiUrl);
                        
                        if (BASE_URL_SAFE) {
                            const response = await fetch(`${BASE_URL_SAFE}${apiUrl}`, {
                                method: "GET",
                                headers: {
                                    "Content-Type": "application/json",
                                    "Authorization": token,
                                },
                                cache: "no-store",
                            });

                            if (response.ok) {
                                const res = await response.json();
                                console.log("    - Raw API Response keys:", Object.keys(res || {}));
                                
                                // Response formatını kontrol et
                                if (res?.data && Array.isArray(res.data)) {
                                    serviceData = res.data;
                                } else if (Array.isArray(res)) {
                                    serviceData = res;
                                } else if (res?.message && Array.isArray(res.message)) {
                                    serviceData = res.message;
                                }
                                
                                // ID'lere göre filtrele
                                const serviceIdSet = new Set(servicesArray);
                                serviceData = serviceData.filter((s: any) => {
                                    const serviceId = s.name || s.id;
                                    return serviceIdSet.has(serviceId);
                                });
                                
                                console.log("    - Parsed and filtered service data:", serviceData.length, "items");
                            } else {
                                const errorText = await response.text();
                                console.error("    - Services API failed:", response.status, errorText.substring(0, 200));
                                
                                // Service (singular) dene
                                try {
                                    const apiUrl2 = `/api/resource/Service?fields=${fields}`;
                                    const response2 = await fetch(`${BASE_URL_SAFE}${apiUrl2}`, {
                                        method: "GET",
                                        headers: {
                                            "Content-Type": "application/json",
                                            "Authorization": token,
                                        },
                                        cache: "no-store",
                                    });
                                    
                                    if (response2.ok) {
                                        const res2 = await response2.json();
                                        if (res2?.data && Array.isArray(res2.data)) {
                                            serviceData = res2.data;
                                        } else if (Array.isArray(res2)) {
                                            serviceData = res2;
                                        }
                                        
                                        const serviceIdSet = new Set(servicesArray);
                                        serviceData = serviceData.filter((s: any) => {
                                            const serviceId = s.name || s.id;
                                            return serviceIdSet.has(serviceId);
                                        });
                                        
                                        console.log("    - Service (singular) response:", serviceData.length, "items");
                                    }
                                } catch (e2: any) {
                                    console.error("    - Service (singular) also failed:", e2?.message || e2);
                                }
                            }
                        }
                    } catch (e: any) {
                        console.error("    - Services fetch failed:", e?.message || e);
                    }
                    
                    if (serviceData.length > 0) {
                        const idToNameMap = new Map<string, string>();
                        serviceData.forEach((s: any) => {
                            const serviceName = s.service_name || s.title || s.name;
                            idToNameMap.set(s.name, serviceName);
                            console.log(`  ✅ Safe update - Service mapping: ${s.name} → ${serviceName}`);
                        });
                        const namesList = servicesArray.map((id: string) => idToNameMap.get(id) || id);
                        const finalNamesText = namesList.join(", ");
                        if (finalNamesText && finalNamesText.trim() && !finalNamesText.split(", ").some((n: string) => /^[0-9a-z]{8,}$/i.test(n))) {
                            safePayload.custom_selected_services_name = finalNamesText.trim();
                            console.log("✅ Service names fetched in safe update:", finalNamesText);
                        } else {
                            // Hala ID'ler geliyorsa, mevcut değeri kullan
                            safePayload.custom_selected_services_name = selectedServiceNamesText.trim();
                            console.log("⚠️ Still got IDs, using current value:", selectedServiceNamesText);
                        }
                    } else {
                        // API'den veri gelmedi, mevcut değeri kullan
                        safePayload.custom_selected_services_name = selectedServiceNamesText.trim();
                        console.log("⚠️ No service data from API, using current value:", selectedServiceNamesText);
                    }
                } catch (e) {
                    console.error("❌ Safe update - Retry service name lookup failed:", e);
                    // Hata durumunda da mevcut değeri kullan
                    safePayload.custom_selected_services_name = selectedServiceNamesText.trim();
                }
            } else {
                // İsimler düzgün görünüyor, direkt kullan
                safePayload.custom_selected_services_name = selectedServiceNamesText.trim(); // TEKİL!
                console.log("📝 Adding custom_selected_services_name to safe payload:", selectedServiceNamesText);
            }
        } else if (selectedServicesJson) {
            // Services gönderildi ama isimler hiç fetch edilemedi - tekrar dene
            console.log("⚠️ Services sent but names not fetched at all. Retrying service name lookup in safe update...");
            try {
                const servicesArray = JSON.parse(selectedServicesJson);
                const idsJson = JSON.stringify(servicesArray);
                const filters = `[["name", "in", ${idsJson}]]`;
                const fields = `["name", "service_name", "title"]`;
                
                let serviceData: any[] = [];
                try {
                    const res = await erpGet(`/api/resource/Services?filters=${encodeURIComponent(filters)}&fields=${encodeURIComponent(fields)}`, token);
                    serviceData = res?.data || (Array.isArray(res) ? res : []);
                } catch (e) {
                    try {
                        const res = await erpGet(`/api/resource/Service?filters=${encodeURIComponent(filters)}&fields=${encodeURIComponent(fields)}`, token);
                        serviceData = res?.data || (Array.isArray(res) ? res : []);
                    } catch (e2) {}
                }
                
                if (serviceData.length > 0) {
                    const idToNameMap = new Map<string, string>();
                    serviceData.forEach((s: any) => {
                        const serviceName = s.service_name || s.title || s.name;
                        idToNameMap.set(s.name, serviceName);
                    });
                    const namesList = servicesArray.map((id: string) => idToNameMap.get(id) || id);
                    const finalNamesText = namesList.join(", ");
                    if (finalNamesText && finalNamesText.trim()) {
                        safePayload.custom_selected_services_name = finalNamesText.trim();
                        console.log("✅ Service names fetched in safe update (final retry):", finalNamesText);
                    }
                }
            } catch (e) {
                console.error("❌ Final retry service name lookup failed:", e);
            }
        }
        
        if (companyTypeNameForLead) safePayload.custom_company_type_name = companyTypeNameForLead;
        if (documentDataJson) safePayload.custom_document_data = documentDataJson;
        if (companyInfo?.taxIdNumber && companyInfo.taxIdNumber.trim()) {
            safePayload.custom_tax_id = companyInfo.taxIdNumber.trim();
            safePayload.tax_id = companyInfo.taxIdNumber.trim();
        }

        if (Object.keys(safePayload).length > 0) {
            console.log("💾 Safe update payload:", JSON.stringify(safePayload, null, 2));
            await erpPut(`/api/resource/Lead/${encodeURIComponent(leadName)}`, safePayload, token);
            console.log("✅ Safe update applied for display fields:", Object.keys(safePayload));
        } else {
            console.log("ℹ️ No safe update needed (all fields already in main payload)");
        }
    } catch (e: any) {
        console.error("⚠️ Safe update failed (optional fields):", e?.message || e);
        console.error("Error details:", e?.response?.data || "No additional details");
    }

    // User oluşturma artık email doğrulama akışında yapılıyor (complete-signup)
    console.log("ℹ️ User creation skipped in update-lead (handled by complete-signup)");

    console.log("✅ Update Lead completed successfully");
    
    return NextResponse.json({ 
        success: true, 
        lead: leadResult?.data || leadResult,
        message: "Lead updated successfully. Check console for Address and Contact creation details."
    });

  } catch (e: any) {
    console.error("❌ Update Lead failed:", e);
    console.error("Error stack:", e?.stack);
    return NextResponse.json({ 
        error: e.message,
        details: e?.response?.data || "No additional details"
    }, { status: 500 });
  }
}