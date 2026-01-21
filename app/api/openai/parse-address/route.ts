import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { addressText } = await req.json();

    if (!addressText || typeof addressText !== "string") {
      return NextResponse.json(
        { error: "Address text is required" },
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

    // OpenAI API'ye istek gönder
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini", // veya "gpt-3.5-turbo" daha ucuz
        messages: [
          {
            role: "system",
            content: `You are an address parsing assistant. Parse the given address text and extract structured address information. 
            Return ONLY a valid JSON object with the following fields:
            - street: string (street name and house number)
            - city: string
            - postalCode: string (zip code)
            - country: string (country name in English)
            - federalState: string (state/province, optional)
            
            If a field cannot be determined, use an empty string. Always return valid JSON, no additional text.`,
          },
          {
            role: "user",
            content: `Parse this address: ${addressText}`,
          },
        ],
        temperature: 0.3,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("OpenAI API error:", errorData);
      return NextResponse.json(
        { error: "Failed to parse address", details: errorData },
        { status: response.status }
      );
    }

    const data = await response.json();
    const parsedAddress = JSON.parse(data.choices[0].message.content);

    return NextResponse.json({
      success: true,
      address: {
        street: parsedAddress.street || "",
        city: parsedAddress.city || "",
        postalCode: parsedAddress.postalCode || "",
        country: parsedAddress.country || "",
        federalState: parsedAddress.federalState || "",
      },
    });
  } catch (error: any) {
    console.error("Error parsing address with OpenAI:", error);
    return NextResponse.json(
      { error: "Failed to parse address", details: error.message },
      { status: 500 }
    );
  }
}
