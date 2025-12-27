"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useRegistration } from "@/contexts/RegistrationContext";
import ProgressBar from "@/components/ProgressBar";
import RegisterButton from "@/components/RegisterButton";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import Image from "next/image";

interface ServiceContract {
  name: string;
  contract_name: string;
  contract_pdf: string;
  valid_from: string;
  valid_to: string;
}

interface Service {
  id: string;
  name: string;
  description: string;
  image: string | null;
  isActive: boolean;
  contracts: ServiceContract[];
}

// Default Terms of Use text (şimdilik otomatik doldurulacak)
const DEFAULT_TERMS_OF_USE = `By agreeing, you declare that you have read, fully understood, and legally accepted the Terms of Use. Furthermore, you acknowledge that the Terms may be updated periodically and that any continued use of the service constitutes acceptance of the currently valid versions. You confirm that you have familiarized yourself with all regulations and accept them as the basis for our contractual cooperation. Furthermore, you declare that all information you have provided is accurate, complete, and up-to-date. You agree to take the necessary security measures to protect your account and to refrain from any form of misuse. You also agree that personal data may be processed in accordance with applicable data protection regulations and may be disclosed to competent authorities as required by law. By giving your consent, you confirm that you have read and understood the data protection regulations and expressly agree to the described processing activities.`;

export default function ServicesPage() {
  const router = useRouter();
  const { formData, updateFormData, goToStep } = useRegistration();
  const [services, setServices] = useState<Service[]>([]);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [acceptedTerms, setAcceptedTerms] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  const loadSelectedServices = useCallback(async () => {
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

      if (data.success && data.lead && data.lead.custom_selected_services) {
        try {
          const savedServices = JSON.parse(data.lead.custom_selected_services);
          if (Array.isArray(savedServices) && savedServices.length > 0) {
            setSelectedServices(savedServices);
            // Terms'leri de otomatik kabul et (kullanıcı daha önce kabul etmişti)
            const termsMap: Record<string, boolean> = {};
            savedServices.forEach((serviceId: string) => {
              termsMap[serviceId] = true;
            });
            setAcceptedTerms(termsMap);
          }
        } catch (parseError) {
          console.error("Error parsing selected services:", parseError);
        }
      }
    } catch (error) {
      console.error("Error loading selected services:", error);
      // Hata olsa bile devam et
    }
  }, []);

  const fetchServices = useCallback(async () => {
    try {
      const response = await fetch("/api/erp/get-services");
      const data = await response.json();

      console.log("Services API response:", data);

      if (data.success && Array.isArray(data.services)) {
        console.log("Services loaded:", data.services.length);
        setServices(data.services);
      } else {
        console.error("Services API error:", data.error);
        // Hata mesajını göster
        if (data.error) {
          alert(`Error loading services: ${data.error}`);
        }
      }
    } catch (error) {
      console.error("Error fetching services:", error);
      alert("Failed to load services. Please check console for details.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Ensure we're on step 2
    if (formData.currentStep !== 2) {
      goToStep(2);
    }

    // Load services from ERPNext
    fetchServices();
    
    // Load selected services from Lead if available
    loadSelectedServices();
  }, [formData.currentStep, goToStep, fetchServices, loadSelectedServices]);

  const handleServiceToggle = (serviceId: string) => {
    setSelectedServices((prev) => {
      if (prev.includes(serviceId)) {
        // Service seçimi kaldırıldığında terms acceptance'ı da kaldır
        setAcceptedTerms((prevTerms) => {
          const newTerms = { ...prevTerms };
          delete newTerms[serviceId];
          return newTerms;
        });
        return prev.filter((id) => id !== serviceId);
      } else {
        return [...prev, serviceId];
      }
    });
  };

  const handleTermsToggle = (serviceId: string, checked: boolean) => {
    setAcceptedTerms((prev) => ({
      ...prev,
      [serviceId]: checked,
    }));
  };

  const handleBack = () => {
    goToStep(1);
    router.push("/register/company-information");
  };

  const handleNext = async () => {
    // Validate: Seçilen her service için terms kabul edilmiş olmalı
    const allTermsAccepted = selectedServices.every(
      (serviceId) => acceptedTerms[serviceId] === true
    );

    if (selectedServices.length > 0 && !allTermsAccepted) {
      alert("Please accept the terms of use for all selected services.");
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

    // Update Lead with selected services
    try {
      const res = await fetch("/api/erp/update-lead", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: userEmail,
          services: selectedServices,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        alert(data.error || "Failed to update lead. Please try again.");
        return;
      }

      console.log("Services updated successfully:", data.lead);
    } catch (error) {
      console.error("Services update failed:", error);
      alert("Failed to update services. Please try again.");
      return;
    }

    // Navigate to next step
    goToStep(3);
    router.push("/register/payment-information");
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  };

  const getBaseUrl = () => {
    if (typeof window !== "undefined") {
      return process.env.NEXT_PUBLIC_ERP_BASE_URL || "";
    }
    return "";
  };

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Progress Bar */}
        <ProgressBar />

        {/* Section Title */}
        <div className="mb-8 mt-8 ml-10">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Services</h1>
          <p className="text-sm text-gray-600">Please provide your company details to get started</p>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Panel: Services Selection */}
          <Card className="border-gray-200 shadow-lg">
            <CardContent className="p-8">
              <h2 className="text-lg font-semibold text-gray-800 mb-6">SERVICES</h2>
              
              {loading ? (
                <div className="text-center py-12">
                  <p className="text-gray-600">Loading services...</p>
                </div>
              ) : services.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-600">No services available at the moment.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {services.map((service) => (
                    <div key={service.id} className="space-y-4">
                      {/* Service Name */}
                      <h3 className="text-base font-semibold text-gray-800">{service.name}</h3>
                      
                      {/* Service Image */}
                      {service.image && (
                        <div className="relative w-full h-48 flex-shrink-0">
                          <Image
                            src={service.image}
                            alt={service.name}
                            fill
                            className="object-contain rounded-lg"
                            unoptimized
                          />
                        </div>
                      )}

                      {/* Service Checkbox */}
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id={`service-${service.id}`}
                          checked={selectedServices.includes(service.id)}
                          onCheckedChange={() => handleServiceToggle(service.id)}
                        />
                        <Label
                          htmlFor={`service-${service.id}`}
                          className="text-sm font-normal text-gray-700 cursor-pointer"
                        >
                          Select {service.name}
                        </Label>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Right Panel: Terms of Use */}
          <Card className="border-gray-200 shadow-lg">
            <CardContent className="p-8">
              <h2 className="text-lg font-semibold text-gray-800 mb-6">Terms of Use</h2>
              
              {selectedServices.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-600">Please select a service to view its terms of use.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {selectedServices.map((serviceId) => {
                    const service = services.find((s) => s.id === serviceId);
                    if (!service) return null;

                    return (
                      <div key={serviceId} className="space-y-4">
                        {/* Service Name with asterisk */}
                        <h3 className="text-base font-semibold text-gray-800">
                          {service.name.toUpperCase()} Terms of Use <span className="text-red-500">*</span>
                        </h3>

                        {/* Terms Text Area (Scrollable) */}
                        <div className="border border-gray-300 rounded-md p-4 bg-white max-h-64 overflow-y-auto">
                          <p className="text-sm text-gray-700 whitespace-pre-wrap">
                            {DEFAULT_TERMS_OF_USE}
                          </p>
                        </div>

                        {/* Terms Acceptance Checkbox */}
                        <div className="flex items-start gap-2">
                          <Checkbox
                            id={`terms-${serviceId}`}
                            checked={acceptedTerms[serviceId] || false}
                            onCheckedChange={(checked) =>
                              handleTermsToggle(serviceId, checked === true)
                            }
                            className="mt-1"
                          />
                          <Label
                            htmlFor={`terms-${serviceId}`}
                            className="text-sm font-normal text-gray-700 cursor-pointer leading-relaxed"
                          >
                            I confirm that I have read and accepted terms of use.
                          </Label>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Navigation Buttons */}
        <div className="flex justify-center gap-4 pt-6 mt-8">
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
      </div>
    </div>
  );
}

