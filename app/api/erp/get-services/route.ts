import { NextRequest, NextResponse } from "next/server";
import { erpGet } from "@/lib/erp";

/**
 * Bu API endpoint'i ERPNext'ten aktif servisleri getirir.
 * Services sayfasında göstermek için kullanılacak.
 */
// Force dynamic rendering - bu route her zaman dynamic olmalı
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const token = process.env.ERP_API_TOKEN;

    if (!token) {
      return NextResponse.json(
        { error: "ERP_API_TOKEN environment variable is not set" },
        { status: 500 }
      );
    }

    // Token formatını kontrol et ve logla (sadece ilk ve son 5 karakteri)
    const tokenPreview = token.length > 10 
      ? `${token.substring(0, 5)}...${token.substring(token.length - 5)}`
      : "***";
    console.log("Token preview:", tokenPreview);
    console.log("Token format check:", {
      hasToken: !!token,
      tokenLength: token.length,
      startsWithToken: token.startsWith("token "),
      startsWithBearer: token.startsWith("Bearer "),
      hasColon: token.includes(":"),
    });

    // DocType adını bulmak için farklı olasılıkları dene
    const possibleDocTypeNames = [
      "Services", // Çoğul form
      "Service", // Tekil form
      "Restaurant Service", // Tam isim
      "Restaurant Services", // Çoğul tam isim
      "POS Service", // Alternatif isim
      "POS Services", // Alternatif çoğul
    ];
    
    let servicesResult = null;
    let foundDocType = null;
    const BASE_URL = process.env.NEXT_PUBLIC_ERP_BASE_URL;
    const debugInfo: string[] = [];
    
    // Her DocType adını dene
    for (const doctypeName of possibleDocTypeNames) {
      try {
        const fields = encodeURIComponent(JSON.stringify(["*"])); // Tüm field'ları getir
        const url = `/api/resource/${encodeURIComponent(doctypeName)}?fields=${fields}`;
        
        // erpGet null döndürebilir, direkt fetch ile daha detaylı kontrol yap
        if (BASE_URL) {
          const response = await fetch(`${BASE_URL}${url}`, {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              "Authorization": token,
            },
            cache: "no-store",
          });

          if (response.ok) {
            servicesResult = await response.json();
            foundDocType = doctypeName;
            debugInfo.push(`Found DocType: ${doctypeName}`);
            break; // Başarılı olursa döngüden çık
          } else {
            const errorText = await response.text();
            debugInfo.push(`${doctypeName}: ${response.status} - ${errorText.substring(0, 100)}`);
          }
        } else {
          // erpGet ile de dene (fallback)
          servicesResult = await erpGet(url, token);
          if (servicesResult) {
            foundDocType = doctypeName;
            debugInfo.push(`Found DocType (via erpGet): ${doctypeName}`);
            break;
          }
        }
      } catch (error: any) {
        debugInfo.push(`${doctypeName}: Error - ${error?.message || 'Unknown error'}`);
        continue;
      }
    }
    
    // Debug bilgilerini logla
    if (debugInfo.length > 0) {
      console.log("Service DocType search debug:", debugInfo.join(" | "));
    }
    
    // Hiçbir DocType bulunamadıysa
    if (!foundDocType || !servicesResult) {
      console.error(
        `Could not find Service DocType. Tried: ${possibleDocTypeNames.join(", ")}. ` +
        `Debug info: ${debugInfo.join(" | ")}`
      );
      return NextResponse.json({
        success: false,
        error: `Service DocType not found. Tried: ${possibleDocTypeNames.join(", ")}`,
        debug: process.env.NODE_ENV === "development" ? debugInfo : undefined,
        services: [],
      }, { status: 404 });
    }

    // Response formatını kontrol et
    let services = [];
    if (servicesResult?.data && Array.isArray(servicesResult.data)) {
      services = servicesResult.data;
      console.log(`Found ${services.length} services in data array`);
    } else if (Array.isArray(servicesResult)) {
      services = servicesResult;
      console.log(`Found ${services.length} services (direct array)`);
    } else if (servicesResult?.message && Array.isArray(servicesResult.message)) {
      services = servicesResult.message;
      console.log(`Found ${services.length} services in message`);
    } else {
      console.warn("Unexpected services result format:", {
        hasData: !!servicesResult?.data,
        isArray: Array.isArray(servicesResult),
        hasMessage: !!servicesResult?.message,
        keys: Object.keys(servicesResult || {}),
      });
    }
    
    // Eğer hala boşsa ve servicesResult varsa, içeriğini logla
    if (services.length === 0 && servicesResult) {
      console.warn("Services array is empty. Full result:", JSON.stringify(servicesResult).substring(0, 500));
    }


    // Her service için image URL'ini base URL ile birleştir
    const baseUrl = process.env.NEXT_PUBLIC_ERP_BASE_URL;
    const processedServices = Array.isArray(services) ? services
      .filter((service: any) => {
        // Aktif olmayan servisleri filtrele (eğer disabled field'ı varsa)
        // Ama eğer hiç status field'ı yoksa, hepsini göster
        if (service.disabled !== undefined) {
          return !service.disabled;
        }
        if (service.is_active !== undefined) {
          return service.is_active;
        }
        if (service.enabled !== undefined) {
          return service.enabled;
        }
        // Status field'ı yoksa, hepsini göster
        return true;
      })
      .map((service: any) => {
      
      // Field isimlerini kontrol et - farklı olabilir
      const serviceName = service.service_name || service.title || service.name || service.service_name || "";
      const description = service.description || service.desc || service.desc || "";
      const imageField = service.service_image || service.image || service.attachment || service.service_image_url || null;
      const isActive = service.is_active !== undefined ? service.is_active : 
                      (service.enabled !== undefined ? service.enabled : 
                      (service.disabled !== undefined ? !service.disabled : true));
      const contracts = service.service_contracts || service.contracts || service.contract || [];
      
      let imageUrl = null;
      if (imageField) {
        // ERPNext image path'i zaten tam path olabilir veya relative path olabilir
        if (typeof imageField === 'string') {
          // ERPNext'teki /private/files/ dosyaları authentication gerektiriyor
          // Bu yüzden proxy endpoint üzerinden geçiriyoruz
          // Frontend'den /api/erp/proxy-image?url=... şeklinde çağrılacak
          
          let erpImagePath = imageField;
          
          // Tam URL ise path'i çıkar
          if (imageField.startsWith("http")) {
            try {
              const url = new URL(imageField);
              erpImagePath = url.pathname;
            } catch {
              erpImagePath = imageField;
            }
          }
          
          // Proxy URL'i oluştur
          // encodeURIComponent ile URL'i encode et (path içindeki özel karakterler için)
          imageUrl = `/api/erp/proxy-image?url=${encodeURIComponent(erpImagePath)}`;
        }
      } else {
      }

      // Service ID'sini al - name field'ı document name (ID) olmalı
      const serviceId = service.name || service.id || "";
      
      if (!serviceId) {
        console.warn("Service without ID/name found:", service);
      }

      return {
        id: serviceId,
        name: serviceName || serviceId, // Eğer isim yoksa ID'yi kullan
        description: description,
        image: imageUrl,
        isActive: isActive,
        contracts: contracts, // Child table verileri
      };
    })
    .filter((service: any) => service.id) // ID'si olmayan servisleri filtrele
    : [];
    
    console.log(`Processed ${processedServices.length} services after filtering`);


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

