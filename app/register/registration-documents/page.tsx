"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useRegistration } from "@/contexts/RegistrationContext";
import ProgressBar from "@/components/ProgressBar";
import RegisterButton from "@/components/RegisterButton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface FileWithPreview extends File {
  preview?: string;
}

interface CompanyType {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
}

interface RequiredDocument {
  id: string;
  documentName: string;
  documentType: string;
  isRequired: boolean;
  maxFiles: number;
  allowedFileTypes: string;
  isDateField: boolean;
  dateFieldLabel: string;
}

interface DocumentData {
  files?: FileWithPreview[];
  date?: string;
}

export default function RegistrationDocumentsPage() {
  const router = useRouter();
  const { formData, updateFormData, goToStep } = useRegistration();
  const [companyTypes, setCompanyTypes] = useState<CompanyType[]>([]);
  const [selectedCompanyType, setSelectedCompanyType] = useState("");
  const [requiredDocuments, setRequiredDocuments] = useState<RequiredDocument[]>([]);
  const [documentData, setDocumentData] = useState<Record<string, DocumentData>>({});
  const [loadingCompanyTypes, setLoadingCompanyTypes] = useState(false);
  const [loadingDocuments, setLoadingDocuments] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [parsingPdf, setParsingPdf] = useState(false);
  const errorText =
    typeof error === "string" ? error : (error as any)?.message || JSON.stringify(error);

  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const hasLoadedCompanyTypes = useRef(false);

  // Company type'ları ERPNext'ten çek
  const fetchCompanyTypes = useCallback(async () => {
    if (hasLoadedCompanyTypes.current) return;
    
    setLoadingCompanyTypes(true);
    setError("");
    
    try {
      const res = await fetch("/api/erp/get-company-types");
      const data = await res.json();
      console.log("Company Types API response:", data);

      if (data.success && data.companyTypes) {
        console.log(`Loaded ${data.companyTypes.length} company types`);
        setCompanyTypes(data.companyTypes);
        hasLoadedCompanyTypes.current = true;
      } else {
        console.error("Company Types API error or invalid format:", data);
        if (data.error) {
          console.error("Error message:", data.error);
        }
        if (data.debug) {
          console.error("Debug info:", data.debug);
        }
        setError(data.error || "Failed to load company types");
      }
    } catch (error: any) {
      console.error("Error fetching company types:", error);
      setError("Failed to load company types. Please try again.");
    } finally {
      setLoadingCompanyTypes(false);
    }
  }, []);

  // Seçilen company type için gerekli belgeleri çek
  const fetchRequiredDocuments = useCallback(async (companyTypeName: string) => {
    if (!companyTypeName) {
      setRequiredDocuments([]);
      setDocumentData({});
      return;
    }

    setLoadingDocuments(true);
    setError("");

    try {
      const res = await fetch(`/api/erp/get-required-documents?companyType=${encodeURIComponent(companyTypeName)}`);
      const data = await res.json();

      if (data.success && data.requiredDocuments) {
        setRequiredDocuments(data.requiredDocuments);
        
        // Her belge için boş state oluştur
        const initialDocumentData: Record<string, DocumentData> = {};
        data.requiredDocuments.forEach((doc: RequiredDocument) => {
          if (doc.isDateField) {
            initialDocumentData[doc.id] = { date: "" };
          } else {
            initialDocumentData[doc.id] = { files: [] };
          }
        });
        setDocumentData(initialDocumentData);
        
      } else {
        setError(data.error || "Failed to load required documents");
        setRequiredDocuments([]);
      }
    } catch (error: any) {
      console.error("Error fetching required documents:", error);
      setError("Failed to load required documents. Please try again.");
      setRequiredDocuments([]);
    } finally {
      setLoadingDocuments(false);
    }
  }, []);

  // Company type değiştiğinde belgeleri çek
  useEffect(() => {
    if (selectedCompanyType) {
      fetchRequiredDocuments(selectedCompanyType);
    } else {
      setRequiredDocuments([]);
      setDocumentData({});
    }
  }, [selectedCompanyType, fetchRequiredDocuments]);

  // Mevcut Lead'den company type'ı yükle
  const loadDocumentsInfo = useCallback(async () => {
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
      if (!userEmail) {
        const localEmail = localStorage.getItem("userEmail");
        if (localEmail) userEmail = localEmail;
      }
    }

    if (!userEmail) {
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
        
        // Type of Company
        if (lead.custom_company_type) {
          setSelectedCompanyType(lead.custom_company_type);
        }
      }
    } catch (error) {
      console.error("Error loading documents info:", error);
    }
  }, []);

  useEffect(() => {
    if (formData.currentStep !== 4) {
      goToStep(4);
    }

    // Company type'ları yükle
    fetchCompanyTypes();
    
    // Mevcut Lead'den bilgileri yükle
    loadDocumentsInfo();
  }, [formData.currentStep, goToStep, fetchCompanyTypes, loadDocumentsInfo]);

  const handleFileSelect = (
    files: FileList | null,
    documentId: string,
    maxFiles: number = 5
  ) => {
    if (!files) return;

    const fileArray = Array.from(files);
    const validFiles = fileArray.filter((file) => {
      const isValidSize = file.size <= 5 * 1024 * 1024; // 5MB
      const isValidFormat = ["image/jpeg", "image/jpg", "image/png", "application/pdf"].includes(file.type);
      return isValidSize && isValidFormat;
    });

    setDocumentData((prev) => {
      const currentFiles = prev[documentId]?.files || [];
      const combined = [...currentFiles, ...validFiles];
      return {
        ...prev,
        [documentId]: {
          ...prev[documentId],
          files: combined.slice(0, maxFiles),
        },
      };
    });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (
    e: React.DragEvent,
    documentId: string,
    maxFiles: number = 5
  ) => {
    e.preventDefault();
    e.stopPropagation();
    handleFileSelect(e.dataTransfer.files, documentId, maxFiles);
  };

  const handleFileInputClick = (documentId: string) => {
    fileInputRefs.current[documentId]?.click();
  };

  const removeFile = (documentId: string, index: number) => {
    setDocumentData((prev) => {
      const currentFiles = prev[documentId]?.files || [];
      return {
        ...prev,
        [documentId]: {
          ...prev[documentId],
          files: currentFiles.filter((_, i) => i !== index),
        },
      };
    });
  };

  const handleDateChange = (documentId: string, date: string) => {
    setDocumentData((prev) => ({
      ...prev,
      [documentId]: {
        ...prev[documentId],
        date: date,
      },
    }));
  };

  const handleBack = () => {
    goToStep(1); // İlk sayfa: Services
    router.push("/register/services");
  };

  // Önceki sayfalardaki bilgilerin tamamlanıp tamamlanmadığını kontrol et
  const validatePreviousSteps = async (userEmail: string): Promise<{ isValid: boolean; missingFields: string[] }> => {
    try {
      const res = await fetch("/api/erp/get-lead", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: userEmail }),
      });

      const data = await res.json();
      if (!data.success || !data.lead) {
        return { isValid: false, missingFields: ["Lead not found. Please complete registration from the beginning."] };
      }

      const lead = data.lead;
      const missingFields: string[] = [];

      // Debug: Lead bilgilerini logla
      console.log("Validation - Lead data:", {
        company_name: lead.company_name,
        address_line1: lead.address_line1,
        city: lead.city,
        country: lead.country,
        pincode: lead.pincode,
        custom_tax_id: lead.custom_tax_id,
        custom_account_holder: lead.custom_account_holder,
        custom_iban: lead.custom_iban,
        custom_bic: lead.custom_bic,
        custom_selected_services: lead.custom_selected_services,
      });

      // NOT: Company Information ve Payment Information sayfaları henüz gelinmedi
      // Bu sayfalar Registration Documents'tan SONRA geliyor (3. ve 4. sayfalar)
      // Bu yüzden bu alanları kontrol etmiyoruz
      // PDF'den okunan bilgiler Company Information sayfasına yüklenecek
      
      // Sadece önceki sayfalardaki (Services - 1. sayfa) alanları kontrol et

      // Step 1: Services kontrolü (1. sayfa - Registration Documents'tan ÖNCE)
      let hasServices = false;
      
      // Yöntem 1: Child table kontrolü
      if (lead.services && Array.isArray(lead.services) && lead.services.length > 0) {
        hasServices = true;
      }
      
      // Yöntem 2: custom_selected_services field'ı kontrolü (JSON array)
      if (!hasServices && lead.custom_selected_services) {
        try {
          const services = typeof lead.custom_selected_services === 'string' 
            ? JSON.parse(lead.custom_selected_services)
            : lead.custom_selected_services;
          
          if (Array.isArray(services) && services.length > 0) {
            hasServices = true;
          }
        } catch (e) {
          // JSON parse hatası, virgülle ayrılmış string olabilir
          const servicesStr = String(lead.custom_selected_services).trim();
          if (servicesStr && servicesStr !== "[]" && servicesStr !== "") {
            const servicesList = servicesStr.split(",").filter(s => s.trim());
            if (servicesList.length > 0) {
              hasServices = true;
            }
          }
        }
      }
      
      // Eğer Lead'de yoksa, localStorage'dan kontrol et
      if (!hasServices) {
        try {
          const storedServices = localStorage.getItem("selectedServices");
          if (storedServices) {
            const services = JSON.parse(storedServices);
            if (Array.isArray(services) && services.length > 0) {
              hasServices = true;
              console.log("✅ Services found in localStorage:", services.length);
            }
          }
        } catch (e) {
          console.error("Error parsing localStorage services:", e);
        }
      }
      
      // Servis seçimi OPSIYONEL - zorunlu değil
      if (!hasServices) {
        console.warn("⚠️ No services selected - this is optional");
        // missingFields.push("At least one Service (Services page)"); // KALDIRILDI - zorunlu değil
      }

      return {
        isValid: missingFields.length === 0,
        missingFields,
      };
    } catch (error) {
      console.error("Error validating previous steps:", error);
      return { isValid: false, missingFields: ["Could not validate previous steps. Please try again."] };
    }
  };

  const handleNext = async () => {
    // Validation
    if (!selectedCompanyType) {
      setError("Please select a company type before proceeding.");
      alert("Please select a company type");
      return;
    }

    // Her required document için validation
    const missingDocuments: string[] = [];
    for (const doc of requiredDocuments) {
      if (doc.isRequired) {
        if (doc.isDateField) {
          if (!documentData[doc.id]?.date) {
            missingDocuments.push(doc.documentName);
          }
        } else {
          if (!documentData[doc.id]?.files || documentData[doc.id].files!.length === 0) {
            missingDocuments.push(doc.documentName);
          }
        }
      }
    }

    if (missingDocuments.length > 0) {
      const errorMessage = `Please upload/fill in the following required documents:\n\n${missingDocuments.map((doc, index) => `${index + 1}. ${doc}`).join("\n")}\n\nAll required documents must be uploaded before you can proceed.`;
      setError(errorMessage);
      alert(errorMessage);
      return;
    }

    // Loading state'i aktif et
    setSubmitting(true);
    setError("");

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
      if (!userEmail) {
        const localEmail = localStorage.getItem("userEmail");
        if (localEmail) userEmail = localEmail;
      }
    }

    if (!userEmail) {
      alert("User email not found. Please login again.");
      setSubmitting(false);
      return;
    }

    // Business Registration belgesine yüklenen PDF'i ÖNCE oku (eğer varsa)
    const businessRegistrationDoc = requiredDocuments.find(
      (doc) => doc.documentName.toLowerCase().includes("business registration")
    );
    
    if (businessRegistrationDoc && documentData[businessRegistrationDoc.id]?.files && documentData[businessRegistrationDoc.id].files!.length > 0) {
      const pdfFile = documentData[businessRegistrationDoc.id].files![0];
      
      // PDF dosyası mı kontrol et
      if (pdfFile.type === "application/pdf" || pdfFile.name.toLowerCase().endsWith(".pdf")) {
        setParsingPdf(true);
        try {
          const pdfFormData = new FormData();
          pdfFormData.append("file", pdfFile);
          pdfFormData.append("companyTypeId", selectedCompanyType);

          const parseRes = await fetch("/api/openai/parse-pdf", {
            method: "POST",
            body: pdfFormData,
          });

          const parseData = await parseRes.json();

          if (parseData.success && parseData.companyInfo) {
            // Okunan bilgileri localStorage'a kaydet
            if (typeof window !== "undefined") {
              localStorage.setItem("parsedCompanyInfo", JSON.stringify(parseData.companyInfo));
            }
            
            // PDF'den okunan bilgileri direkt Lead'e de kaydet
            try {
              await fetch("/api/erp/update-lead", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  email: userEmail,
                  companyInfo: parseData.companyInfo
                }),
              });
            } catch (updateError) {
              // Devam et, localStorage'da zaten var
            }
          }
        } catch (parseError) {
          // Hata olsa bile devam et, kullanıcı manuel doldurabilir
        } finally {
          setParsingPdf(false);
        }
      }
    }

    // NOT: Validation'ı kaldırdık çünkü Company Information ve Payment Information sayfaları henüz gelinmedi
    // Bu sayfalar Registration Documents'tan SONRA geliyor
    // PDF'den okunan bilgiler Company Information sayfasına yüklenecek

    try {
      // File'ları FormData ile göndermek için hazırla
      const formDataToSend = new FormData();
      formDataToSend.append("email", userEmail);
      
      // documentData'dan File objelerini çıkar, sadece metadata'yı gönder
      const serializableDocumentData: Record<string, { files?: { name: string }[]; date?: string }> = {};
      Object.keys(documentData).forEach((docId) => {
        const doc = documentData[docId];
        if (doc.files && doc.files.length > 0) {
          serializableDocumentData[docId] = {
            files: doc.files.map(file => ({ name: file.name })),
            date: doc.date,
          };
        } else if (doc.date) {
          serializableDocumentData[docId] = {
            date: doc.date,
          };
        }
      });
      
      const selectedCompany = companyTypes.find(ct => ct.id === selectedCompanyType);
      formDataToSend.append("documents", JSON.stringify({
        typeOfCompany: selectedCompanyType,
        typeOfCompanyName: selectedCompany?.name || "",
        documentData: serializableDocumentData,
        isCompleted: false, // Henüz tamamlanmadı, son sayfada tamamlanacak
      }));

      // Her belge için file'ları ekle
      Object.keys(documentData).forEach((docId) => {
        const doc = documentData[docId];
        if (doc.files && doc.files.length > 0) {
          doc.files.forEach((file, index) => {
            formDataToSend.append(`document_${docId}_${index}`, file);
          });
        }
        if (doc.date) {
          formDataToSend.append(`document_${docId}_date`, doc.date);
        }
      });

      const res = await fetch("/api/erp/update-lead", {
        method: "POST",
        body: formDataToSend,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: "Server error" }));
        throw new Error(errorData.error || `HTTP ${res.status}`);
      }

      const data = await res.json();

      if (data.success) {
        // Belgeler kaydedildi, payment-information sayfasına git
        setError(""); // Clear any previous errors
        goToStep(3); // Üçüncü sayfa: Payment Information
        router.push("/register/payment-information");
      } else {
        console.error("Update lead error:", data);
        const errorMsg = data.error || "Failed to save documents";
        setError(errorMsg);
        alert(errorMsg);
      }
    } catch (error: any) {
      console.error("Error uploading documents:", error);
      console.error("Error details:", error.message, error.stack);
      const errorMessage = error.message || "Please try again.";
      setError(errorMessage);
      alert(`Failed to upload documents: ${errorMessage}`);
    } finally {
      setSubmitting(false);
    }
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
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Registration Documents</h1>
              <p className="text-sm text-gray-600">
                Please upload the required documents to complete your registration
              </p>
            </div>

            {errorText && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                <div className="font-semibold mb-2">⚠️ Please complete the following:</div>
                <div className="whitespace-pre-line">{errorText}</div>
              </div>
            )}

            {/* PDF Parsing Loading */}
            {parsingPdf && (
              <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 text-sm flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-700"></div>
                <span>Business Registration Document okunuyor, lütfen bekleyin...</span>
              </div>
            )}

            <form className="space-y-8" onSubmit={(e) => e.preventDefault()}>
              {/* Type of Company */}
              <div className="space-y-2">
                <Label htmlFor="companyType" className="text-sm font-semibold text-gray-700">
                  Type of Company <span className="text-red-500">*</span>
                </Label>
                <select
                  id="companyType"
                  value={selectedCompanyType}
                  onChange={(e) => setSelectedCompanyType(e.target.value)}
                  disabled={loadingCompanyTypes}
                  className="w-full h-10 px-3 rounded-md border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                >
                  <option value="">
                    {loadingCompanyTypes ? "Loading..." : "Select"}
                  </option>
                  {companyTypes.map((ct) => (
                    <option key={ct.id} value={ct.id}>
                      {ct.name}
                    </option>
                  ))}
                </select>
                {selectedCompanyType && companyTypes.find((ct) => ct.id === selectedCompanyType)?.description && (
                  <p className="text-xs text-gray-500 mt-1">
                    {companyTypes.find((ct) => ct.id === selectedCompanyType)?.description}
                  </p>
                )}
              </div>

              {/* Required Documents */}
              {loadingDocuments && (
                <div className="text-center py-4 text-gray-600">
                  Loading required documents...
                </div>
              )}

              {!loadingDocuments && requiredDocuments.length > 0 && (
                <div className="space-y-8">
                  {requiredDocuments.map((doc) => (
                    <div key={doc.id} className="space-y-4">
                      <div className="space-y-2">
                        <Label className="text-sm font-semibold text-gray-700">
                          {doc.documentName} {doc.isRequired && <span className="text-red-500">*</span>}
                        </Label>
                        {doc.isDateField ? (
                          // Date Field
                          <div className="space-y-2">
                            <Input
                              type="date"
                              value={documentData[doc.id]?.date || ""}
                              onChange={(e) => handleDateChange(doc.id, e.target.value)}
                              className="w-full h-10 px-3 rounded-md border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                              required={doc.isRequired}
                            />
                            <p className="text-xs text-gray-500">
                              {doc.dateFieldLabel}
                            </p>
                          </div>
                        ) : (
                          // File Upload Field
                          <>
                            <p
                              style={{
                                fontFamily: 'SF Pro Text',
                                fontWeight: 'normal',
                                fontSize: '13px',
                                lineHeight: '15px',
                                color: '#d4d8de',
                                letterSpacing: '0',
                              }}
                            >
                              You can upload multiple files - up to {doc.maxFiles} files are possible.
                              Allowed formats: {doc.allowedFileTypes}
                            </p>

                            <div
                              className="w-full max-w-2xl border-2 border-dashed border-green-500 rounded-lg text-center cursor-pointer hover:bg-green-50 transition-colors flex flex-col items-center justify-center py-8 px-4 min-h-[153px]"
                              onDragOver={handleDragOver}
                              onDrop={(e) => handleDrop(e, doc.id, doc.maxFiles)}
                              onClick={() => handleFileInputClick(doc.id)}
                            >
                              <p className="text-sm text-gray-600 mb-2">Drag and drop files here</p>
                              <p className="text-sm text-gray-600 mb-4">or</p>
                              <div className="flex flex-col items-center gap-2">
                                <Button
                                  type="button"
                                  variant="default"
                                  className="text-white hover:opacity-90"
                                  style={{
                                    backgroundColor: '#111827',
                                    borderRadius: '10px',
                                    width: '63px',
                                    height: '24px',
                                    fontSize: '14px',
                                    padding: '0',
                                  }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleFileInputClick(doc.id);
                                  }}
                                >
                                  Upload
                                </Button>
                                <p className="text-xs" style={{ color: '#F4A023' }}>
                                  Maximum file size: 5MB. Accepted formats: {doc.allowedFileTypes}.
                                </p>
                              </div>
                              <input
                                ref={(el) => {
                                  fileInputRefs.current[doc.id] = el;
                                }}
                                type="file"
                                multiple
                                accept=".pdf,.jpg,.jpeg,.png"
                                className="hidden"
                                onChange={(e) => handleFileSelect(e.target.files, doc.id, doc.maxFiles)}
                              />
                            </div>

                            {documentData[doc.id]?.files && documentData[doc.id].files!.length > 0 && (
                              <div className="space-y-2">
                                {documentData[doc.id].files!.map((file, index) => (
                                  <div
                                    key={index}
                                    className="flex items-center justify-between p-2 bg-gray-50 rounded border"
                                  >
                                    <span className="text-sm text-gray-700 truncate flex-1">{file.name}</span>
                                    <button
                                      type="button"
                                      onClick={() => removeFile(doc.id, index)}
                                      className="text-red-500 hover:text-red-700 text-sm ml-2"
                                    >
                                      Remove
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {!loadingDocuments && selectedCompanyType && requiredDocuments.length === 0 && (
                <div className="text-center py-4 text-gray-600">
                  No required documents found for this company type.
                </div>
              )}

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
                <RegisterButton type="button" onClick={handleNext} disabled={!selectedCompanyType || requiredDocuments.length === 0 || submitting || parsingPdf}>
                  {parsingPdf ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      PDF Okunuyor...
                    </>
                  ) : submitting ? (
                    "Uploading..."
                  ) : (
                    "Next"
                  )}
                </RegisterButton>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
