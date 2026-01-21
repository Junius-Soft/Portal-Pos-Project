"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useRegistration } from "@/contexts/RegistrationContext";
import ProgressBar from "@/components/ProgressBar";
import AddressAutocomplete from "@/components/AddressAutocomplete";
import RegisterButton from "@/components/RegisterButton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2, Plus } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import PhoneInput, { Country } from "react-phone-number-input";
import "react-phone-number-input/style.css";
import countries from "i18n-iso-countries";
import en from "i18n-iso-countries/langs/en.json";
import tr from "i18n-iso-countries/langs/tr.json";
import de from "i18n-iso-countries/langs/de.json";

countries.registerLocale(en);
countries.registerLocale(tr);
countries.registerLocale(de);

const getCountryIsoCode = (countryName?: string): Country | undefined => {
  if (!countryName) return undefined;
  const code = countries.getAlpha2Code(countryName, "en") || 
               countries.getAlpha2Code(countryName, "tr") ||
               countries.getAlpha2Code(countryName, "de");
  return code as Country;
};

export default function CompanyInformationPage() {
  const router = useRouter();
  const { formData, updateFormData, goToStep } = useRegistration();
  const [restaurantCount, setRestaurantCount] = useState(
    formData.companyInfo.restaurantCount || "1"
  );
  const hasLoadedCompanyInfo = useRef(false);
  const hasCompletedSignup = useRef(false);
  const lastSelectedStreetRef = useRef<string | null>(null);
  const companyMainIso = getCountryIsoCode(formData.companyInfo.country) || "DE";

  const [businesses, setBusinesses] = useState([
    {
      businessName: "",
      ownerDirector: "",
      ownerTelephone: "",
      ownerEmail: "",
      differentContact: false,
      contactPerson: "",
      contactTelephone: "",
      contactEmail: "",
      street: "",
      city: "",
      postalCode: "",
      federalState: "",
      country: "",
    },
  ]);

  const addBusiness = () => {
    setBusinesses([
      ...businesses,
      {
        businessName: "",
        ownerDirector: "",
        ownerTelephone: "",
        ownerEmail: "",
        differentContact: false,
        contactPerson: "",
        contactTelephone: "",
        contactEmail: "",
        street: "",
        city: "",
        postalCode: "",
        federalState: "",
        country: "",
      },
    ]);
  };

  const removeBusiness = (index: number) => {
    if (businesses.length <= 1) return;
    setBusinesses(businesses.filter((_, i) => i !== index));
  };

  const updateBusiness = (index: number, field: string, value: any) => {
    setBusinesses((prevBusinesses) => {
      const updatedBusinesses = [...prevBusinesses];
      updatedBusinesses[index] = {
        ...updatedBusinesses[index],
        [field]: value,
      };
      return updatedBusinesses;
    });
  };

  const updateBusinessAddress = (index: number, details: any) => {
    setBusinesses((prevBusinesses) => {
      const updatedBusinesses = [...prevBusinesses];
      updatedBusinesses[index] = {
        ...updatedBusinesses[index],
        street: details.street,
        city: details.city || updatedBusinesses[index].city,
        postalCode: details.postalCode || updatedBusinesses[index].postalCode,
        country: details.country || updatedBusinesses[index].country,
        federalState: details.federalState || updatedBusinesses[index].federalState,
      };
      return updatedBusinesses;
    });
  };

  // DÜZELTME: useEffect dependency uyarısı için disable eklendi
  useEffect(() => {
    if (formData.currentStep !== 1) {
      goToStep(1);
    }
    const count = parseInt(restaurantCount) || 1;
    if (formData.restaurants.length !== count) {
      const newRestaurants = Array.from({ length: count }, (_, index) => {
        return formData.restaurants[index] || {
          restaurantName: "",
          street: "",
          city: "",
          country: "",
          federalState: "",
        };
      });
      updateFormData({ restaurants: newRestaurants });
    }
    // Sonsuz döngüyü önlemek için formData.restaurants dependency array'e eklenmemeli
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantCount, formData.currentStep, goToStep, updateFormData]);

  useEffect(() => {
    if (hasCompletedSignup.current) return;
    hasCompletedSignup.current = true;

    const completeSignupIfNeeded = async () => {
      if (typeof window === "undefined") return;
      const completed = localStorage.getItem("signupCompleted");
      if (completed === "true") return;

      const initialDataRaw = localStorage.getItem("initialRegistrationData");
      if (!initialDataRaw) return;

      let initialData: any = null;
      try {
        initialData = JSON.parse(initialDataRaw);
      } catch {
        return;
      }

      if (!initialData?.email) return;

      try {
        const res = await fetch("/api/auth/complete-signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: initialData.email,
            companyName: initialData.companyName,
            firstName: initialData.firstName,
            lastName: initialData.lastName,
            password: initialData.password,
          }),
        });

        const data = await res.json();
        if (res.ok && data.success) {
          localStorage.setItem("signupCompleted", "true");
          sessionStorage.setItem("userEmail", initialData.email);
        } else {
          console.error("complete-signup failed:", data);
        }
      } catch (error) {
        console.error("complete-signup error:", error);
      }
    };

    completeSignupIfNeeded();
  }, []);

  useEffect(() => {
    if (hasLoadedCompanyInfo.current) return;
    hasLoadedCompanyInfo.current = true;

    const loadCompanyInfo = async () => {
      let userEmail = "";
      if (typeof window !== "undefined") {
        const initialData = localStorage.getItem("initialRegistrationData");
        if (initialData) {
          try { userEmail = JSON.parse(initialData).email || ""; } catch (e) {}
        }
        if (!userEmail) userEmail = sessionStorage.getItem("userEmail") || "";
        if (!userEmail) userEmail = localStorage.getItem("userEmail") || "";
      }

      if (!userEmail) { hasLoadedCompanyInfo.current = false; return; }

      // Önce parsed bilgileri localStorage'dan kontrol et (PDF'den okunan bilgiler)
      let parsedCompanyInfo: any = null;
      if (typeof window !== "undefined") {
        const parsedData = localStorage.getItem("parsedCompanyInfo");
        if (parsedData) {
          try {
            parsedCompanyInfo = JSON.parse(parsedData);
            console.log("✅ Found parsed company info from PDF:", parsedCompanyInfo);
          } catch (e) {
            console.error("Error parsing stored company info:", e);
          }
        }
      }

      try {
        const res = await fetch("/api/erp/get-lead", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: userEmail }),
        });

        const data = await res.json();

        if (data.success && data.lead) {
          const lead = data.lead;
          // Kontrol ettiğimiz alanlar (Yeni isimler eklendi)
          if (lead.company_name || lead.custom_vat_number || lead.custom_tax_id || 
              lead.address_line1 || lead.city || lead.country || lead.mainCompanyAddress || parsedCompanyInfo) {
            
            const companyInfo: any = {};
            
            // Önce parsed bilgileri yükle (PDF'den okunan bilgiler öncelikli)
            if (parsedCompanyInfo) {
              console.log("📄 Loading parsed company info from PDF (PRIORITY)");
              // Parsed bilgiler öncelikli - tüm alanları yükle
              if (parsedCompanyInfo.companyName) companyInfo.companyName = parsedCompanyInfo.companyName;
              if (parsedCompanyInfo.vatIdentificationNumber) companyInfo.vatIdentificationNumber = parsedCompanyInfo.vatIdentificationNumber;
              if (parsedCompanyInfo.taxIdNumber) companyInfo.taxIdNumber = parsedCompanyInfo.taxIdNumber;
              if (parsedCompanyInfo.restaurantCount) companyInfo.restaurantCount = parsedCompanyInfo.restaurantCount;
              if (parsedCompanyInfo.street) companyInfo.street = parsedCompanyInfo.street;
              if (parsedCompanyInfo.city) companyInfo.city = parsedCompanyInfo.city;
              if (parsedCompanyInfo.zipCode) companyInfo.zipCode = parsedCompanyInfo.zipCode;
              if (parsedCompanyInfo.country) companyInfo.country = parsedCompanyInfo.country;
              if (parsedCompanyInfo.federalState) companyInfo.federalState = parsedCompanyInfo.federalState;
              
              console.log("✅ Parsed company info loaded:", companyInfo);
              console.log("📋 Business info from PDF:", {
                businessName: parsedCompanyInfo.businessName,
                ownerDirector: parsedCompanyInfo.ownerDirector,
                ownerEmail: parsedCompanyInfo.ownerEmail,
                ownerTelephone: parsedCompanyInfo.ownerTelephone
              });
            }
            
            // Lead'den gelen bilgileri sadece parsed bilgiler yoksa veya eksikse ekle
            // Parsed bilgiler öncelikli olduğu için, sadece eksik alanları doldur
            if (!companyInfo.companyName && lead.company_name) companyInfo.companyName = lead.company_name;
            if (!companyInfo.vatIdentificationNumber && lead.custom_vat_number) companyInfo.vatIdentificationNumber = lead.custom_vat_number;
            if (!companyInfo.taxIdNumber && lead.custom_tax_id) companyInfo.taxIdNumber = lead.custom_tax_id;
            if (!companyInfo.restaurantCount && lead.custom_restaurant_count) companyInfo.restaurantCount = String(lead.custom_restaurant_count);

            // Adres bilgileri - Sadece parsed bilgiler yoksa Address DocType'ından veya Lead'den yükle
            // Parsed bilgiler öncelikli olduğu için, sadece eksik alanları doldur
            if (!companyInfo.street || !companyInfo.city || !companyInfo.country) {
              // ÖNCE Address DocType'ından kontrol et (Billing type)
              if (lead.mainCompanyAddress) {
                const address = lead.mainCompanyAddress;
                console.log("📍 Loading address from Address DocType:", address.name);
                
                // Address DocType'ından bilgileri yükle (sadece eksik alanlar)
                if (!companyInfo.street && address.address_line1) companyInfo.street = address.address_line1;
                if (!companyInfo.city && address.city) companyInfo.city = address.city;
                if (!companyInfo.zipCode && address.pincode) companyInfo.zipCode = address.pincode;
                if (!companyInfo.federalState && address.state) companyInfo.federalState = address.state;
                if (!companyInfo.country && address.country) companyInfo.country = address.country;
                
                console.log("✅ Address loaded from Address DocType (missing fields only)");
              }
              // Eğer Address DocType'ında yoksa, Lead'in kendi address field'larına bak
              else {
                const addressLine1 = lead.address_line1 || lead.custom_address_line1;
                const addressLine2 = lead.address_line2;
                
                // Eğer structured adres bilgileri varsa, onları kullan (sadece eksik alanlar)
                if (addressLine1 || addressLine2 || lead.city || lead.country) {
                  if (!companyInfo.street && (addressLine1 || addressLine2)) {
                    const streetParts = [];
                    if (addressLine1) streetParts.push(addressLine1);
                    if (addressLine2) streetParts.push(addressLine2);
                    companyInfo.street = streetParts.join(" ");
                  }
                  if (!companyInfo.city && lead.city) companyInfo.city = lead.city;
                  if (!companyInfo.zipCode && (lead.pincode || lead.custom_pincode)) {
                    companyInfo.zipCode = lead.pincode || lead.custom_pincode;
                  }
                  if (!companyInfo.federalState && (lead.state || lead.custom_state)) {
                    companyInfo.federalState = lead.state || lead.custom_state;
                  }
                  if (!companyInfo.country && lead.country) companyInfo.country = lead.country;
                }
              }
            }

            updateFormData({ companyInfo: companyInfo });
          }

          // Lead'den businesses yükle, ama PDF'den okunan bilgiler öncelikli
          if (lead.businesses && Array.isArray(lead.businesses) && lead.businesses.length > 0) {
            // Eğer parsedCompanyInfo varsa, PDF bilgilerini lead.businesses ile merge et
            if (parsedCompanyInfo && (parsedCompanyInfo.ownerDirector || parsedCompanyInfo.businessName)) {
              const mergedBusinesses = lead.businesses.map((biz: any, index: number) => {
                if (index === 0) {
                  // İlk business için PDF bilgileri öncelikli
                  return {
                    ...biz,
                    businessName: parsedCompanyInfo.businessName || biz.businessName || "",
                    ownerDirector: parsedCompanyInfo.ownerDirector || biz.ownerDirector || "",
                    ownerEmail: parsedCompanyInfo.ownerEmail || biz.ownerEmail || "",
                    ownerTelephone: parsedCompanyInfo.ownerTelephone || biz.ownerTelephone || "",
                    street: parsedCompanyInfo.street || biz.street || "",
                    city: parsedCompanyInfo.city || biz.city || "",
                    postalCode: parsedCompanyInfo.zipCode || biz.postalCode || "",
                    country: parsedCompanyInfo.country || biz.country || "",
                    federalState: parsedCompanyInfo.federalState || biz.federalState || "",
                  };
                }
                return biz;
              });
              setBusinesses(mergedBusinesses);
            } else {
              setBusinesses(lead.businesses);
            }
          } else if (parsedCompanyInfo && (parsedCompanyInfo.ownerDirector || parsedCompanyInfo.businessName)) {
            // Lead'de businesses yoksa ama parsedCompanyInfo varsa, yeni business oluştur
            setBusinesses([{
              businessName: parsedCompanyInfo.businessName || "",
              ownerDirector: parsedCompanyInfo.ownerDirector || "",
              ownerTelephone: parsedCompanyInfo.ownerTelephone || "",
              ownerEmail: parsedCompanyInfo.ownerEmail || "",
              differentContact: false,
              contactPerson: "",
              contactTelephone: "",
              contactEmail: "",
              street: parsedCompanyInfo.street || "",
              city: parsedCompanyInfo.city || "",
              postalCode: parsedCompanyInfo.zipCode || "",
              federalState: parsedCompanyInfo.federalState || "",
              country: parsedCompanyInfo.country || "",
            }]);
          }
        }
      } catch (error) {
        console.error("Error loading company info:", error);
        hasLoadedCompanyInfo.current = false;
      }
    };

    loadCompanyInfo();
  }, [updateFormData]);

  const handleCompanyInfoChange = (field: keyof typeof formData.companyInfo, value: string) => {
    updateFormData({
      companyInfo: {
        ...formData.companyInfo,
        [field]: value,
      },
    });
  };

  const handleAddressSelect = (
    address: string,
    details?: { street: string; city: string; country: string; postalCode: string; federalState?: string }
  ) => {
    if (details) {
      const streetValue = details.street || address;
      lastSelectedStreetRef.current = streetValue;
      
      const updates: any = {
        street: streetValue
      };

      if (details.city) updates.city = details.city;
      if (details.country) updates.country = details.country;
      if (details.postalCode) updates.zipCode = details.postalCode;
      if (details.federalState) updates.federalState = details.federalState;

      updateFormData({
        companyInfo: {
          ...formData.companyInfo,
          ...updates
        }
      });

    } else {
      lastSelectedStreetRef.current = address;
      handleCompanyInfoChange("street", address);
    }
  };

  const handleSubmit = async () => {
    if (!formData.companyInfo.companyName || !formData.companyInfo.vatIdentificationNumber) {
      alert("Please fill in required fields");
      return;
    }

    let userEmail = "";
    if (typeof window !== "undefined") {
      const initialData = localStorage.getItem("initialRegistrationData");
      if (initialData) {
        try {
          const parsed = JSON.parse(initialData);
          userEmail = parsed.email || "";
        } catch (error) {
          console.error("Error parsing initial registration data:", error);
        }
      }
      if (!userEmail) {
        const sessionEmail = sessionStorage.getItem("userEmail");
        if (sessionEmail) {
          userEmail = sessionEmail;
        }
      }
      if (!userEmail) {
        const localEmail = localStorage.getItem("userEmail");
        if (localEmail) userEmail = localEmail;
      }
    }

    if (!userEmail) {
      alert("User email not found. Please login or complete the initial registration first.");
      return;
    }

    try {
      const cleanCompanyInfo: any = {};
      if (formData.companyInfo.companyName) cleanCompanyInfo.companyName = formData.companyInfo.companyName;
      if (formData.companyInfo.restaurantCount) cleanCompanyInfo.restaurantCount = formData.companyInfo.restaurantCount;
      if (formData.companyInfo.taxIdNumber) cleanCompanyInfo.taxIdNumber = formData.companyInfo.taxIdNumber;
      if (formData.companyInfo.vatIdentificationNumber) cleanCompanyInfo.vatIdentificationNumber = formData.companyInfo.vatIdentificationNumber;

      let streetForLead =
        (lastSelectedStreetRef.current || formData.companyInfo.street || "").trim();
      if (!streetForLead) {
        const streetParts: string[] = [];
        if (formData.companyInfo.city) streetParts.push(formData.companyInfo.city);
        if (formData.companyInfo.zipCode) streetParts.push(formData.companyInfo.zipCode);
        if (formData.companyInfo.country) streetParts.push(formData.companyInfo.country);
        streetForLead = streetParts.join(" ").trim();
      }
      if (streetForLead) cleanCompanyInfo.street = streetForLead;

      if (formData.companyInfo.city) cleanCompanyInfo.city = formData.companyInfo.city;
      if (formData.companyInfo.country) cleanCompanyInfo.country = formData.companyInfo.country;
      if (formData.companyInfo.federalState) cleanCompanyInfo.federalState = formData.companyInfo.federalState;
      if (formData.companyInfo.zipCode) cleanCompanyInfo.zipCode = formData.companyInfo.zipCode;
      
      // Registration status'u "Completed" olarak işaretle (son sayfa)
      const res = await fetch("/api/erp/update-lead", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: userEmail,
          companyInfo: cleanCompanyInfo,
          businesses: businesses,
          documents: {
            isCompleted: true // Registration tamamlandı
          }
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        alert(data.error || "Failed to update lead in ERP. Please try again.");
        return;
      }
      
      // Company info'yu localStorage'a kaydet (validation için)
      try {
        localStorage.setItem("companyInfo", JSON.stringify(cleanCompanyInfo));
        console.log("✅ Company info saved to localStorage:", cleanCompanyInfo);
      } catch (e) {
        console.error("❌ Error saving companyInfo to localStorage:", e);
      }
      
      // Registration tamamlandı, dashboard'a yönlendir
      alert("Registration completed successfully! Redirecting to dashboard...");
      router.push("/dashboard");
      
    } catch (error) {
      alert("Failed to update lead in ERP. Please try again.");
      return;
    }
  };

  const handleBack = () => {
    goToStep(3); // Üçüncü sayfa: Payment Information
    router.push("/register/payment-information");
  };

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <ProgressBar />
        
        <div className="mb-8 mt-8 ml-10">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Company Information</h1>
          <p className="text-sm text-gray-600">Please provide your company details to get started</p>
        </div>
        
        <Card className="border-gray-200 shadow-lg">
          <CardContent className="p-8">
            <form className="space-y-8" onSubmit={(e) => e.preventDefault()}>
              <div className="space-y-6">
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="companyName" className="text-sm font-semibold text-gray-700">
                      Company Name <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="companyName"
                      placeholder="Enter Company Name"
                      value={formData.companyInfo.companyName}
                      onChange={(e) => handleCompanyInfoChange("companyName", e.target.value)}
                      className="w-full"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="vatId" className="text-sm font-semibold text-gray-700">
                      VAT Identification Number <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="vatId"
                      placeholder="e.g. DE123456789"
                      value={formData.companyInfo.vatIdentificationNumber}
                      onChange={(e) => handleCompanyInfoChange("vatIdentificationNumber", e.target.value)}
                      className="w-full"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="taxIdNumber" className="text-sm font-semibold text-gray-700">
                      Tax ID Number <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="taxIdNumber"
                      placeholder="Enter Tax ID Number"
                      value={formData.companyInfo.taxIdNumber}
                      onChange={(e) => handleCompanyInfoChange("taxIdNumber", e.target.value)}
                      className="w-full"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="companyStreet" className="text-sm font-semibold text-gray-700">
                    Street and House number
                  </Label>
                  <AddressAutocomplete
                    value={formData.companyInfo.street}
                    onChange={(address, details) => {
                      if (details) {
                        handleAddressSelect(address, details);
                      } else {
                        handleCompanyInfoChange("street", address);
                      }
                    }}
                    placeholder="Enter Location"
                    className="w-full"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="companyCity" className="text-sm font-semibold text-gray-700">
                      City
                    </Label>
                    <AddressAutocomplete
                      value={formData.companyInfo.city}
                      onChange={(address) => handleCompanyInfoChange("city", address)}
                      placeholder="Enter City"
                      className="w-full"
                      fieldType="city"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="companyCountry" className="text-sm font-semibold text-gray-700">
                      Country <span className="text-red-500">*</span>
                    </Label>
                    <AddressAutocomplete
                      value={formData.companyInfo.country}
                      onChange={(address) => {
                        handleCompanyInfoChange("country", address);
                        handleCompanyInfoChange("federalState", "");
                      }}
                      placeholder="Enter Country"
                      className="w-full"
                      fieldType="country"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="companyState" className="text-sm font-semibold text-gray-700">
                      Federal State <span className="text-red-500">*</span>
                    </Label>
                    <AddressAutocomplete
                      value={formData.companyInfo.federalState}
                      onChange={(address) => handleCompanyInfoChange("federalState", address)}
                      placeholder="Enter Federal State"
                      className="w-full"
                      fieldType="state"
                      countryRestriction={formData.companyInfo.country}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="companyPostalCode" className="text-sm font-semibold text-gray-700">
                      Postal code
                    </Label>
                    <AddressAutocomplete
                      value={formData.companyInfo.zipCode}
                      onChange={(address) => handleCompanyInfoChange("zipCode", address)}
                      placeholder="Enter Postal Code"
                      className="w-full"
                      fieldType="postalCode"
                      countryRestriction={formData.companyInfo.country}
                    />
                  </div>
                </div>
                </div>

              {businesses.length > 0 && businesses.map((business, index) => (
                <div key={index} className={`space-y-6 ${index === 0 ? 'border-t pt-6' : 'mt-8'}`}>
                  {index > 0 && (
                     <Card className="border-gray-200 shadow-md">
                      <CardContent className="pt-6 relative">
                         <button
                            type="button"
                            onClick={() => removeBusiness(index)}
                              className="absolute top-4 right-4 text-red-500 hover:text-red-600"
                              aria-label="Delete business"
                            >
                            <Trash2 className="w-5 h-5" />
                          </button>
                           <div className="space-y-6">
                            <h2 className="text-lg font-semibold text-gray-800">Business {index + 1} Information</h2>
                            {renderBusinessForm(index, business, updateBusiness, updateBusinessAddress, companyMainIso)}
                           </div>
                      </CardContent>
                    </Card>
                  )}

                  {index === 0 && (
                    <div className="space-y-6">
                      <h2 className="text-lg font-semibold text-gray-800">Business 1 Information</h2>
                      {renderBusinessForm(index, business, updateBusiness, updateBusinessAddress, companyMainIso)}
                    </div>
                  )}
                </div>
              ))}
            </form>
          </CardContent>
        </Card>

        <div className="mt-8 space-y-4">
          <div className="flex justify-center">
            <button
              type="button"
              onClick={addBusiness}
              className="inline-flex flex-col items-center justify-center px-12 py-4 border-2 border-dashed border-gray-300 rounded-md hover:border-gray-400 transition-colors"
            >
              <span className="mb-2 flex items-center justify-center w-8 h-8 rounded-full bg-[#111827]">
                <Plus className="w-4 h-4 text-white" strokeWidth={3} />
              </span>
              <span className="text-sm font-semibold text-gray-700">Add Business</span>
            </button>
          </div>

          <div className="flex justify-center gap-4 pt-4">
            <Button
              type="button"
              onClick={handleBack}
              variant="outline"
              className="px-8 h-[50px] text-base font-semibold border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              Back
            </Button>
            <RegisterButton type="button" onClick={handleSubmit}>
              Submit
            </RegisterButton>
          </div>
        </div>
      </div>
    </div>
  );
}

// Yardımcı render fonksiyonu
function renderBusinessForm(
  index: number, 
  business: any, 
  updateBusiness: any, 
  updateBusinessAddress: any,
  defaultCompanyIso: Country 
) {
  const currentCountryIso = getCountryIsoCode(business.country) || defaultCompanyIso;

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor={`businessName-${index}`} className="text-sm font-semibold text-gray-700">
          Business Name
        </Label>
        <Input
          id={`businessName-${index}`}
          placeholder="Enter Restaurant Name"
          value={business.businessName}
          onChange={(e) => updateBusiness(index, "businessName", e.target.value)}
          className="w-full"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor={`ownerDirector-${index}`} className="text-sm font-semibold text-gray-700">
            Owner/Managing Director <span className="text-red-500">*</span>
          </Label>
          <Input
            id={`ownerDirector-${index}`}
            placeholder="Enter Director"
            value={business.ownerDirector}
            onChange={(e) => updateBusiness(index, "ownerDirector", e.target.value)}
            className="w-full"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={`ownerTelephone-${index}`} className="text-sm font-semibold text-gray-700">
            Telephone number <span className="text-red-500">*</span>
          </Label>
          <PhoneInput
            international
            key={currentCountryIso} 
            defaultCountry={currentCountryIso}
            value={business.ownerTelephone}
            onChange={(value) => updateBusiness(index, "ownerTelephone", value || "")}
            className="phone-input"
            numberInputProps={{
              id: `ownerTelephone-${index}`,
              name: `ownerTelephone-${index}`,
              required: true,
            }}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`ownerEmail-${index}`} className="text-sm font-semibold text-gray-700">
          E-mail address <span className="text-red-500">*</span>
        </Label>
        <Input
          id={`ownerEmail-${index}`}
          type="email"
          placeholder="Enter E-mail address"
          value={business.ownerEmail}
          onChange={(e) => updateBusiness(index, "ownerEmail", e.target.value)}
          className="w-full"
          required
        />
      </div>

      <div className="flex items-start space-x-2">
        <Checkbox
          id={`differentContact-${index}`}
          checked={business.differentContact}
          onCheckedChange={(checked) => updateBusiness(index, "differentContact", checked === true)}
          className="mt-1"
        />
        <Label
          htmlFor={`differentContact-${index}`}
          className="text-sm font-normal text-gray-700 cursor-pointer leading-relaxed"
        >
          Different contact details of the contact person
        </Label>
      </div>

      {business.differentContact && (
        <div className="space-y-6 pl-6 border-l-2 border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor={`contactPerson-${index}`} className="text-sm font-semibold text-gray-700">
                Contact Person <span className="text-red-500">*</span>
              </Label>
              <Input
                id={`contactPerson-${index}`}
                placeholder="Enter Contact Person"
                value={business.contactPerson}
                onChange={(e) => updateBusiness(index, "contactPerson", e.target.value)}
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={`contactTelephone-${index}`} className="text-sm font-semibold text-gray-700">
                Telephone number <span className="text-red-500">*</span>
              </Label>
              <PhoneInput
                international
                key={currentCountryIso}
                defaultCountry={currentCountryIso}
                value={business.contactTelephone}
                onChange={(value) => updateBusiness(index, "contactTelephone", value || "")}
                className="phone-input"
                numberInputProps={{
                  id: `contactTelephone-${index}`,
                  name: `contactTelephone-${index}`,
                  required: true,
                }}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`contactEmail-${index}`} className="text-sm font-semibold text-gray-700">
              E-mail address <span className="text-red-500">*</span>
            </Label>
            <Input
              id={`contactEmail-${index}`}
              type="email"
              placeholder="Enter E-mail address"
              value={business.contactEmail}
              onChange={(e) => updateBusiness(index, "contactEmail", e.target.value)}
              className="w-full"
              required
            />
          </div>
        </div>
      )}

      <div className="space-y-6 border-t pt-6">
        <h2 className="text-lg font-semibold text-gray-800">Business {index + 1} Address Information</h2>

        <div className="space-y-2">
          <Label htmlFor={`businessStreet-${index}`} className="text-sm font-semibold text-gray-700">
            Street and House number
          </Label>
          <AddressAutocomplete
            value={business.street}
            onChange={(address, details) => {
              if (details) {
                updateBusinessAddress(index, {
                    street: details.street || address,
                    city: details.city,
                    postalCode: details.postalCode,
                    country: details.country,
                    federalState: details.federalState
                });
              } else {
                updateBusiness(index, "street", address);
              }
            }}
            placeholder="Enter Location"
            className="w-full"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor={`businessCity-${index}`} className="text-sm font-semibold text-gray-700">
              City
            </Label>
            <AddressAutocomplete
              value={business.city}
              onChange={(address) => updateBusiness(index, "city", address)}
              placeholder="Enter City"
              className="w-full"
              fieldType="city"
              countryRestriction={business.country}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`businessPostalCode-${index}`} className="text-sm font-semibold text-gray-700">
              Postal code
            </Label>
            <AddressAutocomplete
              value={business.postalCode}
              onChange={(address) => updateBusiness(index, "postalCode", address)}
              placeholder="Enter Postal Code"
              className="w-full"
              fieldType="postalCode"
              countryRestriction={business.country}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor={`businessState-${index}`} className="text-sm font-semibold text-gray-700">
              Federal State <span className="text-red-500">*</span>
            </Label>
            <AddressAutocomplete
              value={business.federalState}
              onChange={(address) => updateBusiness(index, "federalState", address)}
              placeholder="Enter State"
              className="w-full"
              fieldType="state"
              countryRestriction={business.country}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`businessCountry-${index}`} className="text-sm font-semibold text-gray-700">
              Country <span className="text-red-500">*</span>
            </Label>
            <AddressAutocomplete
              value={business.country}
              onChange={(address) => {
                updateBusiness(index, "country", address);
                updateBusiness(index, "federalState", "");
              }}
              placeholder="Enter Country"
              className="w-full"
              fieldType="country"
            />
          </div>
        </div>
      </div>
    </>
  );
}