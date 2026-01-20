import { NextRequest, NextResponse } from "next/server";
import { erpGet } from "@/lib/erp";

/**
 * Bu API endpoint'i ERPNext'ten aktif company type'ları getirir.
 * Registration Documents sayfasında company type seçimi için kullanılacak.
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

    // Company Type DocType'ını bul - farklı olası isimleri dene
    const possibleDocTypeNames = [
      "Company Type",
      "CompanyType",
      "Company Types",
      "CompanyTypes",
      "Company_Type",
      "Company_Types",
    ];
    
    let companyTypesResult = null;
    let foundDocType = null;
    const BASE_URL = process.env.NEXT_PUBLIC_ERP_BASE_URL;
    const debugInfo: string[] = [];
    
    // Her DocType adını dene
    for (const doctypeName of possibleDocTypeNames) {
      try {
        const fields = encodeURIComponent(JSON.stringify(["*"]));
        const url = `/api/resource/${encodeURIComponent(doctypeName)}?fields=${fields}`;
        
        // Direkt fetch ile kontrol et (daha detaylı hata bilgisi için)
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
            companyTypesResult = await response.json();
            foundDocType = doctypeName;
            debugInfo.push(`Found DocType: ${doctypeName}`);
            break;
          } else {
            const errorText = await response.text();
            debugInfo.push(`${doctypeName}: ${response.status} - ${errorText.substring(0, 100)}`);
          }
        } else {
          // Fallback: erpGet kullan
          companyTypesResult = await erpGet(url, token);
          if (companyTypesResult) {
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
    
    
    if (!foundDocType || !companyTypesResult) {
      console.error(
        `Could not find Company Type DocType. Tried: ${possibleDocTypeNames.join(", ")}. ` +
        `Debug info: ${debugInfo.join(" | ")}`
      );
      return NextResponse.json({
        success: false,
        error: `Company Type DocType not found. Tried: ${possibleDocTypeNames.join(", ")}`,
        debug: process.env.NODE_ENV === "development" ? debugInfo : undefined,
        companyTypes: [],
      }, { status: 404 });
    }

    // Response formatını kontrol et
    let companyTypes = [];
    if (companyTypesResult?.data && Array.isArray(companyTypesResult.data)) {
      companyTypes = companyTypesResult.data;
      console.log(`Found ${companyTypes.length} company types in data array`);
    } else if (Array.isArray(companyTypesResult)) {
      companyTypes = companyTypesResult;
    } else if (companyTypesResult?.message && Array.isArray(companyTypesResult.message)) {
      companyTypes = companyTypesResult.message;
      console.log(`Found ${companyTypes.length} company types in message`);
    } else {
      console.warn("Unexpected company types result format:", {
        hasData: !!companyTypesResult?.data,
        isArray: Array.isArray(companyTypesResult),
        hasMessage: !!companyTypesResult?.message,
        keys: Object.keys(companyTypesResult || {}),
      });
    }
    
    // Eğer hala boşsa ve companyTypesResult varsa, içeriğini logla
    if (companyTypes.length === 0 && companyTypesResult) {
      console.warn("Company types array is empty. Full result:", JSON.stringify(companyTypesResult).substring(0, 500));
    }


    // Company type'ları formatla - custom_ prefix'li field'ları da kontrol et
    const processedCompanyTypes = Array.isArray(companyTypes) ? companyTypes
      .filter((ct: any) => {
        // Disabled olmayan company type'ları filtrele
        if (ct.disabled !== undefined) {
          return !ct.disabled;
        }
        // custom_is_active veya is_active field'ı varsa kontrol et
        if (ct.custom_is_active !== undefined) {
          return ct.custom_is_active;
        }
        if (ct.is_active !== undefined) {
          return ct.is_active;
        }
        // Status field'ı yoksa, hepsini göster
        return true;
      })
      .map((ct: any) => {
      // Field isimleri custom_ prefix'li olabilir
      // Company Type DocType field: company_type_name (standart field)
      const companyTypeName = ct.company_type_name || ct.name;
      const description = ct.custom_description || ct.description || "";
      const isActive = ct.custom_is_active !== undefined ? ct.custom_is_active : 
                      (ct.is_active !== undefined ? ct.is_active : 
                      (ct.disabled !== undefined ? !ct.disabled : true));
      
      // Company Type ID'sini al
      const companyTypeId = ct.name || ct.id || "";
      
      if (!companyTypeId) {
        console.warn("Company Type without ID/name found:", ct);
      }
      
      return {
        id: companyTypeId,
        name: companyTypeName || companyTypeId, // Eğer isim yoksa ID'yi kullan
        description: description,
        isActive: isActive,
      };
    })
    .filter((ct: any) => ct.id) // ID'si olmayan company type'ları filtrele
    : [];
    


    return NextResponse.json({
      success: true,
      companyTypes: processedCompanyTypes,
    });
  } catch (e: any) {
    console.error("ERP get company types error:", e);
    
    return NextResponse.json(
      {
        error: e.message || "Failed to get company types from ERP",
        companyTypes: [],
      },
      { status: 500 }
    );
  }
}

