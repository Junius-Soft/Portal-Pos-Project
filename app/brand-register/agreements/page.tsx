"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import RegisterButton from "@/components/RegisterButton";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import BrandProgressBar from "@/components/BrandProgressBar";
import { ArrowRight, AlertTriangle, Download } from "lucide-react";
import dynamic from "next/dynamic";
import { PDFDocument, rgb } from "pdf-lib";

// Signature Canvas dinamik import
const SignatureCanvas = dynamic(
  () => import("react-signature-canvas").then((mod) => mod.default || mod),
  {
    ssr: false,
  }
) as any;

interface BrandSelection {
  brandId: string;
  platforms: string[];
}

// Mock brand data - gerçekte API'den gelecek
const BRAND_AGREEMENTS: { [key: string]: { name: string; pdfUrl: string } } = {
  "burger-boost": { name: "Burger Boost", pdfUrl: "/agreements/business-registration.pdf" },
  "chickenico": { name: "Chickenico", pdfUrl: "/agreements/business-registration.pdf" },
  "doner-kapsalon": { name: "Döner Kapsalon", pdfUrl: "/agreements/business-registration.pdf" },
  "doner-menu": { name: "Doner menu", pdfUrl: "/agreements/business-registration.pdf" },
  "edel-weiss": { name: "Edel Weiss", pdfUrl: "/agreements/business-registration.pdf" },
  "crispy-chicken": { name: "Crispy Chicken", pdfUrl: "/agreements/business-registration.pdf" },
  "pizza-palace": { name: "Pizza Palace", pdfUrl: "/agreements/business-registration.pdf" },
};

export default function AgreementsPage() {
  const router = useRouter();
  const signatureRef = useRef<any>(null);
  const [selections, setSelections] = useState<BrandSelection[]>([]);
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [signedBrands, setSignedBrands] = useState<Set<string>>(new Set());

  // PDF State
  const [pdfBytes, setPdfBytes] = useState<ArrayBuffer | null>(null);
  const [signedPdfUrl, setSignedPdfUrl] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [signedPdfBlob, setSignedPdfBlob] = useState<Blob | null>(null);

  useEffect(() => {
    const savedSelections = localStorage.getItem("brandSelections");

    if (savedSelections) {
      const parsed = JSON.parse(savedSelections);
      setSelections(parsed);
      if (parsed.length > 0) {
        setSelectedBrand(parsed[0].brandId);
      }
    } else {
      router.push("/brand-register/brand-selection");
    }
  }, [router]);

  // PDF yükle
  const loadPdf = useCallback(async (brandId: string) => {
    const pdfUrl = BRAND_AGREEMENTS[brandId]?.pdfUrl;
    if (!pdfUrl) return;

    setPdfLoading(true);
    setPdfError(null);
    setSignedPdfUrl(null);

    try {
      const response = await fetch(pdfUrl);
      if (!response.ok) {
        throw new Error("PDF could not be loaded");
      }

      const arrayBuffer = await response.arrayBuffer();
      setPdfBytes(arrayBuffer);

      // Orijinal PDF'i göster
      const blob = new Blob([arrayBuffer], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      setSignedPdfUrl(url);
    } catch (err: any) {
      console.error("Error loading PDF:", err);
      setPdfError(err.message || "Failed to load PDF");
    } finally {
      setPdfLoading(false);
    }
  }, []);

  // Marka seçildiğinde PDF'i yükle
  useEffect(() => {
    if (selectedBrand) {
      loadPdf(selectedBrand);
    }
  }, [selectedBrand, loadPdf]);

  // PDF'e imza ekle
  const addSignatureToPdf = useCallback(async () => {
    if (!pdfBytes || !signatureData) return;

    try {
      const pdfDoc = await PDFDocument.load(pdfBytes);
      const pages = pdfDoc.getPages();
      const lastPage = pages[pages.length - 1];

      // İmza resmini yükle
      const signatureImageBytes = await fetch(signatureData).then((res) =>
        res.arrayBuffer()
      );
      const signatureImage = await pdfDoc.embedPng(signatureImageBytes);

      // İmza boyutlarını ayarla
      const signatureDims = signatureImage.scale(0.25);

      // Son sayfanın sağ alt köşesine imza ekle
      const { width } = lastPage.getSize();
      const signatureX = width - signatureDims.width - 40;
      const signatureY = 40;

      lastPage.drawImage(signatureImage, {
        x: signatureX,
        y: signatureY,
        width: signatureDims.width,
        height: signatureDims.height,
      });

      // İmza altına tarih ve çizgi ekle
      const currentDate = new Date().toLocaleDateString("de-DE", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });

      // Çizgi çiz
      lastPage.drawLine({
        start: { x: signatureX, y: signatureY - 5 },
        end: { x: signatureX + signatureDims.width, y: signatureY - 5 },
        thickness: 1,
        color: rgb(0.3, 0.3, 0.3),
      });

      lastPage.drawText(`Signature - ${currentDate}`, {
        x: signatureX,
        y: signatureY - 18,
        size: 9,
        color: rgb(0.3, 0.3, 0.3),
      });

      // PDF'i kaydet
      const signedPdfBytes = await pdfDoc.save();
      const blob = new Blob([signedPdfBytes as BlobPart], { type: "application/pdf" });
      setSignedPdfBlob(blob);

      // URL oluştur ve göster
      const url = URL.createObjectURL(blob);
      setSignedPdfUrl(url);
    } catch (err) {
      console.error("Error adding signature to PDF:", err);
    }
  }, [pdfBytes, signatureData]);

  // İmza değiştiğinde PDF'i güncelle
  useEffect(() => {
    if (signatureData && pdfBytes) {
      addSignatureToPdf();
    } else if (pdfBytes && !signatureData) {
      // İmza temizlendiyse orijinal PDF'e dön
      const blob = new Blob([pdfBytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      setSignedPdfUrl(url);
      setSignedPdfBlob(null);
    }
  }, [signatureData, pdfBytes, addSignatureToPdf]);

  const clearSignature = () => {
    if (signatureRef.current) {
      signatureRef.current.clear();
      setSignatureData(null);
    }
  };

  const saveSignature = () => {
    if (signatureRef.current && !signatureRef.current.isEmpty()) {
      const dataUrl = signatureRef.current.toDataURL("image/png");
      setSignatureData(dataUrl);
      return dataUrl;
    }
    return null;
  };

  // İmza çizildiğinde otomatik kaydet
  const handleSignatureEnd = () => {
    saveSignature();
  };

  const handleViewAgreement = (brandId: string) => {
    setSelectedBrand(brandId);
  };

  const getBrandName = (brandId: string) => {
    return BRAND_AGREEMENTS[brandId]?.name || brandId;
  };

  const downloadSignedPdf = () => {
    if (signedPdfBlob && selectedBrand) {
      const link = document.createElement("a");
      link.href = URL.createObjectURL(signedPdfBlob);
      link.download = `${getBrandName(selectedBrand)}_signed_agreement.pdf`;
      link.click();
    }
  };

  const handleSubmit = async () => {
    if (!termsAccepted) {
      alert("Please accept the terms of use.");
      return;
    }

    if (!signatureData) {
      alert("Please provide your signature.");
      return;
    }

    setLoading(true);

    try {
      const signedData = {
        selections,
        signature: signatureData,
        termsAccepted,
        signedAt: new Date().toISOString(),
      };

      console.log("Submitting agreements:", signedData);

      // API'ye gönder (simüle)
      await new Promise((resolve) => setTimeout(resolve, 2000));

      alert("Agreements signed successfully!");

      localStorage.removeItem("brandSelections");
      localStorage.removeItem("deliveryMethod");
      localStorage.removeItem("businessRegions");
      localStorage.removeItem("weeklySchedule");
      localStorage.removeItem("holidayExceptions");

      router.push("/dashboard");
    } catch (error) {
      console.error("Error signing agreements:", error);
      alert("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    router.push("/brand-register/delivery-method");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <BrandProgressBar currentStep={3} />

      <div className="max-w-6xl mx-auto px-4 py-6">
        <Card className="shadow-lg">
          <CardContent className="pt-6">
            {/* Header */}
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Agreements
            </h1>
            <p className="text-gray-600 mb-6">
              Please read all contracts that have been drawn up and sign them after reviewing them.
            </p>

            {/* Main Content - Two Column */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* Left Side - Brand Agreements List */}
              <div>
                <h2 className="text-lg font-bold text-gray-900 mb-4">
                  Trademark Usage Agreement
                </h2>

                <div className="space-y-3">
                  {selections.map((selection) => {
                    const brandName = getBrandName(selection.brandId);
                    const isSelected = selectedBrand === selection.brandId;

                    return (
                      <div key={selection.brandId}>
                        <div className="font-medium text-gray-700 mb-1">
                          {brandName}
                        </div>
                        <button
                          onClick={() => handleViewAgreement(selection.brandId)}
                          className={`w-full flex items-center justify-between px-4 py-3 border rounded-lg transition-colors ${
                            isSelected
                              ? "border-orange-400 bg-orange-50"
                              : "border-gray-200 hover:border-gray-300 bg-white"
                          }`}
                        >
                          <span className="text-sm text-gray-600">
                            View trademark usage agreement
                          </span>
                          <ArrowRight className="w-4 h-4 text-gray-400" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right Side - PDF Viewer */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-700">
                    {selectedBrand ? `${getBrandName(selectedBrand)} - Agreement` : "PDF Preview"}
                  </h3>
                  {signedPdfBlob && (
                    <button
                      onClick={downloadSignedPdf}
                      className="flex items-center gap-1 text-sm text-orange-500 hover:text-orange-600"
                    >
                      <Download className="w-4 h-4" />
                      Download Signed PDF
                    </button>
                  )}
                </div>
                <div className="w-full h-[500px] bg-gray-100 rounded-lg border overflow-hidden">
                  {pdfLoading ? (
                    <div className="w-full h-full flex items-center justify-center">
                      <div className="text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto mb-2"></div>
                        <p className="text-gray-500">Loading PDF...</p>
                      </div>
                    </div>
                  ) : pdfError ? (
                    <div className="w-full h-full flex items-center justify-center">
                      <div className="text-center text-red-500">
                        <p className="font-medium mb-2">PDF yüklenemedi</p>
                        <p className="text-sm">{pdfError}</p>
                        <p className="text-xs mt-2 text-gray-500">
                          Lütfen PDF dosyasını public/agreements/ klasörüne koyun
                        </p>
                      </div>
                    </div>
                  ) : signedPdfUrl ? (
                    <embed
                      src={`${signedPdfUrl}#toolbar=1&navpanes=0&scrollbar=1`}
                      type="application/pdf"
                      className="w-full h-full"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <p className="text-gray-500">Select a brand to view its agreement</p>
                    </div>
                  )}
                </div>
                {signatureData && (
                  <p className="text-sm text-green-600 mt-2 text-center">
                    ✓ Signature applied to PDF (bottom-right corner)
                  </p>
                )}
              </div>
            </div>

            {/* Signature Section */}
            <div className="border-t pt-8">
              <h2 className="text-xl font-bold text-gray-900 mb-6">
                Signature
              </h2>

              {/* Terms of Use */}
              <div className="mb-6">
                <Label className="text-sm font-semibold text-gray-700">
                  Terms of Use *
                </Label>
                <div className="mt-2 p-4 bg-yellow-50 border border-yellow-200 rounded-lg max-h-40 overflow-y-auto">
                  <p className="text-sm text-gray-700">
                    By agreeing, you declare that you have read, fully understood, and legally accepted the Terms of Use. Furthermore, you acknowledge that the Terms may be updated periodically and that any continued use of the service constitutes acceptance of the currently valid version. You confirm that you have familiarized yourself with all regulations and accept them as the basis for our contractual cooperation.
                  </p>
                  <p className="text-sm text-gray-700 mt-3">
                    Furthermore, you declare that all information you have provided is accurate, complete, and up-to-date. You agree to take the necessary security measures to protect your account and to refrain from any form of misuse. You also agree that personal data may be processed in accordance with applicable data protection regulations and may be disclosed to third parties where legally required or necessary for the performance of the contract.
                  </p>
                </div>
              </div>

              {/* Terms Checkbox */}
              <div className="flex items-start space-x-3 mb-6">
                <Checkbox
                  id="termsAccepted"
                  checked={termsAccepted}
                  onCheckedChange={(checked) => setTermsAccepted(checked as boolean)}
                  className="mt-1"
                />
                <Label htmlFor="termsAccepted" className="text-sm text-gray-700 cursor-pointer">
                  I confirm that I have read and accepted all of the above-mentioned contracts and terms of use.
                </Label>
              </div>

              {/* Signature Pad */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-sm font-semibold text-gray-700">
                    Signature *
                  </Label>
                  <button
                    onClick={clearSignature}
                    className="text-sm text-orange-500 hover:text-orange-600"
                  >
                    Clear
                  </button>
                </div>
                <p className="text-sm text-gray-500 mb-2">
                  Please confirm the contracts by signing them. Your signature will appear on the PDF.
                </p>
                <div className="border-2 border-dashed border-gray-300 rounded-lg bg-white">
                  <SignatureCanvas
                    ref={signatureRef}
                    onEnd={handleSignatureEnd}
                    canvasProps={{
                      className: "w-full h-32 rounded-lg",
                      style: { width: "100%", height: "128px" },
                    }}
                    backgroundColor="white"
                  />
                </div>
              </div>

              {/* Important Note */}
              <div className="p-4 bg-yellow-100 border border-yellow-300 rounded-lg mb-6">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold text-gray-800">Important note</h4>
                    <p className="text-sm text-gray-700 mt-1">
                      Generating the contract documents may take approximately 1 to 1.5 minutes. Please be patient and do not close this window. You will be automatically redirected once the process is complete.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Navigation Buttons */}
            <div className="flex justify-between items-center">
              <Button
                onClick={handleBack}
                variant="outline"
                className="px-8"
              >
                Back
              </Button>
              <div className="flex flex-col items-end">
                <RegisterButton
                  type="button"
                  onClick={handleSubmit}
                  disabled={!termsAccepted || !signatureData || loading}
                >
                  {loading ? "Processing..." : "Next"}
                </RegisterButton>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
