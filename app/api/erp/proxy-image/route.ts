import { NextRequest, NextResponse } from "next/server";
import { formatToken } from "@/lib/erp";

/**
 * ERPNext'teki private dosyaları proxy ile geçirir
 * Bu sayede frontend'den authentication olmadan erişilebilir
 */
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    let imageUrl = searchParams.get("url");

    if (!imageUrl) {
      return NextResponse.json(
        { error: "URL parameter is required" },
        { status: 400 }
      );
    }

    // URL'i decode et
    imageUrl = decodeURIComponent(imageUrl);

    const token = process.env.ERP_API_TOKEN;
    const baseUrl = process.env.NEXT_PUBLIC_ERP_BASE_URL;

    if (!token || !baseUrl) {
      return NextResponse.json(
        { error: "ERP configuration is missing" },
        { status: 500 }
      );
    }

    // ERPNext'te /private/files/ path'i authentication ile erişilebilir
    // Path'i olduğu gibi kullan (değiştirme)
    
    // URL'i oluştur
    let fullUrl = imageUrl;
    if (!imageUrl.startsWith("http")) {
      // Eğer path /private/files/ ile başlıyorsa, base URL'e ekle
      fullUrl = `${baseUrl}${imageUrl}`;
    }

    console.log("🖼️ Fetching image:", fullUrl);
    console.log("  - Original URL:", searchParams.get("url"));
    console.log("  - Decoded URL:", imageUrl);

    // ERPNext'ten resmi çek (authentication ile)
    const formattedToken = formatToken(token);
    
    // Önce doğrudan path ile dene
    let response = await fetch(fullUrl, {
      headers: {
        'Authorization': formattedToken,
      },
      cache: 'no-store',
    });

    // Eğer 404 alırsak, /files/ endpoint'ini dene
    if (response.status === 404 && imageUrl.includes("/private/files/")) {
      const publicPath = imageUrl.replace("/private/files/", "/files/");
      const publicUrl = `${baseUrl}${publicPath}`;
      console.log("  - Trying public path:", publicUrl);
      
      response = await fetch(publicUrl, {
        headers: {
          'Authorization': formattedToken,
        },
        cache: 'no-store',
      });
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      console.error(`Failed to fetch image: ${response.status} ${response.statusText}`);
      console.error(`  - URL: ${fullUrl}`);
      console.error(`  - Error response: ${errorText.substring(0, 200)}`);
      return NextResponse.json(
        { error: `Failed to fetch image: ${response.status} ${response.statusText}` },
        { status: response.status }
      );
    }

    // Content-Type'ı al
    const contentType = response.headers.get("content-type") || "image/jpeg";
    console.log("✅ Image fetched successfully:", {
      status: response.status,
      contentType,
      url: fullUrl
    });

    // Resim verisini al
    const imageBuffer = await response.arrayBuffer();

    // Resmi döndür
    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400", // 1 gün cache
      },
    });
  } catch (error: any) {
    console.error("Proxy image error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to proxy image" },
      { status: 500 }
    );
  }
}
