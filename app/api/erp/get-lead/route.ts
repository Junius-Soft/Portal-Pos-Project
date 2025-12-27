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
      return NextResponse.json(
        { error: "Email is required" },
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

    // Lead'i email ile bul
    const leadFilters = encodeURIComponent(JSON.stringify([["email_id", "=", email]]));
    const leadFields = encodeURIComponent(JSON.stringify(["*"]));
    
    const leadResult = await erpGet(
      `/api/resource/Lead?filters=${leadFilters}&fields=${leadFields}`,
      token
    );

    const leads = leadResult?.data || (Array.isArray(leadResult) ? leadResult : []);

    if (Array.isArray(leads) && leads.length > 0) {
      const lead = leads[0];
      const leadName = lead.name;
      
      // Address kaydını oku (Address & Contacts için)
      try {
        const addressFilters = encodeURIComponent(
          JSON.stringify([
            ["link_doctype", "=", "Lead"],
            ["link_name", "=", leadName],
            ["address_type", "=", "Billing"]
          ])
        );
        const addressFields = encodeURIComponent(JSON.stringify(["*"]));
        const addressResult = await erpGet(
          `/api/resource/Address?filters=${addressFilters}&fields=${addressFields}`,
          token
        );

        const addresses = addressResult?.data || (Array.isArray(addressResult) ? addressResult : []);
        
        // Eğer Address kaydı varsa, Lead'in address field'larını Address'ten güncelle
        if (Array.isArray(addresses) && addresses.length > 0) {
          const address = addresses[0];
          
          // Address'ten gelen bilgileri Lead'e override et (Address öncelikli)
          if (address.address_line1) {
            lead.address_line1 = address.address_line1;
          }
          if (address.address_line2) {
            lead.address_line2 = address.address_line2;
          }
          if (address.city) {
            lead.city = address.city;
          }
          if (address.county) {
            // County bilgisi varsa onu da sakla (ERPNext'te city bazen county'de olabilir)
            if (!lead.city) {
              lead.city = address.county;
            }
          }
          if (address.pincode) {
            lead.pincode = address.pincode;
          }
          if (address.state) {
            lead.state = address.state;
          }
          if (address.country) {
            lead.country = address.country;
          }
        }
      } catch (addressError: any) {
        console.warn("Error fetching Address:", addressError);
        // Address hatası Lead'i etkilemesin, devam et
      }
      
      // JSON string'leri parse et
      let businessRegistrationFiles = [];
      let idFiles = [];
      let shareholdersFiles = [];
      let registerExtractFiles = [];
      let hrExtractFiles = [];

      try {
        if (lead.custom_business_registration_files) {
          businessRegistrationFiles = JSON.parse(lead.custom_business_registration_files);
        }
      } catch (e) {
        console.warn("Error parsing business registration files:", e);
      }

      try {
        if (lead.custom_id_files) {
          idFiles = JSON.parse(lead.custom_id_files);
        }
      } catch (e) {
        console.warn("Error parsing ID files:", e);
      }

      try {
        if (lead.custom_shareholders_files) {
          shareholdersFiles = JSON.parse(lead.custom_shareholders_files);
        }
      } catch (e) {
        console.warn("Error parsing shareholders files:", e);
      }

      try {
        if (lead.custom_register_extract_files) {
          registerExtractFiles = JSON.parse(lead.custom_register_extract_files);
        }
      } catch (e) {
        console.warn("Error parsing register extract files:", e);
      }

      try {
        if (lead.custom_hr_extract_files) {
          hrExtractFiles = JSON.parse(lead.custom_hr_extract_files);
        }
      } catch (e) {
        console.warn("Error parsing HR extract files:", e);
      }

      // Parse businesses array
      let businesses = [];
      try {
        if (lead.custom_businesses) {
          businesses = JSON.parse(lead.custom_businesses);
        }
      } catch (e) {
        console.warn("Error parsing businesses:", e);
      }

      return NextResponse.json({
        success: true,
        lead: {
          ...lead,
          // Parse edilmiş file arrays
          businessRegistrationFiles,
          idFiles,
          shareholdersFiles,
          registerExtractFiles,
          hrExtractFiles,
          businesses, // Parse edilmiş businesses array
        },
      });
    } else {
      return NextResponse.json({
        success: false,
        lead: null,
        message: "No lead found for this user",
      });
    }
  } catch (e: any) {
    console.error("ERP get lead error:", e);
    
    return NextResponse.json(
      {
        error: e.message || "Failed to get lead from ERP",
      },
      { status: 500 }
    );
  }
}

