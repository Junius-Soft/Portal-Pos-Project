import { NextRequest, NextResponse } from "next/server";
import { erpGet } from "@/lib/erp";

/**
 * Bu API endpoint'i ERPNext'ten aktif servisleri getirir.
 * Services sayfasında göstermek için kullanılacak.
 */
export async function GET(req: NextRequest) {
  try {
    const token = process.env.ERP_API_TOKEN;

    if (!token) {
      return NextResponse.json(
        { error: "ERP_API_TOKEN environment variable is not set" },
        { status: 500 }
      );
    }

    // DocType adını bulmak için farklı olasılıkları dene
    const possibleDocTypeNames = [
      "Services", // Çoğul form
      "Service", // Tekil form
      "Restaurant Service", // Tam isim
      "Restaurant Services", // Çoğul tam isim
    ];
    
    let servicesResult;
    let foundDocType = null;
    
    // Her DocType adını dene
    for (const doctypeName of possibleDocTypeNames) {
      try {
        const fields = encodeURIComponent(JSON.stringify(["*"])); // Tüm field'ları getir
        
        const url = `/api/resource/${encodeURIComponent(doctypeName)}?fields=${fields}`;
        console.log(`Trying DocType: ${doctypeName} - URL: ${url}`);
        
        servicesResult = await erpGet(url, token);
        console.log(`Success! Found DocType: ${doctypeName}`);
        console.log("Services result:", JSON.stringify(servicesResult, null, 2));
        
        foundDocType = doctypeName;
        break; // Başarılı olursa döngüden çık
      } catch (error: any) {
        console.log(`DocType '${doctypeName}' not found, trying next...`);
        // Bu DocType bulunamadı, bir sonrakini dene
        continue;
      }
    }
    
    // Hiçbir DocType bulunamadıysa hata fırlat
    if (!foundDocType) {
      throw new Error(
        `Could not find Service DocType. Tried: ${possibleDocTypeNames.join(", ")}. ` +
        `Please check the DocType name in ERPNext. It should match one of these names.`
      );
    }

    // Response formatını kontrol et
    let services = [];
    if (servicesResult?.data && Array.isArray(servicesResult.data)) {
      services = servicesResult.data;
    } else if (Array.isArray(servicesResult)) {
      services = servicesResult;
    } else if (servicesResult?.message && Array.isArray(servicesResult.message)) {
      services = servicesResult.message;
    }

    console.log("Processed services count:", services.length);

    // Her service için image URL'ini base URL ile birleştir
    const baseUrl = process.env.NEXT_PUBLIC_ERP_BASE_URL;
    const processedServices = Array.isArray(services) ? services.map((service: any) => {
      console.log("Processing service:", service.name);
      console.log("Service data:", JSON.stringify(service, null, 2));
      
      // Field isimlerini kontrol et - farklı olabilir
      const serviceName = service.service_name || service.name || service.title || "";
      const description = service.description || service.desc || "";
      const imageField = service.service_image || service.image || service.attachment || null;
      const isActive = service.is_active !== undefined ? service.is_active : 
                      (service.enabled !== undefined ? service.enabled : true);
      const contracts = service.service_contracts || service.contracts || [];
      
      let imageUrl = null;
      if (imageField) {
        // ERPNext image path'i zaten tam path olabilir veya relative path olabilir
        if (typeof imageField === 'string') {
          if (imageField.startsWith("http")) {
            imageUrl = imageField;
          } else if (imageField.startsWith("/")) {
            imageUrl = `${baseUrl}${imageField}`;
          } else {
            imageUrl = `${baseUrl}/${imageField}`;
          }
        }
      }

      return {
        id: service.name,
        name: serviceName,
        description: description,
        image: imageUrl,
        isActive: isActive,
        contracts: contracts, // Child table verileri
      };
    }) : [];

    console.log("Final processed services:", processedServices.length);

    return NextResponse.json({
      success: true,
      services: processedServices,
    });
  } catch (e: any) {
    console.error("ERP get services error:", e);
    
    return NextResponse.json(
      {
        error: e.message || "Failed to get services from ERP",
        services: [],
      },
      { status: 500 }
    );
  }
}

