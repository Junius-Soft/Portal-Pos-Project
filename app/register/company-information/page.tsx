"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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

export default function CompanyInformationPage() {
  const router = useRouter();
  const { formData, updateFormData, goToStep } = useRegistration();
  const [restaurantCount, setRestaurantCount] = useState(
    formData.companyInfo.restaurantCount || "1"
  );
  const hasLoadedCompanyInfo = useRef(false);
  
  // Business Information state - Array to support multiple businesses
  const [businesses, setBusinesses] = useState([
    {
      businessName: "",
      ownerDirector: "",
      ownerTelephone: "",
      ownerTelephoneCode: "+1",
      ownerEmail: "",
      differentContact: false,
      contactPerson: "",
      contactTelephone: "",
      contactTelephoneCode: "+1",
      contactEmail: "",
      // Address Information
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
        ownerTelephoneCode: "+1",
        ownerEmail: "",
        differentContact: false,
        contactPerson: "",
        contactTelephone: "",
        contactTelephoneCode: "+1",
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
    // En az 1 business kalsın
    if (businesses.length <= 1) return;
    setBusinesses(businesses.filter((_, i) => i !== index));
  };

  const updateBusiness = (index: number, field: string, value: any) => {
    const updatedBusinesses = [...businesses];
    updatedBusinesses[index] = {
      ...updatedBusinesses[index],
      [field]: value,
    };
    setBusinesses(updatedBusinesses);
  };


  useEffect(() => {
    // Ensure we're on step 1
    if (formData.currentStep !== 1) {
      goToStep(1);
    }

    // Initialize restaurants array based on restaurant count
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantCount, formData.currentStep, formData.restaurants.length, goToStep, updateFormData]);

  // Load company information separately - only once
  useEffect(() => {
    // Sadece bir kez yükle
    if (hasLoadedCompanyInfo.current) {
      return;
    }
    hasLoadedCompanyInfo.current = true;

    const loadCompanyInfo = async () => {
      // Get user email
      let userEmail = "";
      if (typeof window !== "undefined") {
        const sessionEmail = sessionStorage.getItem("userEmail");
        if (sessionEmail) {
          userEmail = sessionEmail;
        } else {
          const initialData = localStorage.getItem("initialRegistrationData");
          if (initialData) {
            try {
              const parsed = JSON.parse(initialData);
              userEmail = parsed.email || "";
            } catch (error) {
              console.error("Error parsing initial data:", error);
            }
          }
        }
      }

      if (!userEmail) {
        hasLoadedCompanyInfo.current = false; // Email yoksa tekrar deneyebilmek için
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
          
          // Company bilgilerini form'a yükle
          if (lead.company_name || lead.custom_vat_identification_number || lead.custom_tax_id_number || 
              lead.address_line1 || lead.city || lead.country) {
            const companyInfo: any = {};
            
            if (lead.company_name) companyInfo.companyName = lead.company_name;
            if (lead.custom_vat_identification_number) companyInfo.vatIdentificationNumber = lead.custom_vat_identification_number;
            // Not: ERPNext'te field adı custom_custom_tax_id_number (double custom prefix)
            if (lead.custom_custom_tax_id_number) {
              companyInfo.taxIdNumber = lead.custom_custom_tax_id_number;
            } else if (lead.custom_tax_id_number) {
              // Fallback: Eğer eski field adı varsa onu da kontrol et
              companyInfo.taxIdNumber = lead.custom_tax_id_number;
            }
            // address_line1 ve address_line2'yi birleştir (eğer ikisi de varsa)
            if (lead.address_line1 || lead.address_line2) {
              const streetParts = [];
              if (lead.address_line1) streetParts.push(lead.address_line1);
              if (lead.address_line2) streetParts.push(lead.address_line2);
              companyInfo.street = streetParts.join(" ");
            }
            if (lead.city) companyInfo.city = lead.city;
            if (lead.pincode) companyInfo.zipCode = lead.pincode;
            if (lead.state) companyInfo.federalState = lead.state;
            if (lead.country) companyInfo.country = lead.country;

            // Form data'yı güncelle - sadece yeni değerleri gönder
            // Bu fonksiyon sadece bir kez çalışacağı için formData.companyInfo genellikle boş olacak
            updateFormData({
              companyInfo: companyInfo,
            });
          }

          // Businesses array'ini yükle (get-lead endpoint'inde zaten parse edilmiş)
          if (lead.businesses && Array.isArray(lead.businesses) && lead.businesses.length > 0) {
            setBusinesses(lead.businesses);
          }
        }
      } catch (error) {
        console.error("Error loading company info:", error);
        hasLoadedCompanyInfo.current = false; // Hata durumunda tekrar deneyebilmek için
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
    details?: { street: string; city: string; country: string; postalCode: string }
  ) => {
    if (details) {
      handleCompanyInfoChange("street", details.street || address);
      if (details.city) handleCompanyInfoChange("city", details.city);
      if (details.country) handleCompanyInfoChange("country", details.country);
    } else {
      handleCompanyInfoChange("street", address);
    }
  };

  const handleRestaurantAddressSelect = (
    index: number,
    address: string,
    details?: { street: string; city: string; country: string; postalCode: string }
  ) => {
    if (details) {
      handleRestaurantChange(index, "street", details.street || address);
      if (details.city) handleRestaurantChange(index, "city", details.city);
      if (details.country) handleRestaurantChange(index, "country", details.country);
    } else {
      handleRestaurantChange(index, "street", address);
    }
  };

  const handleRestaurantChange = (
    index: number,
    field: keyof (typeof formData.restaurants)[0],
    value: string
  ) => {
    const updatedRestaurants = [...formData.restaurants];
    updatedRestaurants[index] = {
      ...updatedRestaurants[index],
      [field]: value,
    };
    updateFormData({ restaurants: updatedRestaurants });
  };

  const handleRestaurantCountChange = (value: string) => {
    setRestaurantCount(value);
    handleCompanyInfoChange("restaurantCount", value);
    const count = parseInt(value) || 1;
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
  };

  const handleNext = async () => {
    // Basic validation - can be enhanced
    if (!formData.companyInfo.companyName || !formData.companyInfo.vatIdentificationNumber) {
      alert("Please fill in required fields");
      return;
    }

    // Get user email from sessionStorage (if logged in) or localStorage (during registration)
    let userEmail = "";
    if (typeof window !== "undefined") {
      // Önce sessionStorage'dan kontrol et (login olmuş kullanıcılar için)
      const sessionEmail = sessionStorage.getItem("userEmail");
      if (sessionEmail) {
        userEmail = sessionEmail;
      } else {
        // SessionStorage'da yoksa, localStorage'dan kontrol et (registration flow sırasında)
        const initialData = localStorage.getItem("initialRegistrationData");
        if (initialData) {
          try {
            const parsed = JSON.parse(initialData);
            userEmail = parsed.email || "";
          } catch (error) {
            console.error("Error parsing initial registration data:", error);
          }
        }
      }
    }

    if (!userEmail) {
      alert("User email not found. Please login or complete the initial registration first.");
      return;
    }

    // Update Lead in ERPNext (create if not exists)
    try {
      console.log("Sending to API - companyInfo:", JSON.stringify(formData.companyInfo, null, 2));
      console.log("taxIdNumber value:", formData.companyInfo.taxIdNumber);
      
      const res = await fetch("/api/erp/update-lead", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: userEmail,
          companyInfo: formData.companyInfo,
          businesses: businesses,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        alert(data.error || "Failed to update lead in ERP. Please try again.");
        return;
      }

      console.log("Lead updated successfully:", data.lead);
    } catch (error) {
      console.error("Lead update failed:", error);
      alert("Failed to update lead in ERP. Please try again.");
      return;
    }

    // Company information kaydedildikten sonra her zaman bir sonraki adıma geç
    // Dashboard yönlendirmesini, tüm registration adımları tamamlandıktan sonra yapacağız.
    goToStep(2);
    router.push("/register/services");
  };

  // Function to get country flag emoji based on country code
  function getCountryFlag(countryCode: string): string {
    const flagMap: Record<string, string> = {
      "+44": "🇬🇧", // United Kingdom
      "+1": "🇺🇸", // United States
      "+90": "🇹🇷", // Turkey
      "+49": "🇩🇪", // Germany
    };
    return flagMap[countryCode] || "🇬🇧";
  }

  const countries = ["Germany", "Turkey", "United Kingdom", "United States"];
  const states: Record<string, string[]> = {
    Germany: ["Bavaria", "Berlin", "Hamburg", "North Rhine-Westphalia"],
    Turkey: ["Istanbul", "Ankara", "Izmir", "Antalya"],
    "United Kingdom": ["England", "Scotland", "Wales", "Northern Ireland"],
    "United States": ["California", "New York", "Texas", "Florida"],
  };

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Progress Bar */}
        <ProgressBar />
        
        {/* Section Title - Outside Card */}
        <div className="mb-8 mt-8 ml-10">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Company Information</h1>
          <p className="text-sm text-gray-600">Please provide your company details to get started</p>
        </div>
        
        <Card className="border-gray-200 shadow-lg">
          <CardContent className="p-8">
            <form className="space-y-8" onSubmit={(e) => e.preventDefault()}>
              {/* Company Details Section */}
              <div className="space-y-6">
                

                {/* First Row: Company Name and Restaurant Count */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Company Name */}
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

                  {/* VAT Identification Number */}
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

                {/* Second Row: Tax ID Number and VAT Identification Number */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  
{/* Tax ID Number */}
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

                {/* Company Address */}
                {/* Street and House number - Full width */}
                <div className="space-y-2">
                  <Label htmlFor="companyStreet" className="text-sm font-semibold text-gray-700">
                    Street and House number
                  </Label>
                  <AddressAutocomplete
                    value={formData.companyInfo.street}
                    onChange={handleAddressSelect}
                    placeholder="Enter Location"
                    className="w-full"
                    required
                  />
                </div>

                {/* City and Country - Side by side */}
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
                        handleCompanyInfoChange("federalState", ""); // Reset state when country changes
                      }}
                      placeholder="Enter Country"
                      className="w-full"
                      fieldType="country"
                      required
                    />
                  </div>
                </div>

                {/* Federal State and Postal Code - Side by side */}
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

              {/* Business 1 - Inside main card */}
              {businesses.length > 0 && businesses[0] && (
                <div className="space-y-6 border-t pt-6">
                  <h2 className="text-lg font-semibold text-gray-800">Business 1 Information</h2>

                  {/* Business Name */}
                  <div className="space-y-2">
                    <Label htmlFor="businessName-0" className="text-sm font-semibold text-gray-700">
                      Business Name
                    </Label>
                    <Input
                      id="businessName-0"
                      placeholder="Enter Restaurant Name"
                      value={businesses[0].businessName}
                      onChange={(e) => updateBusiness(0, "businessName", e.target.value)}
                      className="w-full"
                    />
                  </div>

                  {/* Owner/Managing Director and Telephone */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="ownerDirector-0" className="text-sm font-semibold text-gray-700">
                        Owner/Managing Director <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="ownerDirector-0"
                        placeholder="Enter Director"
                        value={businesses[0].ownerDirector}
                        onChange={(e) => updateBusiness(0, "ownerDirector", e.target.value)}
                        className="w-full"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="ownerTelephone-0" className="text-sm font-semibold text-gray-700">
                        Telephone number <span className="text-red-500">*</span>
                      </Label>
                      <div className="flex gap-2">
                        <div className="flex items-center gap-1 px-3 border border-gray-300 rounded-md bg-white">
                          <span className="text-xl">{getCountryFlag(businesses[0].ownerTelephoneCode)}</span>
                          <select
                            className="border-0 outline-none bg-transparent text-sm"
                            value={businesses[0].ownerTelephoneCode}
                            onChange={(e) => updateBusiness(0, "ownerTelephoneCode", e.target.value)}
                          >
                            <option value="+44">+44</option>
                            <option value="+1">+1</option>
                            <option value="+90">+90</option>
                            <option value="+49">+49</option>
                          </select>
                        </div>
                        <Input
                          id="ownerTelephone-0"
                          type="tel"
                          placeholder="123 456 67 87"
                          value={businesses[0].ownerTelephone}
                          onChange={(e) => updateBusiness(0, "ownerTelephone", e.target.value)}
                          required
                          className="flex-1"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Owner E-mail */}
                  <div className="space-y-2">
                    <Label htmlFor="ownerEmail-0" className="text-sm font-semibold text-gray-700">
                      E-mail address <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="ownerEmail-0"
                      type="email"
                      placeholder="Enter E-mail address"
                      value={businesses[0].ownerEmail}
                      onChange={(e) => updateBusiness(0, "ownerEmail", e.target.value)}
                      className="w-full"
                      required
                    />
                  </div>

                  {/* Contact Person Checkbox */}
                  <div className="flex items-start space-x-2">
                    <Checkbox
                      id="differentContact-0"
                      checked={businesses[0].differentContact}
                      onCheckedChange={(checked) => updateBusiness(0, "differentContact", checked === true)}
                      className="mt-1"
                    />
                    <Label
                      htmlFor="differentContact-0"
                      className="text-sm font-normal text-gray-700 cursor-pointer leading-relaxed"
                    >
                      Different contact details of the contact person
                    </Label>
                  </div>

                  {/* Contact Person Fields - Conditional */}
                  {businesses[0].differentContact && (
                    <div className="space-y-6 pl-6 border-l-2 border-gray-200">
                      {/* Contact Person and Telephone */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="contactPerson-0" className="text-sm font-semibold text-gray-700">
                            Contact Person <span className="text-red-500">*</span>
                          </Label>
                          <Input
                            id="contactPerson-0"
                            placeholder="Enter Contact Person"
                            value={businesses[0].contactPerson}
                            onChange={(e) => updateBusiness(0, "contactPerson", e.target.value)}
                            className="w-full"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="contactTelephone-0" className="text-sm font-semibold text-gray-700">
                            Telephone number <span className="text-red-500">*</span>
                          </Label>
                          <div className="flex gap-2">
                            <div className="flex items-center gap-1 px-3 border border-gray-300 rounded-md bg-white">
                              <span className="text-xl">{getCountryFlag(businesses[0].contactTelephoneCode)}</span>
                              <select
                                className="border-0 outline-none bg-transparent text-sm"
                                value={businesses[0].contactTelephoneCode}
                                onChange={(e) => updateBusiness(0, "contactTelephoneCode", e.target.value)}
                              >
                                <option value="+44">+44</option>
                                <option value="+1">+1</option>
                                <option value="+90">+90</option>
                                <option value="+49">+49</option>
                              </select>
                            </div>
                            <Input
                              id="contactTelephone-0"
                              type="tel"
                              placeholder="123 456 67 87"
                              value={businesses[0].contactTelephone}
                              onChange={(e) => updateBusiness(0, "contactTelephone", e.target.value)}
                              required
                              className="flex-1"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Contact Person E-mail */}
                      <div className="space-y-2">
                        <Label htmlFor="contactEmail-0" className="text-sm font-semibold text-gray-700">
                          E-mail address <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="contactEmail-0"
                          type="email"
                          placeholder="Enter E-mail address"
                          value={businesses[0].contactEmail}
                          onChange={(e) => updateBusiness(0, "contactEmail", e.target.value)}
                          className="w-full"
                          required
                        />
                      </div>
                    </div>
                  )}

                  {/* Business 1 Address Information */}
                  <div className="space-y-6 border-t pt-6">
                    <h2 className="text-lg font-semibold text-gray-800">Business 1 Address Information</h2>

                    {/* Street and House number - Full width */}
                    <div className="space-y-2">
                      <Label htmlFor="businessStreet-0" className="text-sm font-semibold text-gray-700">
                        Street and House number
                      </Label>
                      <AddressAutocomplete
                        value={businesses[0].street}
                        onChange={(address, details) => {
                          if (details) {
                            updateBusiness(0, "street", details.street || address);
                            if (details.city) updateBusiness(0, "city", details.city);
                            if (details.postalCode) updateBusiness(0, "postalCode", details.postalCode);
                            if (details.country) updateBusiness(0, "country", details.country);
                          } else {
                            updateBusiness(0, "street", address);
                          }
                        }}
                        placeholder="Enter Location"
                        className="w-full"
                      />
                    </div>

                    {/* City and Postal code - Side by side */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="businessCity-0" className="text-sm font-semibold text-gray-700">
                          City
                        </Label>
                        <Input
                          id="businessCity-0"
                          placeholder="Enter City"
                          value={businesses[0].city}
                          onChange={(e) => updateBusiness(0, "city", e.target.value)}
                          className="w-full"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="businessPostalCode-0" className="text-sm font-semibold text-gray-700">
                          Postal code
                        </Label>
                        <Input
                          id="businessPostalCode-0"
                          placeholder="enter"
                          value={businesses[0].postalCode}
                          onChange={(e) => updateBusiness(0, "postalCode", e.target.value)}
                          className="w-full"
                        />
                      </div>
                    </div>

                    {/* Federal State and Country - Side by side */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="businessState-0" className="text-sm font-semibold text-gray-700">
                          Federal State <span className="text-red-500">*</span>
                        </Label>
                        <AddressAutocomplete
                          value={businesses[0].federalState}
                          onChange={(address) => updateBusiness(0, "federalState", address)}
                          placeholder="Enter State"
                          className="w-full"
                          fieldType="state"
                          countryRestriction={businesses[0].country}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="businessCountry-0" className="text-sm font-semibold text-gray-700">
                          Country <span className="text-red-500">*</span>
                        </Label>
                        <AddressAutocomplete
                          value={businesses[0].country}
                          onChange={(address) => {
                            updateBusiness(0, "country", address);
                            updateBusiness(0, "federalState", ""); // Reset state when country changes
                          }}
                          placeholder="Enter Country"
                          className="w-full"
                          fieldType="country"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </form>
          </CardContent>
        </Card>

        {/* Business Cards outside main company card - Only for Business 2 and onwards */}
        {businesses.length > 1 && (
          <div className="mt-8 space-y-6">
            {businesses.slice(1).map((business, originalIndex) => {
              const index = originalIndex + 1; // Adjust index to show correct business number (starts from 1, not 0)
              return (
            <Card key={index} className="border-gray-200 shadow-md">
              <CardContent className="pt-6 relative">
                {/* Delete Icon */}
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

                  {/* Business Name */}
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

                  {/* Owner/Managing Director and Telephone */}
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
                      <div className="flex gap-2">
                        <div className="flex items-center gap-1 px-3 border border-gray-300 rounded-md bg-white">
                          <span className="text-xl">{getCountryFlag(business.ownerTelephoneCode)}</span>
                          <select
                            className="border-0 outline-none bg-transparent text-sm"
                            value={business.ownerTelephoneCode}
                            onChange={(e) => updateBusiness(index, "ownerTelephoneCode", e.target.value)}
                          >
                            <option value="+44">+44</option>
                            <option value="+1">+1</option>
                            <option value="+90">+90</option>
                            <option value="+49">+49</option>
                          </select>
                        </div>
                        <Input
                          id={`ownerTelephone-${index}`}
                          type="tel"
                          placeholder="123 456 67 87"
                          value={business.ownerTelephone}
                          onChange={(e) => updateBusiness(index, "ownerTelephone", e.target.value)}
                          required
                          className="flex-1"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Owner E-mail */}
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

                  {/* Contact Person Checkbox */}
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

                  {/* Contact Person Fields - Conditional */}
                  {business.differentContact && (
                    <div className="space-y-6 pl-6 border-l-2 border-gray-200">
                      {/* Contact Person and Telephone */}
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
                          <div className="flex gap-2">
                            <div className="flex items-center gap-1 px-3 border border-gray-300 rounded-md bg-white">
                              <span className="text-xl">{getCountryFlag(business.contactTelephoneCode)}</span>
                              <select
                                className="border-0 outline-none bg-transparent text-sm"
                                value={business.contactTelephoneCode}
                                onChange={(e) => updateBusiness(index, "contactTelephoneCode", e.target.value)}
                              >
                                <option value="+44">+44</option>
                                <option value="+1">+1</option>
                                <option value="+90">+90</option>
                                <option value="+49">+49</option>
                              </select>
                            </div>
                            <Input
                              id={`contactTelephone-${index}`}
                              type="tel"
                              placeholder="123 456 67 87"
                              value={business.contactTelephone}
                              onChange={(e) => updateBusiness(index, "contactTelephone", e.target.value)}
                              required
                              className="flex-1"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Contact Person E-mail */}
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

                  {/* Business Address Information */}
                  <div className="space-y-6 border-t pt-6">
                    <h2 className="text-lg font-semibold text-gray-800">Business {index + 1} Address Information</h2>

                    {/* Street and House number - Full width */}
                    <div className="space-y-2">
                      <Label htmlFor={`businessStreet-${index}`} className="text-sm font-semibold text-gray-700">
                        Street and House number
                      </Label>
                      <AddressAutocomplete
                        value={business.street}
                        onChange={(address, details) => {
                          if (details) {
                            updateBusiness(index, "street", details.street || address);
                            if (details.city) updateBusiness(index, "city", details.city);
                            if (details.postalCode) updateBusiness(index, "postalCode", details.postalCode);
                            if (details.country) updateBusiness(index, "country", details.country);
                          } else {
                            updateBusiness(index, "street", address);
                          }
                        }}
                        placeholder="Enter Location"
                        className="w-full"
                      />
                    </div>

                    {/* City and Postal code - Side by side */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor={`businessCity-${index}`} className="text-sm font-semibold text-gray-700">
                          City
                        </Label>
                        <Input
                          id={`businessCity-${index}`}
                          placeholder="Enter City"
                          value={business.city}
                          onChange={(e) => updateBusiness(index, "city", e.target.value)}
                          className="w-full"
                        />
                      </div>
                      

                      <div className="space-y-2">
                        <Label htmlFor={`businessPostalCode-${index}`} className="text-sm font-semibold text-gray-700">
                          Postal code
                        </Label>
                        <Input
                          id={`businessPostalCode-${index}`}
                          placeholder="enter"
                          value={business.postalCode}
                          onChange={(e) => updateBusiness(index, "postalCode", e.target.value)}
                          className="w-full"
                        />
                      </div>
                    </div>

                    {/* Federal State and Country - Side by side */}
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
                            updateBusiness(index, "federalState", ""); // Reset state when country changes
                          }}
                          placeholder="Enter Country"
                          className="w-full"
                          fieldType="country"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
              );
            })}
          </div>
        )}

        {/* Add Business and Next Buttons - Outside all cards, always at the bottom */}
        <div className="mt-8 space-y-4">
          {/* Add Business Button */}
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

          {/* Next Button */}
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
