"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useRegistration } from "@/contexts/RegistrationContext";
import ProgressBar from "@/components/ProgressBar";
import AddressAutocomplete from "@/components/AddressAutocomplete";
import RegisterButton from "@/components/RegisterButton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";

export default function CompanyInformationPage() {
  const router = useRouter();
  const { formData, updateFormData, goToStep } = useRegistration();
  const [restaurantCount, setRestaurantCount] = useState(
    formData.companyInfo.restaurantCount || "1"
  );
  
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
  }, [restaurantCount]);

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

  const handleNext = () => {
    // Basic validation - can be enhanced
    if (!formData.companyInfo.companyName || !formData.companyInfo.vatIdentificationNumber) {
      alert("Please fill in required fields");
      return;
    }

    // Navigate to next step
    goToStep(2);
    router.push("/register/company-representative");
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

                {/* City and Postal code - Side by side */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="companyCity" className="text-sm font-semibold text-gray-700">
                      City
                    </Label>
                    <Input
                      id="companyCity"
                      placeholder="Enter City"
                      value={formData.companyInfo.city}
                      onChange={(e) => handleCompanyInfoChange("city", e.target.value)}
                      className="w-full"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="companyPostalCode" className="text-sm font-semibold text-gray-700">
                      Postal code
                    </Label>
                    <Input
                      id="companyPostalCode"
                      placeholder="enter"
                      value={formData.companyInfo.zipCode}
                      onChange={(e) => handleCompanyInfoChange("zipCode", e.target.value)}
                      className="w-full"
                    />
                  </div>
                </div>

                {/* Federal State and Country - Side by side */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="companyState" className="text-sm font-semibold text-gray-700">
                      Federal State <span className="text-red-500">*</span>
                    </Label>
                    <select
                      id="companyState"
                      value={formData.companyInfo.federalState}
                      onChange={(e) => handleCompanyInfoChange("federalState", e.target.value)}
                      disabled={!formData.companyInfo.country}
                      className="w-full h-10 px-3 rounded-md border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                    >
                      <option value="">Select State</option>
                      {formData.companyInfo.country &&
                        states[formData.companyInfo.country]?.map((state) => (
                          <option key={state} value={state}>
                            {state}
                          </option>
                        ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="companyCountry" className="text-sm font-semibold text-gray-700">
                      Country <span className="text-red-500">*</span>
                    </Label>
                    <select
                      id="companyCountry"
                      value={formData.companyInfo.country}
                      onChange={(e) => {
                        handleCompanyInfoChange("country", e.target.value);
                        handleCompanyInfoChange("federalState", ""); // Reset state when country changes
                      }}
                      className="w-full h-10 px-3 rounded-md border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    >
                      <option value="">Select Country</option>
                      {countries.map((country) => (
                        <option key={country} value={country}>
                          {country}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Businesses - Map through all businesses */}
              {businesses.map((business, index) => (
                <div key={index} className="space-y-6 border-t pt-6">
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
                        <select
                          id={`businessState-${index}`}
                          value={business.federalState}
                          onChange={(e) => updateBusiness(index, "federalState", e.target.value)}
                          disabled={!business.country}
                          className="w-full h-10 px-3 rounded-md border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                        >
                          <option value="">Select State</option>
                          {business.country &&
                            states[business.country]?.map((state) => (
                              <option key={state} value={state}>
                                {state}
                              </option>
                            ))}
                        </select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`businessCountry-${index}`} className="text-sm font-semibold text-gray-700">
                          Country <span className="text-red-500">*</span>
                        </Label>
                        <select
                          id={`businessCountry-${index}`}
                          value={business.country}
                          onChange={(e) => {
                            updateBusiness(index, "country", e.target.value);
                            updateBusiness(index, "federalState", ""); // Reset state when country changes
                          }}
                          className="w-full h-10 px-3 rounded-md border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                        >
                          <option value="">Select Country</option>
                          {countries.map((country) => (
                            <option key={country} value={country}>
                              {country}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {/* Add Business Button - Only show after last business */}
              <div className="flex justify-center pt-4">
                <button
                  type="button"
                  onClick={addBusiness}
                  className="flex flex-col items-center justify-center w-full py-6 border-2 border-dashed border-gray-300 rounded-md hover:border-gray-400 transition-colors"
                >
                  <span className="text-2xl mb-2">+</span>
                  <span className="text-sm font-semibold text-gray-700">Add Business</span>
                </button>
              </div>

              {/* Next Button */}
              <div className="flex justify-center pt-6 border-t">
                <RegisterButton type="button" onClick={handleNext}>
                  Next
                </RegisterButton>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
