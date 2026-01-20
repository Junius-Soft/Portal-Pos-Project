import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import { tmpdir } from "os";
import path from "path";

// Node.js runtime kullan
export const runtime = "nodejs";

// PDF'den metin çıkarmak için pdf2json kullan
async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  // Geçici dosya oluştur
  const tempDir = tmpdir();
  const tempFile = path.join(tempDir, `pdf_${Date.now()}.pdf`);
  
  try {
    // Buffer'ı geçici dosyaya yaz
    await fs.writeFile(tempFile, buffer);
    
    // pdf2json'u dinamik olarak import et
    const PDFParser = (await import("pdf2json")).default;
    
    return new Promise((resolve, reject) => {
      const pdfParser = new PDFParser();
      
      pdfParser.on("pdfParser_dataError", (errData: any) => {
        reject(new Error(errData.parserError || "PDF parsing failed"));
      });
      
      pdfParser.on("pdfParser_dataReady", (pdfData: any) => {
        try {
          // PDF verilerinden metin çıkar
          let text = "";
          if (pdfData && pdfData.Pages) {
            for (const page of pdfData.Pages) {
              if (page.Texts) {
                for (const textItem of page.Texts) {
                  if (textItem.R) {
                    for (const run of textItem.R) {
                      if (run.T) {
                        // URL decode yap
                        text += decodeURIComponent(run.T) + " ";
                      }
                    }
                  }
                }
              }
              text += "\n";
            }
          }
          resolve(text.trim());
        } catch (err) {
          reject(err);
        }
      });
      
      pdfParser.loadPDF(tempFile);
    });
  } finally {
    // Geçici dosyayı sil
    try {
      await fs.unlink(tempFile);
    } catch {
      // Silme hatası olursa ignore et
    }
  }
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const companyTypeId = formData.get("companyTypeId") as string;

    if (!file) {
      return NextResponse.json(
        { error: "PDF file is required" },
        { status: 400 }
      );
    }

    if (!companyTypeId) {
      return NextResponse.json(
        { error: "Company type ID is required" },
        { status: 400 }
      );
    }

    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      return NextResponse.json(
        { error: "OpenAI API key is not configured" },
        { status: 500 }
      );
    }

    // PDF'i ArrayBuffer'a çevir
    const arrayBuffer = await file.arrayBuffer();
    const pdfBuffer = Buffer.from(arrayBuffer);

    // PDF'den metin çıkar
    let pdfText: string;
    try {
      pdfText = await extractTextFromPdf(pdfBuffer);
      
      if (!pdfText || pdfText.trim().length === 0) {
        return NextResponse.json(
          { error: "No text could be extracted from PDF. The PDF might be image-based or corrupted." },
          { status: 400 }
        );
      }
    } catch (pdfError: any) {
      console.error("PDF text extraction error:", pdfError);
      return NextResponse.json(
        { 
          error: "Failed to extract text from PDF", 
          details: pdfError.message || String(pdfError)
        },
        { status: 500 }
      );
    }
    
    // İlk 8000 karakteri al
    const textToSend = pdfText.substring(0, 8000);

    // OpenAI API'ye istek gönder
    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openaiApiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content: `You are an expert at extracting company information from business registration documents. 
              Extract all relevant information from the document text and return ONLY a valid JSON object with the following structure:
              {
                "companyName": "string (main company/legal entity name)",
                "vatIdentificationNumber": "string (VAT number, USt-IdNr, Umsatzsteuer-ID)",
                "taxIdNumber": "string (Tax ID, Steuernummer)",
                "restaurantCount": "string (number of restaurants/locations as string)",
                "street": "string (full street address with house number)",
                "city": "string",
                "postalCode": "string (zip code, PLZ)",
                "country": "string (country name in English)",
                "federalState": "string (state/province/Bundesland, optional)",
                "businessName": "string (business/trade name, Geschäftsbezeichnung)",
                "ownerDirector": "string (owner/managing director/Inhaber/Geschäftsführer full name)",
                "ownerEmail": "string (owner/director email if available)",
                "ownerTelephone": "string (owner/director phone/telephone if available)"
              }
              
              Important notes:
              - Look for "Inhaber", "Geschäftsführer", "Owner", "Managing Director", "Betriebsinhaber" for owner/director name
              - Look for "Steuernummer", "St.-Nr." for tax ID
              - Look for "USt-IdNr", "Umsatzsteuer-Identifikationsnummer" for VAT number
              - If a field cannot be found in the document, use an empty string
              - Always return valid JSON, no additional text or explanations.`,
            },
            {
              role: "user",
              content: `Extract company information from this business registration document. Company Type ID: ${companyTypeId}.

PDF Document Text:
${textToSend}

Please extract all relevant company information from the text above.`,
            },
          ],
          temperature: 0.3,
          response_format: { type: "json_object" },
          max_tokens: 2000,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("OpenAI API error:", errorData);
        return NextResponse.json(
          { error: "Failed to analyze PDF content", details: errorData },
          { status: response.status }
        );
      }

      const data = await response.json();
      const parsedInfo = JSON.parse(data.choices[0].message.content);

      return NextResponse.json({
        success: true,
        companyInfo: {
          companyName: parsedInfo.companyName || "",
          vatIdentificationNumber: parsedInfo.vatIdentificationNumber || "",
          taxIdNumber: parsedInfo.taxIdNumber || "",
          restaurantCount: parsedInfo.restaurantCount || "",
          street: parsedInfo.street || "",
          city: parsedInfo.city || "",
          zipCode: parsedInfo.postalCode || "",
          country: parsedInfo.country || "",
          federalState: parsedInfo.federalState || "",
          businessName: parsedInfo.businessName || "",
          ownerDirector: parsedInfo.ownerDirector || "",
          ownerEmail: parsedInfo.ownerEmail || "",
          ownerTelephone: parsedInfo.ownerTelephone || "",
        },
      });
    } catch (apiError: any) {
      console.error("OpenAI API error:", apiError);
      return NextResponse.json(
        { 
          error: "Failed to analyze PDF content", 
          details: apiError.message || String(apiError)
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("General error:", error);
    return NextResponse.json(
      { 
        error: "Failed to parse PDF", 
        details: error.message || String(error)
      },
      { status: 500 }
    );
  }
}
