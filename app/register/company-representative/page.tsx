"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useRegistration } from "@/contexts/RegistrationContext";
import ProgressBar from "@/components/ProgressBar";
import RegisterButton from "@/components/RegisterButton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";

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

export default function CompanyRepresentativePage() {
  const router = useRouter();
  const { formData, updateFormData, goToStep } = useRegistration();
  const [representativeData, setRepresentativeData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    telephone: "",
    telephoneCode: "+44",
    ownerDirector: "",
    differentContact: false,
  });

  useEffect(() => {
    // Ensure we're on step 2
    if (formData.currentStep !== 2) {
      goToStep(2);
    }

    // Load initial registration data from localStorage if available
    if (typeof window !== "undefined") {
      const initialData = localStorage.getItem("initialRegistrationData");
      if (initialData) {
        try {
          const parsed = JSON.parse(initialData);
          setRepresentativeData((prev) => ({
            ...prev,
            firstName: parsed.firstName || "",
            lastName: parsed.lastName || "",
            email: parsed.email || "",
            telephone: parsed.telephone || "",
            telephoneCode: parsed.telephoneCode || "+44",
          }));
        } catch (error) {
          console.error("Error loading initial data:", error);
        }
      }
    }
  }, [formData.currentStep, goToStep]);

  const handleChange = (field: string, value: string | boolean) => {
    setRepresentativeData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleBack = () => {
    goToStep(1);
    router.push("/register/company-information");
  };

  const handleNext = () => {
    // Basic validation
    if (
      !representativeData.firstName ||
      !representativeData.lastName ||
      !representativeData.email ||
      !representativeData.telephone ||
      !representativeData.ownerDirector
    ) {
      alert("Please fill in all required fields");
      return;
    }

    // Save data and navigate to next step
    // TODO: Save to context or localStorage if needed
    goToStep(3);
    router.push("/register/payment-information");
  };

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <Card className="border-gray-200 shadow-lg">
          <CardContent className="p-8">
            {/* Progress Bar */}
            <ProgressBar />

            {/* Section Title */}
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Company Representative</h1>
              <p className="text-sm text-gray-600">Please provide your company details to get started</p>
            </div>

            <form className="space-y-8" onSubmit={(e) => e.preventDefault()}>
              {/* Company Officials Section */}
              <div className="space-y-6">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold text-gray-800">Company Officials</h2>
                  <span className="text-xs text-red-500">*</span>
                </div>

                {/* First Name and Last Name */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName" className="text-sm font-semibold text-gray-700">
                      First Name
                    </Label>
                    <Input
                      id="firstName"
                      placeholder="Enter First Name"
                      value={representativeData.firstName}
                      onChange={(e) => handleChange("firstName", e.target.value)}
                      className="w-full"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName" className="text-sm font-semibold text-gray-700">
                      Last Name
                    </Label>
                    <Input
                      id="lastName"
                      placeholder="Enter Last Name"
                      value={representativeData.lastName}
                      onChange={(e) => handleChange("lastName", e.target.value)}
                      className="w-full"
                    />
                  </div>
                </div>

                {/* Email and Telephone */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Email */}
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-sm font-semibold text-gray-700">
                      E-mail address <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="Enter E-mail address"
                      value={representativeData.email}
                      onChange={(e) => handleChange("email", e.target.value)}
                      className="w-full"
                      required
                    />
                  </div>

                  {/* Telephone */}
                  <div className="space-y-2">
                    <Label htmlFor="telephone" className="text-sm font-semibold text-gray-700">
                      Telephone number <span className="text-red-500">*</span>
                    </Label>
                    <div className="flex gap-2">
                      <div className="flex items-center gap-1 px-3 border border-gray-300 rounded-md bg-white">
                        <span className="text-xl">{getCountryFlag(representativeData.telephoneCode)}</span>
                        <select
                          className="border-0 outline-none bg-transparent text-sm"
                          value={representativeData.telephoneCode}
                          onChange={(e) => handleChange("telephoneCode", e.target.value)}
                        >
                          <option value="+44">+44</option>
                          <option value="+1">+1</option>
                          <option value="+90">+90</option>
                          <option value="+49">+49</option>
                        </select>
                      </div>
                      <Input
                        id="telephone"
                        type="tel"
                        placeholder="(123) 456 67 87"
                        value={representativeData.telephone}
                        onChange={(e) => handleChange("telephone", e.target.value)}
                        required
                        className="flex-1"
                      />
                    </div>
                  </div>
                </div>

                {/* Owner/Managing Director */}
                <div className="space-y-2">
                  <Label htmlFor="ownerDirector" className="text-sm font-semibold text-gray-700">
                    Owner/Managing Director <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="ownerDirector"
                    placeholder="Enter Director"
                    value={representativeData.ownerDirector}
                    onChange={(e) => handleChange("ownerDirector", e.target.value)}
                    className="w-full"
                    required
                  />
                </div>

                {/* Contact Person Checkbox */}
                <div className="flex items-start space-x-2">
                  <Checkbox
                    id="differentContact"
                    checked={representativeData.differentContact}
                    onCheckedChange={(checked) => handleChange("differentContact", checked === true)}
                  />
                  <Label
                    htmlFor="differentContact"
                    className="text-sm font-normal text-gray-700 cursor-pointer leading-relaxed"
                  >
                    Different contact details of the contact person
                  </Label>
                </div>
              </div>

              {/* Navigation Buttons */}
              <div className="flex justify-center gap-4 pt-6 border-t">
                <Button
                  type="button"
                  onClick={handleBack}
                  variant="outline"
                  className="px-8 h-[50px] text-base font-semibold border-gray-300 text-gray-700 hover:bg-gray-50"
                  style={{ width: "343px" }}
                >
                  Back
                </Button>
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
