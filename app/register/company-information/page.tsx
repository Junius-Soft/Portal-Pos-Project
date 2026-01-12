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
import { Trash2, Plus } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import PhoneInput, { Country } from "react-phone-number-input";
import "react-phone-number-input/style.css";

// --- Ülke Kodu Kütüphaneleri ---
import countries from "i18n-iso-countries";
import en from "i18n-iso-countries/langs/en.json";
import tr from "i18n-iso-countries/langs/tr.json";
import de from "i18n-iso-countries/langs/de.json";

// Dilleri tanıtıyoruz
countries.registerLocale(en);
countries.registerLocale(tr);
countries.registerLocale(de);

// Yardımcı Fonksiyon: Ülke isminden ISO Kodu (Alpha-2) bulur
// Örnek: "Turkey" -> "TR", "Almanya" -> "DE"
// Bulamazsa undefined döner (Böylece fallback mantığı kurabiliriz)
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
  const lastSelectedStreetRef = useRef<string | null>(null);
  
  // Ana Şirketin Ülke Kodunu hesapla (Varsayılan: Almanya 'DE' veya İngiltere 'GB')
  // Bu kod, yeni eklenen Business'larda varsayılan telefon kodu olacak.
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
        country: "", // Boş geldiğinde companyMainIso kullanılacak
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
  }, [restaurantCount, formData.currentStep, formData.restaurants.length, goToStep, updateFormData]);

  useEffect(() => {
    if (hasLoadedCompanyInfo.current) {
      return;
    }
    hasLoadedCompanyInfo.current = true;

    const loadCompanyInfo = async () => {
      let userEmail = "";
      if (typeof window !== "undefined") {
        const initialData = localStorage.getItem("initialRegistrationData");
        if (initialData) {
          try {
            const parsed = JSON.parse(initialData);
            userEmail = parsed.email || "";
          } catch (error) {
            console.error("Error parsing initial data:", error);
          }
        }
        if (!userEmail) {
          const sessionEmail = sessionStorage.getItem("userEmail");
          if (sessionEmail) {
            userEmail = sessionEmail;
          }
        }
      }

      if (!userEmail) {
        hasLoadedCompanyInfo.current = false;
        return;
      }

      try {
        const res = await fetch("/api/erp/get-lead", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email: userEmail }),
        });

        const data = await res.json();

        if (data.success && data.lead) {
          const lead = data.lead;
          if (lead.company_name || lead.custom_vat_identification_number || lead.custom_tax_id_number || 
              lead.address_line1 || lead.city || lead.country) {
            const companyInfo: any = {};
            
            if (lead.company_name) companyInfo.companyName = lead.company_name;
            if (lead.custom_vat_identification_number) companyInfo.vatIdentificationNumber = lead.custom_vat_identification_number;
            if (lead.custom_custom_tax_id_number) {
              companyInfo.taxIdNumber = lead.custom_custom_tax_id_number;
            } else if (lead.custom_tax_id_number) {
              companyInfo.taxIdNumber = lead.custom_tax_id_number;
            }
            const addressLine1 = lead.address_line1 || lead.custom_address_line1;
            const addressLine2 = lead.address_line2;
            if (addressLine1 || addressLine2) {
              const streetParts = [];
              if (addressLine1) streetParts.push(addressLine1);
              if (addressLine2) streetParts.push(addressLine2);
              companyInfo.street = streetParts.join(" ");
            }
            if (lead.city) companyInfo.city = lead.city;
            if (lead.pincode || lead.custom_pincode) {
              companyInfo.zipCode = lead.pincode || lead.custom_pincode;
            }
            if (lead.state || lead.custom_state) {
              companyInfo.federalState = lead.state || lead.custom_state;
            }
            if (lead.country) companyInfo.country = lead.country;

            updateFormData({
              companyInfo: companyInfo,
            });
          }

          if (lead.businesses && Array.isArray(lead.businesses) && lead.businesses.length > 0) {
            setBusinesses(lead.businesses);
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

  const handleNext = async () => {
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
      
      const res = await fetch("/api/erp/update-lead", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: userEmail,
          companyInfo: cleanCompanyInfo,
          businesses: businesses,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        alert(data.error || "Failed to update lead in ERP. Please try again.");
        return;
      }
      
    } catch (error) {
      alert("Failed to update lead in ERP. Please try again.");
      return;
    }

    goToStep(2);
    router.push("/register/services");
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

          <div className="flex justify-center pt-4">
            <RegisterButton type="button" onClick={handleNext}>
              Next
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
  defaultCompanyIso: Country // Yeni Prop: Şirket Ülkesi (Fallback)
) {
  // 1. İşletme ülkesi seçiliyse onu kullan
  // 2. Seçili değilse Ana Şirket Ülkesini kullan
  // 3. O da yoksa Almanya (DE) kullan
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
          {/* KEY ÖZELLİĞİ EKLENDİ: 
             key={currentCountryIso} sayesinde ülke kodu her değiştiğinde 
             bileşen yeniden render olur ve yeni bayrak anında gelir.
          */}
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
              {/* Contact Person için de aynı dinamik Key ve DefaultCountry uygulandı */}
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

      {/* --- Business Address Section --- */}
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