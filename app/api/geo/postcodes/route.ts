import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// Haversine formula ile iki nokta arasındaki mesafeyi hesapla (km)
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Almanya postcodes için yaklaşık koordinat tahminleri (ilk 2 hane bazlı)
const germanPostcodeRegions: { [key: string]: { lat: number; lng: number } } = {
  "01": { lat: 51.05, lng: 13.74 }, // Dresden
  "04": { lat: 51.34, lng: 12.37 }, // Leipzig
  "10": { lat: 52.52, lng: 13.40 }, // Berlin
  "12": { lat: 52.48, lng: 13.43 }, // Berlin
  "13": { lat: 52.55, lng: 13.35 }, // Berlin
  "14": { lat: 52.40, lng: 13.06 }, // Potsdam
  "20": { lat: 53.55, lng: 10.00 }, // Hamburg
  "21": { lat: 53.47, lng: 9.98 },  // Hamburg
  "22": { lat: 53.57, lng: 10.03 }, // Hamburg
  "23": { lat: 53.87, lng: 10.69 }, // Lübeck
  "24": { lat: 54.32, lng: 10.14 }, // Kiel
  "25": { lat: 53.87, lng: 9.00 },  // Schleswig-Holstein
  "26": { lat: 53.14, lng: 8.22 },  // Oldenburg
  "27": { lat: 53.08, lng: 8.80 },  // Bremen
  "28": { lat: 53.08, lng: 8.80 },  // Bremen
  "29": { lat: 52.97, lng: 9.75 },  // Celle
  "30": { lat: 52.37, lng: 9.74 },  // Hannover
  "31": { lat: 52.15, lng: 9.95 },  // Hildesheim
  "32": { lat: 52.02, lng: 8.53 },  // Bielefeld
  "33": { lat: 51.93, lng: 8.53 },  // Bielefeld
  "34": { lat: 51.31, lng: 9.50 },  // Kassel
  "35": { lat: 50.58, lng: 8.67 },  // Gießen
  "36": { lat: 50.55, lng: 9.68 },  // Fulda
  "37": { lat: 51.53, lng: 9.93 },  // Göttingen
  "38": { lat: 52.27, lng: 10.52 }, // Braunschweig
  "39": { lat: 52.13, lng: 11.63 }, // Magdeburg
  "40": { lat: 51.23, lng: 6.78 },  // Düsseldorf
  "41": { lat: 51.19, lng: 6.44 },  // Mönchengladbach
  "42": { lat: 51.26, lng: 7.15 },  // Wuppertal
  "44": { lat: 51.51, lng: 7.47 },  // Dortmund
  "45": { lat: 51.45, lng: 7.01 },  // Essen
  "46": { lat: 51.54, lng: 6.76 },  // Oberhausen
  "47": { lat: 51.43, lng: 6.76 },  // Duisburg
  "48": { lat: 51.96, lng: 7.63 },  // Münster
  "49": { lat: 52.28, lng: 8.05 },  // Osnabrück
  "50": { lat: 50.94, lng: 6.96 },  // Köln
  "51": { lat: 50.93, lng: 7.10 },  // Köln
  "52": { lat: 50.78, lng: 6.08 },  // Aachen
  "53": { lat: 50.73, lng: 7.10 },  // Bonn
  "54": { lat: 49.76, lng: 6.64 },  // Trier
  "55": { lat: 50.00, lng: 8.27 },  // Mainz
  "56": { lat: 50.36, lng: 7.59 },  // Koblenz
  "57": { lat: 50.87, lng: 8.02 },  // Siegen
  "58": { lat: 51.36, lng: 7.47 },  // Hagen
  "59": { lat: 51.67, lng: 7.82 },  // Hamm
  "60": { lat: 50.11, lng: 8.68 },  // Frankfurt
  "61": { lat: 50.13, lng: 8.92 },  // Frankfurt
  "63": { lat: 50.00, lng: 9.00 },  // Offenbach
  "64": { lat: 49.87, lng: 8.65 },  // Darmstadt
  "65": { lat: 50.08, lng: 8.24 },  // Wiesbaden
  "66": { lat: 49.24, lng: 7.00 },  // Saarbrücken
  "67": { lat: 49.45, lng: 8.45 },  // Ludwigshafen
  "68": { lat: 49.49, lng: 8.47 },  // Mannheim
  "69": { lat: 49.41, lng: 8.69 },  // Heidelberg
  "70": { lat: 48.78, lng: 9.18 },  // Stuttgart
  "71": { lat: 48.74, lng: 9.32 },  // Stuttgart
  "72": { lat: 48.52, lng: 9.05 },  // Tübingen
  "73": { lat: 48.80, lng: 9.48 },  // Esslingen
  "74": { lat: 49.14, lng: 9.22 },  // Heilbronn
  "75": { lat: 48.89, lng: 8.70 },  // Pforzheim
  "76": { lat: 49.01, lng: 8.40 },  // Karlsruhe
  "77": { lat: 48.47, lng: 7.95 },  // Offenburg
  "78": { lat: 47.99, lng: 8.22 },  // Villingen
  "79": { lat: 47.99, lng: 7.85 },  // Freiburg
  "80": { lat: 48.14, lng: 11.58 }, // München
  "81": { lat: 48.11, lng: 11.55 }, // München
  "82": { lat: 48.15, lng: 11.35 }, // Starnberg
  "83": { lat: 47.85, lng: 12.13 }, // Rosenheim
  "84": { lat: 48.25, lng: 12.95 }, // Landshut
  "85": { lat: 48.40, lng: 11.75 }, // Freising
  "86": { lat: 48.37, lng: 10.90 }, // Augsburg
  "87": { lat: 47.73, lng: 10.32 }, // Kempten
  "88": { lat: 47.66, lng: 9.48 },  // Friedrichshafen
  "89": { lat: 48.40, lng: 10.00 }, // Ulm
  "90": { lat: 49.45, lng: 11.08 }, // Nürnberg
  "91": { lat: 49.60, lng: 11.00 }, // Erlangen
  "92": { lat: 49.02, lng: 12.10 }, // Regensburg
  "93": { lat: 49.02, lng: 12.10 }, // Regensburg
  "94": { lat: 48.57, lng: 13.43 }, // Passau
  "95": { lat: 50.08, lng: 11.95 }, // Hof
  "96": { lat: 50.10, lng: 10.88 }, // Bamberg
  "97": { lat: 49.79, lng: 9.95 },  // Würzburg
  "98": { lat: 50.98, lng: 11.03 }, // Erfurt
  "99": { lat: 50.98, lng: 11.03 }, // Erfurt
};

// Bir postcode bölgesindeki yaklaşık postcodes'ları hesapla
function generateNearbyPostcodes(centerPostcode: string, centerLat: number, centerLng: number, radiusKm: number): string[] {
  const postcodes: string[] = [];
  const baseCode = parseInt(centerPostcode);
  
  if (isNaN(baseCode)) return [centerPostcode];

  // Merkez postcode'u ekle
  postcodes.push(centerPostcode);

  // Radius'a göre aralık hesapla (yaklaşık olarak her 1km = 1-2 postcode)
  const range = Math.min(Math.ceil(radiusKm * 2), 100);

  for (let i = -range; i <= range; i++) {
    if (i === 0) continue;
    
    const newCode = baseCode + i;
    if (newCode >= 10000 && newCode <= 99999) {
      const codeStr = newCode.toString().padStart(5, "0");
      const prefix = codeStr.substring(0, 2);
      
      // Bu prefix için bilinen bir bölge var mı?
      const regionInfo = germanPostcodeRegions[prefix];
      if (regionInfo) {
        // Mesafeyi kontrol et (yaklaşık)
        const distance = haversineDistance(centerLat, centerLng, regionInfo.lat, regionInfo.lng);
        if (distance <= radiusKm * 1.5) { // Biraz tolerans ekle
          postcodes.push(codeStr);
        }
      } else {
        // Bilinmeyen bölge, yakın numaraları ekle
        if (Math.abs(i) <= range / 2) {
          postcodes.push(codeStr);
        }
      }
    }
  }

  return Array.from(new Set(postcodes)).sort();
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { postcode, radius } = body;

    if (!postcode) {
      return NextResponse.json(
        { error: "Postcode is required" },
        { status: 400 }
      );
    }

    const radiusKm = radius || 5;

    // 1. Önce verilen postcode'un koordinatlarını bul (Nominatim)
    const geocodeUrl = `https://nominatim.openstreetmap.org/search?postalcode=${encodeURIComponent(postcode)}&country=Germany&format=json&limit=1`;
    
    let centerLat: number;
    let centerLng: number;

    try {
      const geocodeRes = await fetch(geocodeUrl, {
        headers: {
          "User-Agent": "POS-Registration-App/1.0",
          "Accept-Language": "en",
        },
      });

      if (geocodeRes.ok) {
        const geocodeData = await geocodeRes.json();

        if (geocodeData && geocodeData.length > 0) {
          centerLat = parseFloat(geocodeData[0].lat);
          centerLng = parseFloat(geocodeData[0].lon);
        } else {
          // Nominatim'den sonuç yok, prefix'e göre tahmin et
          const prefix = postcode.toString().substring(0, 2);
          const regionInfo = germanPostcodeRegions[prefix];
          if (regionInfo) {
            centerLat = regionInfo.lat;
            centerLng = regionInfo.lng;
          } else {
            // Default: Hamburg
            centerLat = 53.5511;
            centerLng = 9.9937;
          }
        }
      } else {
        throw new Error("Geocode request failed");
      }
    } catch (geoError) {
      // Nominatim hatası, prefix'e göre tahmin et
      const prefix = postcode.toString().substring(0, 2);
      const regionInfo = germanPostcodeRegions[prefix];
      if (regionInfo) {
        centerLat = regionInfo.lat;
        centerLng = regionInfo.lng;
      } else {
        centerLat = 53.5511;
        centerLng = 9.9937;
      }
    }

    // 2. Overpass API ile çevredeki postcodes'ları bul
    let postcodes: string[] = [];
    
    try {
      const radiusMeters = radiusKm * 1000;
      const overpassQuery = `
        [out:json][timeout:10];
        (
          node["postal_code"](around:${radiusMeters},${centerLat},${centerLng});
          way["postal_code"](around:${radiusMeters},${centerLat},${centerLng});
          node["addr:postcode"](around:${radiusMeters},${centerLat},${centerLng});
          way["addr:postcode"](around:${radiusMeters},${centerLat},${centerLng});
        );
        out tags;
      `;

      const overpassUrl = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(overpassQuery)}`;
      
      const overpassRes = await fetch(overpassUrl, {
        headers: {
          "User-Agent": "POS-Registration-App/1.0",
        },
        signal: AbortSignal.timeout(8000), // 8 saniye timeout
      });

      if (overpassRes.ok) {
        const overpassData = await overpassRes.json();
        
        const postcodeSet = new Set<string>();
        
        if (overpassData.elements) {
          overpassData.elements.forEach((element: any) => {
            if (element.tags) {
              if (element.tags["postal_code"]) {
                postcodeSet.add(element.tags["postal_code"]);
              }
              if (element.tags["addr:postcode"]) {
                postcodeSet.add(element.tags["addr:postcode"]);
              }
            }
          });
        }

        postcodes = Array.from(postcodeSet);
      }
    } catch (overpassError) {
      console.log("Overpass API error, using fallback:", overpassError);
    }

    // 3. Eğer Overpass'tan yeterli sonuç gelmezse, yakın postcodes'ları tahmin et
    if (postcodes.length < 10) {
      const generatedPostcodes = generateNearbyPostcodes(postcode, centerLat, centerLng, radiusKm);
      postcodes = Array.from(new Set([...postcodes, ...generatedPostcodes]));
    }

    // Sırala ve limit uygula
    postcodes = postcodes.sort().slice(0, 200);

    return NextResponse.json({
      success: true,
      center: {
        lat: centerLat,
        lng: centerLng,
      },
      postcodes: postcodes,
      count: postcodes.length,
    });
  } catch (error: any) {
    console.error("Postcodes API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch postcodes", details: error.message },
      { status: 500 }
    );
  }
}
