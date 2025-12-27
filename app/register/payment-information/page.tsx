"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useRegistration } from "@/contexts/RegistrationContext";
import ProgressBar from "@/components/ProgressBar";
import RegisterButton from "@/components/RegisterButton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// IBAN Validation function using Mod-97 algorithm
function validateIBAN(iban: string): boolean {
  // Remove spaces and convert to uppercase
  const cleaned = iban.replace(/\s+/g, "").toUpperCase();

  // Basic format check: IBAN should be 15-34 characters, start with 2 letters, then 2 digits, then alphanumeric
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(cleaned) || cleaned.length < 15 || cleaned.length > 34) {
    return false;
  }

  // Extract country code, check digits, and BBAN
  const countryCode = cleaned.substring(0, 2);
  const checkDigits = cleaned.substring(2, 4);
  const bban = cleaned.substring(4);

  // Rearrange: move first 4 characters (country code + check digits) to end
  const rearranged = bban + countryCode + checkDigits;

  // Convert letters to numbers (A=10, B=11, ..., Z=35)
  let numericString = "";
  for (let i = 0; i < rearranged.length; i++) {
    const char = rearranged[i];
    if (char >= "0" && char <= "9") {
      numericString += char;
    } else if (char >= "A" && char <= "Z") {
      numericString += (char.charCodeAt(0) - 55).toString();
    } else {
      return false;
    }
  }

  // Calculate mod-97 using BigInt for large numbers
  try {
    const remainder = BigInt(numericString) % BigInt(97);
    return remainder === BigInt(1);
  } catch (e) {
    // Fallback for very old browsers (unlikely)
    return false;
  }
}

export default function PaymentInformationPage() {
  const router = useRouter();
  const { formData, updateFormData, goToStep } = useRegistration();
  const [paymentData, setPaymentData] = useState({
    accountHolder: "",
    iban: "",
    bic: "",
  });
  const [ibanError, setIbanError] = useState("");
  const [ibanTouched, setIbanTouched] = useState(false);

  const loadPaymentInfo = useCallback(async () => {
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
      return; // Email yoksa Lead'den veri çekemeyiz
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
        
        // Payment bilgilerini form'a yükle
        if (lead.custom_account_holder || lead.custom_iban || lead.custom_bic) {
          setPaymentData({
            accountHolder: lead.custom_account_holder || "",
            iban: lead.custom_iban || "",
            bic: lead.custom_bic || "",
          });
          
          // IBAN validation'ı da yap
          if (lead.custom_iban) {
            setIbanTouched(true);
            if (validateIBAN(lead.custom_iban)) {
              setIbanError("");
            } else {
              setIbanError("Geçerli bir IBAN giriniz");
            }
          }
        }
      }
    } catch (error) {
      console.error("Error loading payment info:", error);
      // Hata olsa bile devam et, form boş kalabilir
    }
  }, []);

  useEffect(() => {
    // Ensure we're on step 3
    if (formData.currentStep !== 3) {
      goToStep(3);
    }

    // Load payment information from Lead if available
    loadPaymentInfo();
  }, [formData.currentStep, goToStep, loadPaymentInfo]);

  const handleChange = (field: string, value: string) => {
    setPaymentData((prev) => ({
      ...prev,
      [field]: value,
    }));

    // Validate IBAN on change
    if (field === "iban") {
      setIbanTouched(true);
      const cleaned = value.replace(/\s+/g, "");
      if (cleaned.length > 0) {
        if (validateIBAN(value)) {
          setIbanError("");
        } else {
          setIbanError("Geçerli bir IBAN giriniz");
        }
      } else {
        setIbanError("");
      }
    }
  };

  const handleBack = () => {
    goToStep(2);
    router.push("/register/services");
  };

  const handleNext = async () => {
    // Validate all fields
    if (!paymentData.accountHolder || !paymentData.iban || !paymentData.bic) {
      alert("Please fill in all required fields");
      return;
    }

    // Validate IBAN
    if (!validateIBAN(paymentData.iban)) {
      setIbanTouched(true);
      setIbanError("Geçerli bir IBAN giriniz");
      return;
    }

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
      alert("User email not found. Please login or complete the initial registration first.");
      return;
    }

    // Update Lead with payment information
    try {
      const requestBody = {
        email: userEmail,
        paymentInfo: {
          accountHolder: paymentData.accountHolder,
          iban: paymentData.iban,
          bic: paymentData.bic,
        },
      };

      console.log("Sending payment info to API:", requestBody);

      const res = await fetch("/api/erp/update-lead", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      const data = await res.json();
      console.log("API Response:", data);

      if (!res.ok || !data.success) {
        console.error("API Error:", data);
        alert(data.error || "Failed to update lead. Please try again.");
        return;
      }

      console.log("Payment information updated successfully:", data.lead);
    } catch (error) {
      console.error("Payment information update failed:", error);
      alert("Failed to update payment information. Please try again.");
      return;
    }

    // Navigate to next step
    goToStep(4);
    router.push("/register/registration-documents");
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
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Payment Information</h1>
              <p className="text-sm text-gray-600">
                Please provide your company payment information details
              </p>
            </div>

            <form className="space-y-8" onSubmit={(e) => e.preventDefault()}>
              {/* Payment Details Section */}
              <div className="space-y-6">
                {/* Account Holder */}
                <div className="space-y-2">
                  <Label htmlFor="accountHolder" className="text-sm font-semibold text-gray-700">
                    Account Holder <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="accountHolder"
                    placeholder="Enter"
                    value={paymentData.accountHolder}
                    onChange={(e) => handleChange("accountHolder", e.target.value)}
                    className="w-full"
                    required
                  />
                </div>

                {/* IBAN */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="iban" className="text-sm font-semibold text-gray-700">
                      IBAN <span className="text-red-500">*</span>
                    </Label>
                  </div>
                  <Input
                    id="iban"
                    placeholder="Enter"
                    value={paymentData.iban}
                    onChange={(e) => handleChange("iban", e.target.value)}
                    className={`w-full ${ibanError && ibanTouched ? "border-red-500" : ""}`}
                    required
                  />
                  {ibanError && ibanTouched && (
                    <p className="text-xs text-red-500">{ibanError}</p>
                  )}
                </div>

                {/* BIC */}
                <div className="space-y-2">
                  <Label htmlFor="bic" className="text-sm font-semibold text-gray-700">
                    BIC <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="bic"
                    placeholder="Enter"
                    value={paymentData.bic}
                    onChange={(e) => handleChange("bic", e.target.value)}
                    className="w-full"
                    required
                  />
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
