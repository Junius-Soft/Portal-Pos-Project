"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import RegisterButton from "@/components/RegisterButton";
import BrandProgressBar from "@/components/BrandProgressBar";

interface DeliveryPlatform {
  id: string;
  name: string;
}

interface Brand {
  id: string;
  name: string;
  image: string;
  deliveryPlatforms: DeliveryPlatform[];
}

// Örnek data - gerçekte API'den gelecek
const mockBrands: Brand[] = [
  {
    id: "burger-boost-1",
    name: "Burger Boost",
    image: "/brands/burger-boost.png",
    deliveryPlatforms: [
      { id: "lieferando", name: "Lieferando" },
      { id: "uber-eats", name: "Uber Eats" },
      { id: "wolt", name: "Wolt" },
      { id: "shop-in-shop", name: "Shop-in-shop" },
    ],
  },
  {
    id: "burger-boost-2",
    name: "Burger Boost",
    image: "/brands/burger-boost.png",
    deliveryPlatforms: [
      { id: "lieferando", name: "Lieferando" },
      { id: "uber-eats", name: "Uber Eats" },
      { id: "wolt", name: "Wolt" },
      { id: "shop-in-shop", name: "Shop-in-shop" },
    ],
  },
  {
    id: "burger-boost-3",
    name: "Burger Boost",
    image: "/brands/burger-boost.png",
    deliveryPlatforms: [
      { id: "lieferando", name: "Lieferando" },
      { id: "uber-eats", name: "Uber Eats" },
      { id: "wolt", name: "Wolt" },
      { id: "shop-in-shop", name: "Shop-in-shop" },
    ],
  },
  {
    id: "burger-boost-4",
    name: "Burger Boost",
    image: "/brands/burger-boost.png",
    deliveryPlatforms: [
      { id: "lieferando", name: "Lieferando" },
      { id: "uber-eats", name: "Uber Eats" },
      { id: "wolt", name: "Wolt" },
      { id: "shop-in-shop", name: "Shop-in-shop" },
    ],
  },
  {
    id: "burger-boost-5",
    name: "Burger Boost",
    image: "/brands/burger-boost.png",
    deliveryPlatforms: [
      { id: "lieferando", name: "Lieferando" },
      { id: "uber-eats", name: "Uber Eats" },
      { id: "wolt", name: "Wolt" },
      { id: "shop-in-shop", name: "Shop-in-shop" },
    ],
  },
  {
    id: "burger-boost-6",
    name: "Burger Boost",
    image: "/brands/burger-boost.png",
    deliveryPlatforms: [
      { id: "lieferando", name: "Lieferando" },
      { id: "uber-eats", name: "Uber Eats" },
      { id: "wolt", name: "Wolt" },
      { id: "shop-in-shop", name: "Shop-in-shop" },
    ],
  },
  {
    id: "burger-boost-7",
    name: "Burger Boost",
    image: "/brands/burger-boost.png",
    deliveryPlatforms: [
      { id: "lieferando", name: "Lieferando" },
      { id: "uber-eats", name: "Uber Eats" },
      { id: "wolt", name: "Wolt" },
      { id: "shop-in-shop", name: "Shop-in-shop" },
    ],
  },
  {
    id: "burger-boost-8",
    name: "Burger Boost",
    image: "/brands/burger-boost.png",
    deliveryPlatforms: [
      { id: "lieferando", name: "Lieferando" },
      { id: "uber-eats", name: "Uber Eats" },
      { id: "wolt", name: "Wolt" },
      { id: "shop-in-shop", name: "Shop-in-shop" },
    ],
  },
];

const MAX_PLATFORM_SELECTIONS = 3;

interface BrandSelection {
  brandId: string;
  platforms: string[];
}

export default function BrandSelectionPage() {
  const router = useRouter();
  const [brands] = useState<Brand[]>(mockBrands);
  const [selections, setSelections] = useState<BrandSelection[]>([]);
  const [loading, setLoading] = useState(false);

  // Her platform için kaç kez seçildiğini hesapla
  const getPlatformCount = (platformId: string): number => {
    let count = 0;
    selections.forEach((sel) => {
      if (sel.platforms.includes(platformId)) {
        count++;
      }
    });
    return count;
  };

  // Platform max'a ulaştı mı?
  const isPlatformMaxReached = (platformId: string): boolean => {
    return getPlatformCount(platformId) >= MAX_PLATFORM_SELECTIONS;
  };

  // Marka seçili mi?
  const isBrandSelected = (brandId: string): boolean => {
    return selections.some((s) => s.brandId === brandId);
  };

  // Marka checkbox toggle
  const toggleBrand = (brandId: string) => {
    const existingIndex = selections.findIndex((s) => s.brandId === brandId);

    if (existingIndex >= 0) {
      setSelections(selections.filter((s) => s.brandId !== brandId));
    } else {
      const brand = brands.find((b) => b.id === brandId);
      if (brand) {
        const availablePlatform = brand.deliveryPlatforms.find(
          (p) => !isPlatformMaxReached(p.id)
        );
        if (availablePlatform) {
          setSelections([
            ...selections,
            { brandId, platforms: [availablePlatform.id] },
          ]);
        }
      }
    }
  };

  // Platform toggle
  const togglePlatform = (brandId: string, platformId: string) => {
    const existingIndex = selections.findIndex((s) => s.brandId === brandId);

    if (existingIndex >= 0) {
      const currentPlatforms = selections[existingIndex].platforms;
      const platformIndex = currentPlatforms.indexOf(platformId);

      if (platformIndex >= 0) {
        const newPlatforms = currentPlatforms.filter((p) => p !== platformId);
        
        if (newPlatforms.length === 0) {
          setSelections(selections.filter((s) => s.brandId !== brandId));
        } else {
          const newSelections = [...selections];
          newSelections[existingIndex] = {
            ...newSelections[existingIndex],
            platforms: newPlatforms,
          };
          setSelections(newSelections);
        }
      } else {
        if (!isPlatformMaxReached(platformId)) {
          const newSelections = [...selections];
          newSelections[existingIndex] = {
            ...newSelections[existingIndex],
            platforms: [...currentPlatforms, platformId],
          };
          setSelections(newSelections);
        }
      }
    } else {
      if (!isPlatformMaxReached(platformId)) {
        setSelections([...selections, { brandId, platforms: [platformId] }]);
      }
    }
  };

  // Platform seçili mi?
  const isPlatformSelected = (brandId: string, platformId: string): boolean => {
    const selection = selections.find((s) => s.brandId === brandId);
    return selection?.platforms.includes(platformId) || false;
  };

  // Platform disabled mı?
  const isPlatformDisabled = (brandId: string, platformId: string): boolean => {
    if (isPlatformSelected(brandId, platformId)) {
      return false;
    }
    return isPlatformMaxReached(platformId);
  };

  // Next butonu
  const handleNext = () => {
    const hasValidSelection = selections.some((s) => s.platforms.length > 0);

    if (!hasValidSelection) {
      alert("Please select at least one brand with a delivery platform.");
      return;
    }

    localStorage.setItem("brandSelections", JSON.stringify(selections));
    router.push("/brand-register/delivery-method");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <BrandProgressBar currentStep={1} />

      <div className="max-w-6xl mx-auto px-4 py-6">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl font-bold">
              Select Your Restaurant Brand
            </CardTitle>
            <p className="text-gray-600">
              Choose your brand and select the delivery platforms you want to use.
            </p>
          </CardHeader>
          <CardContent>
            {/* Brands Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {brands.map((brand) => {
                const brandSelected = isBrandSelected(brand.id);

                // Bu marka için tüm platformlar max'a ulaştı mı?
                const allPlatformsMaxed = brand.deliveryPlatforms.every(
                  (p) => isPlatformMaxReached(p.id) && !isPlatformSelected(brand.id, p.id)
                );

                return (
                  <div
                    key={brand.id}
                    className={`border rounded-lg p-4 transition-all ${
                      brandSelected
                        ? "border-blue-500 bg-blue-50/30"
                        : allPlatformsMaxed
                        ? "border-gray-200 bg-gray-50 opacity-60"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    {/* Brand Header */}
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-semibold text-gray-800">
                        {brand.name}
                      </span>
                    </div>

                    {/* Brand Image with Checkbox */}
                    <div className="relative mb-4">
                      <div
                        className={`absolute top-2 left-2 z-10 ${
                          allPlatformsMaxed && !brandSelected ? "opacity-50" : ""
                        }`}
                      >
                        <Checkbox
                          checked={brandSelected}
                          onCheckedChange={() => toggleBrand(brand.id)}
                          disabled={allPlatformsMaxed && !brandSelected}
                          className="h-5 w-5 border-2 data-[state=checked]:bg-blue-900 data-[state=checked]:border-blue-900"
                        />
                      </div>
                      <div className="w-full aspect-square bg-white rounded-lg border flex items-center justify-center overflow-hidden">
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-orange-100 to-orange-50">
                          <div className="text-center">
                            <div className="text-4xl mb-1">🍔</div>
                            <div className="text-xs font-bold text-orange-600">
                              BURGER
                            </div>
                            <div className="text-xs font-bold text-orange-500">
                              BOOST
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Delivery Platforms */}
                    <div className="space-y-2">
                      {brand.deliveryPlatforms.map((platform) => {
                        const platformSelected = isPlatformSelected(
                          brand.id,
                          platform.id
                        );
                        const platformDisabled = isPlatformDisabled(
                          brand.id,
                          platform.id
                        );

                        return (
                          <div
                            key={platform.id}
                            className="flex items-center gap-2"
                          >
                            <Checkbox
                              checked={platformSelected}
                              onCheckedChange={() =>
                                togglePlatform(brand.id, platform.id)
                              }
                              disabled={platformDisabled}
                              className={`h-4 w-4 border-2 ${
                                platformSelected
                                  ? "data-[state=checked]:bg-blue-900 data-[state=checked]:border-blue-900"
                                  : ""
                              } ${platformDisabled ? "opacity-50" : ""}`}
                            />
                            <span
                              className={`text-sm ${
                                platformDisabled
                                  ? "text-gray-400"
                                  : "text-gray-700"
                              }`}
                            >
                              {platform.name}
                            </span>
                          </div>
                        );
                      })}

                      {/* Warning message when all platforms are maxed for this brand */}
                      {allPlatformsMaxed && !brandSelected && (
                        <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-700">
                          You have used all three of your chances. To make a new
                          selection, remove one of the previous ones.
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Next Button */}
            <div className="mt-8 flex justify-center">
              <RegisterButton 
                type="button" 
                onClick={handleNext} 
                disabled={selections.length === 0 || loading}
              >
                Next
              </RegisterButton>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
