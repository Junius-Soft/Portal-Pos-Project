import { NextRequest, NextResponse } from "next/server";
import { erpGet } from "@/lib/erp";

export async function POST(req: NextRequest) {
  try {
    const { reference } = await req.json();

    if (!reference) {
      return NextResponse.json(
        { error: "Sales Person ID is required" },
        { status: 400 }
      );
    }

    // Reference'ı temizle (trim ve normalize)
    const cleanReference = reference.trim();

    const token = process.env.ERP_API_TOKEN;

    if (!token) {
      return NextResponse.json(
        { error: "ERP_API_TOKEN environment variable is not set" },
        { status: 500 }
      );
    }

    // ERPNext REST API: Önce document name (ID) ile dene, sonra diğer field'larla ara
    let salesPerson = null;
    let debugInfo: string[] = [];
    
    // Yöntem 1: Document name (ID) ile direkt arama (örn: v9tt1qp0tn, SP-00001)
    try {
      const BASE_URL = process.env.NEXT_PUBLIC_ERP_BASE_URL;
      if (BASE_URL) {
        const response = await fetch(
          `${BASE_URL}/api/resource/Sales Person/${encodeURIComponent(cleanReference)}`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              "Authorization": token,
            },
            cache: "no-store",
          }
        );

        if (response.ok) {
          const result1 = await response.json();
          salesPerson = result1?.data || result1;
          if (salesPerson && salesPerson.name) {
            debugInfo.push(`Found by document name: ${cleanReference} -> ${salesPerson.name}`);
          }
        } else {
          const errorText = await response.text();
          debugInfo.push(`Document name search failed (${response.status}): ${errorText.substring(0, 100)}`);
        }
      }
    } catch (e: any) {
      debugInfo.push(`Error with document name search: ${e?.message || 'Unknown error'}`);
    }

    // Yöntem 2: Eğer bulunamadıysa, name field'ı ile filter ile ara (case-insensitive için LIKE kullan)
    if (!salesPerson) {
      try {
        // Önce exact match dene
        const filtersExact = encodeURIComponent(
          JSON.stringify([["name", "=", cleanReference]])
        );
        const result2a = await erpGet(
          `/api/resource/Sales Person?filters=${filtersExact}&limit_page_length=1`,
          token
        );
        if (result2a) {
          const salesPersons = result2a?.data || (Array.isArray(result2a) ? result2a : []);
          if (salesPersons.length > 0) {
            salesPerson = salesPersons[0];
            debugInfo.push(`Found by name field (exact): ${cleanReference}`);
          }
        }
      } catch (e: any) {
        debugInfo.push(`Error with name field search: ${e?.message || 'Unknown error'}`);
      }
    }

    // Yöntem 3: sales_person_name field'ı ile filter ile ara
    if (!salesPerson) {
      try {
        const filters = encodeURIComponent(
          JSON.stringify([["sales_person_name", "=", cleanReference]])
        );
        const result3 = await erpGet(
          `/api/resource/Sales Person?filters=${filters}&limit_page_length=1`,
          token
        );
        if (result3) {
          const salesPersons = result3?.data || (Array.isArray(result3) ? result3 : []);
          if (salesPersons.length > 0) {
            salesPerson = salesPersons[0];
            debugInfo.push(`Found by sales_person_name: ${cleanReference}`);
          } else {
            debugInfo.push(`Not found by sales_person_name: ${cleanReference}`);
          }
        }
      } catch (e: any) {
        debugInfo.push(`Error with sales_person_name search: ${e?.message || 'Unknown error'}`);
      }
    }

    // Yöntem 4: employee field'ı ile de dene (bazı ERPNext kurulumlarında)
    if (!salesPerson) {
      try {
        const filters = encodeURIComponent(
          JSON.stringify([["employee", "=", cleanReference]])
        );
        const result4 = await erpGet(
          `/api/resource/Sales Person?filters=${filters}&limit_page_length=1`,
          token
        );
        if (result4) {
          const salesPersons = result4?.data || (Array.isArray(result4) ? result4 : []);
          if (salesPersons.length > 0) {
            salesPerson = salesPersons[0];
            debugInfo.push(`Found by employee: ${cleanReference}`);
          }
        }
      } catch (e: any) {
        debugInfo.push(`Error with employee search: ${e?.message || 'Unknown error'}`);
      }
    }

    // Yöntem 5: Son çare - Tüm Sales Person'ları çekip JavaScript'te ara (case-insensitive)
    if (!salesPerson) {
      try {
        const allSalesPersons = await erpGet(
          `/api/resource/Sales Person?fields=["name","sales_person_name","employee"]&limit_page_length=1000`,
          token
        );
        if (allSalesPersons) {
          const salesPersonsList = allSalesPersons?.data || (Array.isArray(allSalesPersons) ? allSalesPersons : []);
          // JavaScript'te case-insensitive arama yap
          const found = salesPersonsList.find((sp: any) => {
            const name = (sp.name || "").toLowerCase();
            const salesPersonName = (sp.sales_person_name || "").toLowerCase();
            const employee = (sp.employee || "").toLowerCase();
            const searchValue = cleanReference.toLowerCase();
            return name === searchValue || 
                   salesPersonName === searchValue || 
                   employee === searchValue ||
                   name.includes(searchValue) ||
                   salesPersonName.includes(searchValue);
          });
          if (found) {
            // Bulunan Sales Person'ın tam detaylarını çek
            const fullDetails = await erpGet(
              `/api/resource/Sales Person/${encodeURIComponent(found.name)}`,
              token
            );
            if (fullDetails) {
              salesPerson = fullDetails?.data || fullDetails;
              debugInfo.push(`Found by listing all and searching: ${cleanReference} -> ${found.name}`);
            }
          } else {
            debugInfo.push(`Not found in all Sales Persons list (searched ${salesPersonsList.length} records)`);
          }
        }
      } catch (e: any) {
        debugInfo.push(`Error with listing all search: ${e?.message || 'Unknown error'}`);
      }
    }

    // Debug bilgilerini logla (production'da kaldırılabilir)
    if (debugInfo.length > 0) {
      console.log("Sales Person search debug:", debugInfo.join(" | "));
    }

    if (!salesPerson) {
      // Debug bilgilerini response'a ekle (development için)
      return NextResponse.json(
        {
          valid: false,
          message: "Sales Person ID not found",
          debug: process.env.NODE_ENV === "development" ? debugInfo : undefined,
          searchedValue: cleanReference,
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      valid: true,
      sales_person: salesPerson,
    });
  } catch (e: any) {
    console.error("Sales Person ID validation error:", e);

    const message = typeof e?.message === "string" ? e.message : "";

    // Eğer ERP tarafı 404 / DoesNotExistError döndürdüyse, bunu daha okunabilir bir
    // \"Sales Person ID not found\" mesajına çevir.
    if (message.includes("DoesNotExistError") || message.toLowerCase().includes("not found")) {
      return NextResponse.json(
        {
          valid: false,
          message: "Sales Person ID not found",
        },
        { status: 404 }
      );
    }

    // Diğer tüm hatalar için genel mesaj
    return NextResponse.json(
      {
        error: "Failed to validate Sales Person ID",
      },
      { status: 500 }
    );
  }
}


