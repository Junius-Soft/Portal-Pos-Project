"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { PDFDocument, rgb } from "pdf-lib";
import dynamic from "next/dynamic";

// Signature Canvas dinamik import
const SignatureCanvas = dynamic(() => import("react-signature-canvas"), {
  ssr: false,
});

interface PdfViewerWithSignatureProps {
  pdfUrl: string;
  onSignedPdf?: (signedPdfBlob: Blob) => void;
  signatureData?: string | null;
}

export default function PdfViewerWithSignature({
  pdfUrl,
  onSignedPdf,
  signatureData,
}: PdfViewerWithSignatureProps) {
  const [pdfBytes, setPdfBytes] = useState<ArrayBuffer | null>(null);
  const [signedPdfUrl, setSignedPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // PDF'i yükle
  useEffect(() => {
    const loadPdf = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(pdfUrl);
        if (!response.ok) {
          throw new Error("PDF could not be loaded");
        }

        const arrayBuffer = await response.arrayBuffer();
        setPdfBytes(arrayBuffer);

        // PDF sayfa sayısını al
        const pdfDoc = await PDFDocument.load(arrayBuffer);
        setTotalPages(pdfDoc.getPageCount());

        setLoading(false);
      } catch (err: any) {
        console.error("Error loading PDF:", err);
        setError(err.message || "Failed to load PDF");
        setLoading(false);
      }
    };

    if (pdfUrl) {
      loadPdf();
    }
  }, [pdfUrl]);

  // İmza eklendiğinde PDF'i güncelle
  const addSignatureToPdf = useCallback(async () => {
    if (!pdfBytes || !signatureData) return null;

    try {
      // PDF'i yükle
      const pdfDoc = await PDFDocument.load(pdfBytes);
      const pages = pdfDoc.getPages();
      const lastPage = pages[pages.length - 1];

      // İmza resmini yükle
      const signatureImageBytes = await fetch(signatureData).then((res) =>
        res.arrayBuffer()
      );
      const signatureImage = await pdfDoc.embedPng(signatureImageBytes);

      // İmza boyutlarını ayarla
      const signatureDims = signatureImage.scale(0.3);

      // Son sayfanın sağ alt köşesine imza ekle
      const { width, height } = lastPage.getSize();
      const signatureX = width - signatureDims.width - 50; // Sağdan 50px
      const signatureY = 50; // Alttan 50px

      lastPage.drawImage(signatureImage, {
        x: signatureX,
        y: signatureY,
        width: signatureDims.width,
        height: signatureDims.height,
      });

      // İmza altına tarih ekle
      const currentDate = new Date().toLocaleDateString("de-DE", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });

      lastPage.drawText(`Signed: ${currentDate}`, {
        x: signatureX,
        y: signatureY - 15,
        size: 8,
        color: rgb(0.3, 0.3, 0.3),
      });

      // PDF'i kaydet
      const signedPdfBytes = await pdfDoc.save();
      const blob = new Blob([signedPdfBytes as BlobPart], { type: "application/pdf" });

      // URL oluştur
      const url = URL.createObjectURL(blob);
      setSignedPdfUrl(url);

      if (onSignedPdf) {
        onSignedPdf(blob);
      }

      return url;
    } catch (err) {
      console.error("Error adding signature to PDF:", err);
      return null;
    }
  }, [pdfBytes, signatureData, onSignedPdf]);

  // İmza değiştiğinde PDF'i güncelle
  useEffect(() => {
    if (signatureData && pdfBytes) {
      addSignatureToPdf();
    } else {
      // İmza temizlendiyse orijinal PDF'e dön
      if (pdfBytes && !signatureData) {
        const blob = new Blob([pdfBytes], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        setSignedPdfUrl(url);
      }
    }
  }, [signatureData, pdfBytes, addSignatureToPdf]);

  // İlk yüklemede orijinal PDF'i göster
  useEffect(() => {
    if (pdfBytes && !signedPdfUrl) {
      const blob = new Blob([pdfBytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      setSignedPdfUrl(url);
    }
  }, [pdfBytes, signedPdfUrl]);

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto mb-2"></div>
          <p className="text-gray-500">Loading PDF...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100">
        <div className="text-center text-red-500">
          <p className="font-medium mb-2">Error loading PDF</p>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col">
      {/* PDF Viewer */}
      <div className="flex-1 bg-gray-200 rounded-lg overflow-hidden">
        {signedPdfUrl ? (
          <iframe
            ref={iframeRef}
            src={`${signedPdfUrl}#toolbar=1&navpanes=0`}
            className="w-full h-full border-0"
            title="PDF Viewer"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <p className="text-gray-500">No PDF loaded</p>
          </div>
        )}
      </div>

      {/* Page Info */}
      {totalPages > 0 && (
        <div className="mt-2 text-center text-sm text-gray-500">
          {totalPages} page(s) {signatureData && "- Signature applied"}
        </div>
      )}
    </div>
  );
}
