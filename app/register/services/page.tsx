"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useRegistration } from "@/contexts/RegistrationContext";
import ProgressBar from "@/components/ProgressBar";
import RegisterButton from "@/components/RegisterButton";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

// Types
interface ServiceContract {
  name: string;
  contract_name: string;
  contract_pdf: string;
}

interface Service {
  id: string; // ID (örn: l3fe0digrh)
  name: string; // İsim (örn: Premium Paket)
  description: string;
  image: string | null;
  isActive: boolean;
  contracts: ServiceContract[];
}

const DEFAULT_TERMS_OF_USE = `By agreeing, you declare that you have read...`;

export default function ServicesPage() {
  const router = useRouter();
  const { formData, updateFormData, goToStep } = useRegistration();
  const [services, setServices] = useState<Service[]>([]);
  const [selectedServices, setSelectedServices] = useState<string[]>([]); // ID listesi
  const [acceptedTerms, setAcceptedTerms] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  
  const isInitialLoadRef = useRef(true);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // --- 1. TÜM SERVİSLERİ ÇEK ---
  const fetchServices = useCallback(async () => {
    try {
      const response = await fetch("/api/erp/get-services");
      const data = await response.json();
      if (data.success && Array.isArray(data.services)) {
        setServices(data.services);
      }
    } catch (error) {
      console.error("Error fetching services:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  // --- 2. ERP'DEN KAYITLI SEÇİMLERİ GETİR ---
  const loadSelectedServices = useCallback(async () => {
    // Servis listesi boşsa eşleştirme yapamayız, bekle.
    if (services.length === 0) return;

    let userEmail = "";
    if (typeof window !== "undefined") {
      userEmail = sessionStorage.getItem("userEmail") || "";
      if (!userEmail) {
        const initialData = localStorage.getItem("initialRegistrationData");
        if (initialData) try { userEmail = JSON.parse(initialData).email || ""; } catch (e) {}
      }
    }
    if (!userEmail) return;

    try {
      const res = await fetch("/api/erp/get-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: userEmail }),
      });

      const data = await res.json();

      if (data.success && data.lead && data.lead.custom_selected_services) {
        let incomingValues: string[] = [];
        
        // Veriyi Parse Et (String veya JSON olabilir)
        const raw = data.lead.custom_selected_services;
        try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) incomingValues = parsed;
        } catch {
            // JSON değilse, virgülle ayrılmış stringdir
            incomingValues = raw.split(",").map((s: string) => s.trim());
        }

        console.log("ERP'den Gelen Değerler:", incomingValues);
        
        const matchedIDs: string[] = [];

        // --- AKILLI EŞLEŞTİRME MANTIĞI ---
        // Gelen değer ID de olabilir, İsim de olabilir. İkisini de kontrol et.
        incomingValues.forEach(val => {
          const cleanVal = val.toLowerCase().trim();

          // 1. İSİM ile eşleşiyor mu? (Backend İsim kaydettiyse burası çalışır)
          const matchByName = services.find(s => s.name.toLowerCase().trim() === cleanVal);
          if (matchByName) {
              matchedIDs.push(matchByName.id);
              return;
          }

          // 2. ID ile eşleşiyor mu? (Backend ID kaydettiyse burası çalışır)
          const matchById = services.find(s => s.id === cleanVal);
          if (matchById) {
              matchedIDs.push(matchById.id);
          }
        });

        console.log("Eşleşen Servis ID'leri:", matchedIDs);
        
        if (matchedIDs.length > 0) {
          setSelectedServices(matchedIDs);
          // Seçili gelenlerin terms'lerini otomatik kabul et
          const termsMap: Record<string, boolean> = {};
          matchedIDs.forEach(id => { termsMap[id] = true; });
          setAcceptedTerms(termsMap);
        }
      }
    } catch (error) {
      console.error("Load error:", error);
    }
  }, [services]); 

  // --- Initial Load ---
  useEffect(() => {
    if (formData.currentStep !== 2) goToStep(2);
    fetchServices();
  }, [formData.currentStep, goToStep, fetchServices]);

  // Servisler yüklendiğinde kullanıcı seçimlerini getir
  useEffect(() => {
    if (services.length > 0 && isInitialLoadRef.current) {
      loadSelectedServices().then(() => {
        setTimeout(() => { isInitialLoadRef.current = false; }, 500);
      });
    }
  }, [services, loadSelectedServices]);

  // --- Auto Save ---
  useEffect(() => {
    if (isInitialLoadRef.current) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

    saveTimeoutRef.current = setTimeout(async () => {
      await saveSelectionToErp();
    }, 1000);

    return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); };
  }, [selectedServices]);

  const saveSelectionToErp = async () => {
    let userEmail = sessionStorage.getItem("userEmail");
    if (!userEmail) {
        const initialData = localStorage.getItem("initialRegistrationData");
        if (initialData) try { userEmail = JSON.parse(initialData).email; } catch(e){}
    }
    if (!userEmail) return;

    try {
      // Backend'e ID'leri gönderiyoruz. Backend bunları İsim'e çevirip kaydedecek.
      await fetch("/api/erp/update-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: userEmail,
          services: selectedServices, // ID Array
        }),
      });
    } catch (error) { console.error("Auto-save failed", error); }
  };

  const handleServiceToggle = (serviceId: string) => {
    setSelectedServices((prev) => {
      const isSelected = prev.includes(serviceId);
      if (isSelected) {
        setAcceptedTerms(prev => {
            const newTerms = { ...prev };
            delete newTerms[serviceId];
            return newTerms;
        });
        return prev.filter(id => id !== serviceId);
      } else {
        return [...prev, serviceId];
      }
    });
  };

  const handleTermsToggle = (serviceId: string, checked: boolean) => {
    setAcceptedTerms(prev => ({ ...prev, [serviceId]: checked }));
  };

  const handleNext = async () => {
    const missingTerms = selectedServices.filter(id => !acceptedTerms[id]);
    if (selectedServices.length > 0 && missingTerms.length > 0) {
      alert("Please accept terms of use.");
      return;
    }
    await saveSelectionToErp();
    goToStep(3);
    router.push("/register/payment-information");
  };

  const handleBack = async () => {
    await saveSelectionToErp();
    goToStep(1);
    router.push("/register/company-information");
  };

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <ProgressBar />
        <div className="mb-8 mt-8 ml-2">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Services</h1>
          <p className="text-sm text-gray-600">Please select services.</p>
        </div>

        {loading ? (
           <div className="text-center py-12">Loading...</div>
        ) : (
          <div className="space-y-8">
            {services.map((service) => {
              const isSelected = selectedServices.includes(service.id);
              return (
                <Card key={service.id} className={`border-2 transition-all ${isSelected ? "border-gray-800 shadow-lg" : "border-gray-200"}`}>
                  <CardContent className="p-0">
                    <div className="p-6">
                      <div className="flex flex-col md:flex-row gap-6 items-start">
                        <div className="w-full md:w-1/3 flex-shrink-0">
                           <div className="aspect-video relative rounded-lg overflow-hidden bg-gray-100 border border-gray-200">
                             {service.image ? (
                               <img src={service.image} alt={service.name} className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                             ) : (
                               <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">No Image</div>
                             )}
                           </div>
                        </div>
                        <div className="flex-1 w-full">
                           <div className="flex justify-between items-start mb-2">
                              <h3 className="text-xl font-bold text-gray-900">{service.name}</h3>
                              <Checkbox checked={isSelected} onCheckedChange={() => handleServiceToggle(service.id)} className="w-6 h-6 border-2 data-[state=checked]:bg-gray-900" />
                           </div>
                           <div className="text-gray-600 text-sm mb-4 cursor-pointer" onClick={() => handleServiceToggle(service.id)}>
                             {service.description || "No description."}
                           </div>
                           <label className={`text-sm font-medium cursor-pointer ${isSelected ? "text-green-600" : "text-gray-500"}`} onClick={() => handleServiceToggle(service.id)}>
                             {isSelected ? "Service Selected" : "Click to select"}
                           </label>
                        </div>
                      </div>
                    </div>
                    {isSelected && (
                      <div className="border-t border-gray-200 bg-gray-50 p-6">
                        <h4 className="text-sm font-semibold mb-3">Terms of Use</h4>
                        <div className="bg-white border rounded-md p-4 max-h-48 overflow-y-auto mb-4 text-sm text-gray-600">{DEFAULT_TERMS_OF_USE}</div>
                        <div className="flex items-center gap-3">
                          <Checkbox checked={acceptedTerms[service.id] || false} onCheckedChange={(checked) => handleTermsToggle(service.id, checked === true)} />
                          <Label className="text-sm font-medium cursor-pointer">I accept the Terms of Use for {service.name}.</Label>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
        <div className="flex justify-center gap-4 pt-10 pb-8">
          <Button onClick={handleBack} variant="outline" className="px-8 h-[50px] w-[200px]">Back</Button>
          <RegisterButton onClick={handleNext} className="w-[200px]">Next</RegisterButton>
        </div>
      </div>
    </div>
  );
}