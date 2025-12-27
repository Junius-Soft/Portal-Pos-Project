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

export default function RegistrationDocumentsPage() {
  const router = useRouter();
  const { formData, updateFormData, goToStep } = useRegistration();
  const [companyType, setCompanyType] = useState("");
  const [businessRegistrationFiles, setBusinessRegistrationFiles] = useState<FileWithPreview[]>([]);
  const [idFiles, setIdFiles] = useState<FileWithPreview[]>([]);
  const [shareholdersFiles, setShareholdersFiles] = useState<FileWithPreview[]>([]);

  const businessRegistrationInputRef = useRef<HTMLInputElement>(null);
  const idInputRef = useRef<HTMLInputElement>(null);
  const shareholdersInputRef = useRef<HTMLInputElement>(null);

  const loadDocumentsInfo = useCallback(async () => {
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
        
        // Type of Company
        if (lead.custom_type_of_company) {
          setCompanyType(lead.custom_type_of_company);
        }

        // File arrays (JSON string'lerden parse et)
        if (lead.businessRegistrationFiles && Array.isArray(lead.businessRegistrationFiles) && lead.businessRegistrationFiles.length > 0) {
          // File URL'lerini File objelerine çeviremeyiz, ama en azından state'i güncelleyebiliriz
          // Şimdilik sadece type of company'yi yükleyelim, file'lar için ayrı bir çözüm gerekebilir
        }
        if (lead.idFiles && Array.isArray(lead.idFiles) && lead.idFiles.length > 0) {
          // Aynı şekilde
        }
        if (lead.shareholdersFiles && Array.isArray(lead.shareholdersFiles) && lead.shareholdersFiles.length > 0) {
          // Aynı şekilde
        }
        // Not: File'ları geri yüklemek için URL'lerden File objesi oluşturmak gerekir, bu daha karmaşık
        // Şimdilik sadece type of company'yi yükleyelim
      }
    } catch (error) {
      console.error("Error loading documents info:", error);
      // Hata olsa bile devam et
    }
  }, []);

  useEffect(() => {
    // Ensure we're on step 4
    if (formData.currentStep !== 4) {
      goToStep(4);
    }

    // Load documents information from Lead if available
    loadDocumentsInfo();
  }, [formData.currentStep, goToStep, loadDocumentsInfo]);

  const handleFileSelect = (
    files: FileList | null,
    setFiles: React.Dispatch<React.SetStateAction<FileWithPreview[]>>,
    maxFiles: number = 5
  ) => {
    if (!files) return;

    const fileArray = Array.from(files);
    const validFiles = fileArray.filter((file) => {
      const isValidSize = file.size <= 5 * 1024 * 1024; // 5MB
      const isValidFormat = ["image/jpeg", "image/jpg", "image/png", "application/pdf"].includes(file.type);
      return isValidSize && isValidFormat;
    });

    setFiles((prev) => {
      const combined = [...prev, ...validFiles];
      return combined.slice(0, maxFiles);
    });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (
    e: React.DragEvent,
    setFiles: React.Dispatch<React.SetStateAction<FileWithPreview[]>>,
    maxFiles: number = 5
  ) => {
    e.preventDefault();
    e.stopPropagation();
    handleFileSelect(e.dataTransfer.files, setFiles, maxFiles);
  };

  const handleFileInputClick = (inputRef: React.RefObject<HTMLInputElement>) => {
    inputRef.current?.click();
  };

  const removeFile = (
    index: number,
    setFiles: React.Dispatch<React.SetStateAction<FileWithPreview[]>>
  ) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleBack = () => {
    goToStep(3);
    router.push("/register/payment-information");
  };

  const handleSubmit = () => {
    // Validation
    if (!companyType || businessRegistrationFiles.length === 0 || idFiles.length === 0 || shareholdersFiles.length === 0) {
      alert("Please fill in all required fields and upload all required documents");
      return;
    }

    // TODO: Upload files to server
    // TODO: Save data and complete registration
    alert("Registration completed successfully!");
    router.push("/");
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

            <form className="space-y-8" onSubmit={(e) => e.preventDefault()}>
              {/* Type of Company */}
              <div className="space-y-2">
                <Label htmlFor="companyType" className="text-sm font-semibold text-gray-700">
                  Type of Company <span className="text-red-500">*</span>
                </Label>
                <select
                  id="companyType"
                  value={companyType}
                  onChange={(e) => setCompanyType(e.target.value)}
                  className="w-full h-10 px-3 rounded-md border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="">Select</option>
                  <option value="LLC">LLC</option>
                  <option value="Corporation">Corporation</option>
                  <option value="Partnership">Partnership</option>
                  <option value="Sole Proprietorship">Sole Proprietorship</option>
                </select>
              </div>

              {/* Business Registration */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-gray-700">
                    Business Registration <span className="text-red-500">*</span>
                  </Label>
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
                    If your business registration consists of multiple pages, you can upload them as
                    individual files - up to 5 files are possible.
                  </p>
                </div>

                <div
                  className="border-2 border-dashed border-green-500 rounded-lg text-center cursor-pointer hover:bg-green-50 transition-colors flex flex-col items-center justify-center"
                  style={{
                    width: '641px',
                    height: '153px',
                  }}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, setBusinessRegistrationFiles, 5)}
                  onClick={() => handleFileInputClick(businessRegistrationInputRef)}
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
                        handleFileInputClick(businessRegistrationInputRef);
                      }}
                    >
                      Upload
                    </Button>
                    <p className="text-xs" style={{ color: '#F4A023' }}>
                      Maximum file size: 5MB. Accepted formats: PDF, JPG, PNG.
                    </p>
                  </div>
                  <input
                    ref={businessRegistrationInputRef}
                    type="file"
                    multiple
                    accept=".pdf,.jpg,.jpeg,.png"
                    className="hidden"
                    onChange={(e) => handleFileSelect(e.target.files, setBusinessRegistrationFiles, 5)}
                  />
                </div>

                {businessRegistrationFiles.length > 0 && (
                  <div className="space-y-2">
                    {businessRegistrationFiles.map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-2 bg-gray-50 rounded border"
                      >
                        <span className="text-sm text-gray-700 truncate flex-1">{file.name}</span>
                        <button
                          type="button"
                          onClick={() => removeFile(index, setBusinessRegistrationFiles)}
                          className="text-red-500 hover:text-red-700 text-sm ml-2"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ID */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-gray-700">
                    ID <span className="text-red-500">*</span>
                  </Label>
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
                    You can upload multiple files. If your ID card does not contain both the front
                    and back in one file, please upload both sides separately.
                  </p>
                </div>

                <div
                  className="border-2 border-dashed border-green-500 rounded-lg text-center cursor-pointer hover:bg-green-50 transition-colors flex flex-col items-center justify-center"
                  style={{
                    width: '641px',
                    height: '153px',
                  }}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, setIdFiles, 5)}
                  onClick={() => handleFileInputClick(idInputRef)}
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
                        handleFileInputClick(idInputRef);
                      }}
                    >
                      Upload
                    </Button>
                    <p className="text-xs" style={{ color: '#F4A023' }}>
                      Maximum file size: 5MB. Accepted formats: PDF, JPG, PNG.
                    </p>
                  </div>
                  <input
                    ref={idInputRef}
                    type="file"
                    multiple
                    accept=".pdf,.jpg,.jpeg,.png"
                    className="hidden"
                    onChange={(e) => handleFileSelect(e.target.files, setIdFiles, 5)}
                  />
                </div>

                {idFiles.length > 0 && (
                  <div className="space-y-2">
                    {idFiles.map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-2 bg-gray-50 rounded border"
                      >
                        <span className="text-sm text-gray-700 truncate flex-1">{file.name}</span>
                        <button
                          type="button"
                          onClick={() => removeFile(index, setIdFiles)}
                          className="text-red-500 hover:text-red-700 text-sm ml-2"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* List of Shareholders */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-gray-700">
                    List of Shareholders <span className="text-red-500">*</span>
                  </Label>
                </div>

                <div
                  className="border-2 border-dashed border-green-500 rounded-lg text-center cursor-pointer hover:bg-green-50 transition-colors flex flex-col items-center justify-center"
                  style={{
                    width: '641px',
                    height: '153px',
                  }}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, setShareholdersFiles, 5)}
                  onClick={() => handleFileInputClick(shareholdersInputRef)}
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
                        handleFileInputClick(shareholdersInputRef);
                      }}
                    >
                      Upload
                    </Button>
                    <p className="text-xs" style={{ color: '#F4A023' }}>
                      Maximum file size: 5MB. Accepted formats: PDF, JPG, PNG.
                    </p>
                  </div>
                  <input
                    ref={shareholdersInputRef}
                    type="file"
                    multiple
                    accept=".pdf,.jpg,.jpeg,.png"
                    className="hidden"
                    onChange={(e) => handleFileSelect(e.target.files, setShareholdersFiles, 5)}
                  />
                </div>

                {shareholdersFiles.length > 0 && (
                  <div className="space-y-2">
                    {shareholdersFiles.map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-2 bg-gray-50 rounded border"
                      >
                        <span className="text-sm text-gray-700 truncate flex-1">{file.name}</span>
                        <button
                          type="button"
                          onClick={() => removeFile(index, setShareholdersFiles)}
                          className="text-red-500 hover:text-red-700 text-sm ml-2"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
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
                <RegisterButton type="button" onClick={handleSubmit}>
                  Submit
                </RegisterButton>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
