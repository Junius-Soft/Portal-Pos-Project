"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import RegisterButton from "@/components/RegisterButton";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import BrandProgressBar from "@/components/BrandProgressBar";
import dynamic from "next/dynamic";
import { Clock, Plus, Trash2, Pencil, Calendar } from "lucide-react";

// Harita komponenti dinamik import (SSR devre dışı)
const DeliveryMap = dynamic(() => import("@/components/DeliveryMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-gray-100">
      <div className="text-gray-500">Loading map...</div>
    </div>
  ),
});

interface BrandSelection {
  brandId: string;
  platforms: string[];
}

interface Business {
  businessName: string;
  street: string;
  city: string;
  postalCode: string;
  country: string;
  federalState: string;
}

interface BusinessRegion {
  region: string;
  radius: number;
  postCodes: string[];
  lat?: number;
  lng?: number;
  loading?: boolean;
}

interface BreakTime {
  from: string;
  to: string;
}

interface DaySchedule {
  isOpen: boolean;
  from: string;
  to: string;
  breaks: BreakTime[];
}

interface WeeklySchedule {
  [key: string]: DaySchedule;
}

interface HolidayException {
  id: string;
  name: string;
  date: string;
  from: string;
  to: string;
}

const DAYS_OF_WEEK = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const DEFAULT_SCHEDULE: DaySchedule = {
  isOpen: true,
  from: "09:00",
  to: "22:00",
  breaks: [],
};

export default function DeliveryMethodPage() {
  const router = useRouter();
  const [selections, setSelections] = useState<BrandSelection[]>([]);
  const [deliveryType, setDeliveryType] = useState<string>("own-delivery");
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [businessRegions, setBusinessRegions] = useState<{ [key: number]: BusinessRegion }>({});
  const [loading, setLoading] = useState(false);
  const [loadingBusinesses, setLoadingBusinesses] = useState(true);

  // Weekly Schedule State
  const [weeklySchedule, setWeeklySchedule] = useState<WeeklySchedule>(() => {
    const schedule: WeeklySchedule = {};
    DAYS_OF_WEEK.forEach((day) => {
      schedule[day] = { ...DEFAULT_SCHEDULE };
    });
    schedule["Monday"] = { ...DEFAULT_SCHEDULE, isOpen: false };
    return schedule;
  });

  // Holiday Exceptions State
  const [holidayExceptions, setHolidayExceptions] = useState<HolidayException[]>([]);
  const [newException, setNewException] = useState<Omit<HolidayException, "id">>({
    name: "",
    date: "",
    from: "11:00",
    to: "18:00",
  });
  const [editingExceptionId, setEditingExceptionId] = useState<string | null>(null);

  // Postcodes'ları getir
  const fetchPostcodes = useCallback(async (index: number, postcode: string, radius: number) => {
    if (!postcode || postcode.length < 4) return;

    setBusinessRegions((prev) => ({
      ...prev,
      [index]: {
        ...prev[index],
        loading: true,
      },
    }));

    try {
      const res = await fetch("/api/geo/postcodes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postcode, radius }),
      });

      const data = await res.json();

      if (data.success) {
        setBusinessRegions((prev) => ({
          ...prev,
          [index]: {
            ...prev[index],
            postCodes: data.postcodes || [],
            lat: data.center?.lat,
            lng: data.center?.lng,
            loading: false,
          },
        }));
      } else {
        setBusinessRegions((prev) => ({
          ...prev,
          [index]: {
            ...prev[index],
            loading: false,
          },
        }));
      }
    } catch (error) {
      console.error("Error fetching postcodes:", error);
      setBusinessRegions((prev) => ({
        ...prev,
        [index]: {
          ...prev[index],
          loading: false,
        },
      }));
    }
  }, []);

  const initializeBusinessRegions = useCallback((businessList: Business[]) => {
    const regions: { [key: number]: BusinessRegion } = {};
    businessList.forEach((business, index) => {
      regions[index] = {
        region: business.postalCode || "",
        radius: 5,
        postCodes: [],
        loading: false,
      };

      if (business.postalCode) {
        setTimeout(() => {
          fetchPostcodes(index, business.postalCode, 5);
        }, index * 500);
      }
    });
    setBusinessRegions(regions);
  }, [fetchPostcodes]);

  const loadBusinessesFromLead = useCallback(async () => {
    setLoadingBusinesses(true);
    try {
      let userEmail = "";
      if (typeof window !== "undefined") {
        userEmail = sessionStorage.getItem("userEmail") || "";
        if (!userEmail) {
          const initialData = localStorage.getItem("initialRegistrationData");
          if (initialData) {
            try {
              userEmail = JSON.parse(initialData).email || "";
            } catch (e) {}
          }
        }
      }

      if (!userEmail) {
        const demoBusinesses: Business[] = [
          { businessName: "Business 1", street: "", city: "", postalCode: "20095", country: "Germany", federalState: "" },
          { businessName: "Business 2", street: "", city: "", postalCode: "22041", country: "Germany", federalState: "" },
          { businessName: "Business 3", street: "", city: "", postalCode: "21033", country: "Germany", federalState: "" },
        ];
        setBusinesses(demoBusinesses);
        initializeBusinessRegions(demoBusinesses);
        setLoadingBusinesses(false);
        return;
      }

      const res = await fetch("/api/erp/get-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: userEmail }),
      });

      const data = await res.json();

      if (data.success && data.lead) {
        let leadBusinesses: Business[] = [];

        if (data.lead.businesses && Array.isArray(data.lead.businesses) && data.lead.businesses.length > 0) {
          leadBusinesses = data.lead.businesses;
        } else {
          const brandCount = selections.length || 3;
          leadBusinesses = Array.from({ length: brandCount }, (_, i) => ({
            businessName: `Business ${i + 1}`,
            street: "",
            city: "",
            postalCode: "",
            country: "Germany",
            federalState: "",
          }));
        }

        setBusinesses(leadBusinesses);
        initializeBusinessRegions(leadBusinesses);
      }
    } catch (error) {
      console.error("Error loading businesses:", error);
      const demoBusinesses: Business[] = [
        { businessName: "Business 1", street: "", city: "", postalCode: "20095", country: "Germany", federalState: "" },
        { businessName: "Business 2", street: "", city: "", postalCode: "22041", country: "Germany", federalState: "" },
        { businessName: "Business 3", street: "", city: "", postalCode: "21033", country: "Germany", federalState: "" },
      ];
      setBusinesses(demoBusinesses);
      initializeBusinessRegions(demoBusinesses);
    } finally {
      setLoadingBusinesses(false);
    }
  }, [selections, initializeBusinessRegions]);

  useEffect(() => {
    const savedSelections = localStorage.getItem("brandSelections");
    if (savedSelections) {
      setSelections(JSON.parse(savedSelections));
    } else {
      router.push("/brand-register/brand-selection");
      return;
    }

    loadBusinessesFromLead();
  }, [router, loadBusinessesFromLead]);

  const updateBusinessRegion = (index: number, field: string, value: any) => {
    setBusinessRegions((prev) => ({
      ...prev,
      [index]: {
        ...prev[index],
        [field]: value,
      },
    }));

    if (field === "region" || field === "radius") {
      const region = field === "region" ? value : businessRegions[index]?.region;
      const radius = field === "radius" ? value : businessRegions[index]?.radius;

      const timeoutId = setTimeout(() => {
        if (region && region.length >= 4) {
          fetchPostcodes(index, region, radius);
        }
      }, 500);

      return () => clearTimeout(timeoutId);
    }
  };

  // Schedule functions
  const updateDaySchedule = (day: string, field: keyof DaySchedule, value: any) => {
    setWeeklySchedule((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        [field]: value,
      },
    }));
  };

  const addBreak = (day: string) => {
    setWeeklySchedule((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        breaks: [...prev[day].breaks, { from: "12:00", to: "14:00" }],
      },
    }));
  };

  const removeBreak = (day: string, breakIndex: number) => {
    setWeeklySchedule((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        breaks: prev[day].breaks.filter((_, i) => i !== breakIndex),
      },
    }));
  };

  const updateBreak = (day: string, breakIndex: number, field: keyof BreakTime, value: string) => {
    setWeeklySchedule((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        breaks: prev[day].breaks.map((b, i) =>
          i === breakIndex ? { ...b, [field]: value } : b
        ),
      },
    }));
  };

  // Holiday Exception functions
  const addException = () => {
    if (!newException.name || !newException.date) {
      alert("Please enter exception name and date.");
      return;
    }

    if (editingExceptionId) {
      // Update existing
      setHolidayExceptions((prev) =>
        prev.map((ex) =>
          ex.id === editingExceptionId ? { ...newException, id: editingExceptionId } : ex
        )
      );
      setEditingExceptionId(null);
    } else {
      // Add new
      const newEx: HolidayException = {
        ...newException,
        id: Date.now().toString(),
      };
      setHolidayExceptions((prev) => [...prev, newEx]);
    }

    // Reset form
    setNewException({
      name: "",
      date: "",
      from: "11:00",
      to: "18:00",
    });
  };

  const editException = (exception: HolidayException) => {
    setEditingExceptionId(exception.id);
    setNewException({
      name: exception.name,
      date: exception.date,
      from: exception.from,
      to: exception.to,
    });
  };

  const deleteException = (id: string) => {
    setHolidayExceptions((prev) => prev.filter((ex) => ex.id !== id));
    if (editingExceptionId === id) {
      setEditingExceptionId(null);
      setNewException({
        name: "",
        date: "",
        from: "11:00",
        to: "18:00",
      });
    }
  };

  const isExpired = (dateStr: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const exceptionDate = new Date(dateStr);
    return exceptionDate < today;
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const handleNext = () => {
    if (!deliveryType) {
      alert("Please select a delivery type.");
      return;
    }

    localStorage.setItem("deliveryMethod", deliveryType);
    localStorage.setItem("businessRegions", JSON.stringify(businessRegions));
    localStorage.setItem("weeklySchedule", JSON.stringify(weeklySchedule));
    localStorage.setItem("holidayExceptions", JSON.stringify(holidayExceptions));
    router.push("/brand-register/agreements");
  };

  const handleBack = () => {
    router.push("/brand-register/brand-selection");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <BrandProgressBar currentStep={2} />

      <div className="max-w-6xl mx-auto px-4 py-6">
        <Card className="shadow-lg">
          <CardContent className="pt-6">
            {/* Title */}
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Delivery method
            </h1>
            <p className="text-gray-600 mb-6">
              Please select the type of food delivery service offered.
            </p>

            {/* Delivery Type Selection */}
            <div className="mb-8">
              <p className="font-semibold text-gray-800 mb-4">
                Do you provide the delivery service with your own vehicle?
              </p>
              <RadioGroup
                value={deliveryType}
                onValueChange={setDeliveryType}
                className="flex gap-4"
              >
                <div className="flex items-center">
                  <RadioGroupItem value="own-delivery" id="own-delivery" className="mr-2" />
                  <Label htmlFor="own-delivery" className="cursor-pointer border rounded-lg px-4 py-2 hover:bg-gray-50">
                    Own Delivery
                  </Label>
                </div>
                <div className="flex items-center">
                  <RadioGroupItem value="delivery-via-portal" id="delivery-via-portal" className="mr-2" />
                  <Label htmlFor="delivery-via-portal" className="cursor-pointer border rounded-lg px-4 py-2 hover:bg-gray-50">
                    Delivery via portal
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* Delivery Area Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
              {/* Left Side - Business Regions */}
              <div>
                <h2 className="text-lg font-bold text-gray-900 mb-4">
                  Delivery Area
                </h2>

                {loadingBusinesses ? (
                  <div className="text-gray-500">Loading businesses...</div>
                ) : (
                  <div className="space-y-6">
                    {businesses.map((business, index) => (
                      <div key={index} className="space-y-3">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label className="text-sm font-semibold text-gray-700">
                              Business {index + 1} Region
                            </Label>
                            <Input
                              placeholder="Enter PostCode"
                              value={businessRegions[index]?.region || ""}
                              onChange={(e) => updateBusinessRegion(index, "region", e.target.value)}
                              className="mt-1"
                            />
                          </div>

                          <div>
                            <Label className="text-sm font-semibold text-gray-700">
                              Region Radius *
                            </Label>
                            <div className="flex items-center gap-3 mt-1">
                              <Slider
                                value={[businessRegions[index]?.radius || 5]}
                                onValueChange={(value) => updateBusinessRegion(index, "radius", value[0])}
                                min={1}
                                max={50}
                                step={1}
                                className="flex-1"
                              />
                              <span className="text-sm text-gray-600 min-w-[40px]">
                                {businessRegions[index]?.radius || 5} km
                              </span>
                            </div>
                          </div>
                        </div>

                        <div>
                          <Label className="text-sm font-semibold text-gray-700">
                            PostCodes in radius{" "}
                            <span className="text-orange-500">
                              ({businessRegions[index]?.loading 
                                ? "loading..." 
                                : `${businessRegions[index]?.postCodes?.length || 0} found`})
                            </span>
                          </Label>
                          <div className="mt-1 p-3 bg-gray-50 rounded-lg border max-h-24 overflow-y-auto">
                            {businessRegions[index]?.loading ? (
                              <p className="text-xs text-gray-400">Loading postcodes...</p>
                            ) : businessRegions[index]?.postCodes?.length > 0 ? (
                              <p className="text-xs text-gray-600">
                                {businessRegions[index].postCodes.join(", ")}
                              </p>
                            ) : (
                              <p className="text-xs text-gray-400">
                                Enter a postcode to see nearby postcodes
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Right Side - Map Preview */}
              <div>
                <h2 className="text-lg font-bold text-gray-900 mb-4">
                  Delivery Coverage Preview
                </h2>
                <div className="w-full h-[500px] bg-gray-100 rounded-lg border overflow-hidden">
                  <DeliveryMap businessRegions={businessRegions} />
                </div>
              </div>
            </div>

            {/* Delivery Hours Section */}
            <div className="border-t pt-8">
              <h2 className="text-xl font-bold text-gray-900 mb-2">
                Delivery Hours
              </h2>
              <p className="text-gray-600 mb-6">
                Define when your restaurant is open for orders and delivery. You can also add special holiday schedules.
              </p>

              <h3 className="font-semibold text-gray-800 mb-4">Weekly Schedule</h3>

              <div className="space-y-3">
                {DAYS_OF_WEEK.map((day) => {
                  const schedule = weeklySchedule[day];
                  return (
                    <div key={day}>
                      {/* Main Day Row */}
                      <div
                        className={`flex items-center gap-4 p-3 rounded-lg border ${
                          schedule.isOpen ? "bg-white border-orange-200" : "bg-gray-50 border-gray-200"
                        }`}
                      >
                        {/* Day Name */}
                        <div className="w-28 font-medium text-gray-700">{day}</div>

                        {/* Open Checkbox */}
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id={`${day}-open`}
                            checked={schedule.isOpen}
                            onCheckedChange={(checked) =>
                              updateDaySchedule(day, "isOpen", checked)
                            }
                          />
                          <Label htmlFor={`${day}-open`} className="text-sm cursor-pointer">
                            Open
                          </Label>
                        </div>

                        {/* Time Inputs - Only show if open */}
                        {schedule.isOpen && (
                          <>
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-gray-500">From:</span>
                              <div className="relative">
                                <Input
                                  type="time"
                                  value={schedule.from}
                                  onChange={(e) =>
                                    updateDaySchedule(day, "from", e.target.value)
                                  }
                                  className="w-28 pr-8"
                                />
                                <Clock className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <span className="text-sm text-gray-500">To:</span>
                              <div className="relative">
                                <Input
                                  type="time"
                                  value={schedule.to}
                                  onChange={(e) =>
                                    updateDaySchedule(day, "to", e.target.value)
                                  }
                                  className="w-28 pr-8"
                                />
                                <Clock className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                              </div>
                            </div>

                            <button
                              onClick={() => addBreak(day)}
                              className="ml-auto text-sm text-orange-500 hover:text-orange-600 flex items-center gap-1"
                            >
                              <Plus className="w-4 h-4" />
                              Add Break
                            </button>
                          </>
                        )}
                      </div>

                      {/* Break Times */}
                      {schedule.isOpen &&
                        schedule.breaks.map((breakTime, breakIndex) => (
                          <div
                            key={breakIndex}
                            className="flex items-center gap-4 p-3 ml-8 mt-1 rounded-lg bg-orange-50 border border-orange-100"
                          >
                            <div className="w-20 text-sm font-medium text-gray-600">
                              Break Time
                            </div>

                            <div className="flex items-center gap-2">
                              <span className="text-sm text-gray-500">From:</span>
                              <div className="relative">
                                <Input
                                  type="time"
                                  value={breakTime.from}
                                  onChange={(e) =>
                                    updateBreak(day, breakIndex, "from", e.target.value)
                                  }
                                  className="w-28 pr-8"
                                />
                                <Clock className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <span className="text-sm text-gray-500">To:</span>
                              <div className="relative">
                                <Input
                                  type="time"
                                  value={breakTime.to}
                                  onChange={(e) =>
                                    updateBreak(day, breakIndex, "to", e.target.value)
                                  }
                                  className="w-28 pr-8"
                                />
                                <Clock className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                              </div>
                            </div>

                            <button
                              onClick={() => removeBreak(day, breakIndex)}
                              className="ml-auto text-sm text-red-500 hover:text-red-600 flex items-center gap-1"
                            >
                              <Trash2 className="w-4 h-4" />
                              Delete Break
                            </button>
                          </div>
                        ))}
                    </div>
                  );
                })}
              </div>

              {/* Holiday Exceptions */}
              <div className="mt-8">
                <h3 className="font-semibold text-gray-800 mb-4">Holiday Exceptions</h3>

                {/* Add Exception Form */}
                <div className="p-4 bg-gray-50 rounded-lg border mb-4">
                  <h4 className="font-medium text-gray-700 mb-4">Exception Details</h4>
                  
                  <div className="flex flex-wrap items-end gap-4">
                    {/* Exception Name */}
                    <div>
                      <Label className="text-sm text-gray-600">Exception Name:</Label>
                      <Input
                        placeholder="Enter Exception Name"
                        value={newException.name}
                        onChange={(e) =>
                          setNewException((prev) => ({ ...prev, name: e.target.value }))
                        }
                        className="mt-1 w-48"
                      />
                    </div>

                    {/* Date */}
                    <div>
                      <Label className="text-sm text-gray-600">Date:</Label>
                      <div className="relative mt-1">
                        <Input
                          type="date"
                          value={newException.date}
                          onChange={(e) =>
                            setNewException((prev) => ({ ...prev, date: e.target.value }))
                          }
                          className="w-40 pr-8"
                        />
                        <Calendar className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                      </div>
                    </div>

                    {/* From */}
                    <div>
                      <Label className="text-sm text-gray-600">From:</Label>
                      <div className="relative mt-1">
                        <Input
                          type="time"
                          value={newException.from}
                          onChange={(e) =>
                            setNewException((prev) => ({ ...prev, from: e.target.value }))
                          }
                          className="w-28 pr-8"
                        />
                        <Clock className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      </div>
                    </div>

                    {/* To */}
                    <div>
                      <Label className="text-sm text-gray-600">To:</Label>
                      <div className="relative mt-1">
                        <Input
                          type="time"
                          value={newException.to}
                          onChange={(e) =>
                            setNewException((prev) => ({ ...prev, to: e.target.value }))
                          }
                          className="w-28 pr-8"
                        />
                        <Clock className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      </div>
                    </div>

                    {/* Add Button */}
                    <button
                      onClick={addException}
                      className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg flex items-center gap-1 text-sm font-medium"
                    >
                      <Plus className="w-4 h-4" />
                      {editingExceptionId ? "Update Exception" : "+ Add Exception"}
                    </button>
                  </div>
                </div>

                {/* Exception List */}
                {holidayExceptions.length > 0 && (
                  <div className="space-y-2">
                    {holidayExceptions.map((exception) => {
                      const expired = isExpired(exception.date);
                      return (
                        <div
                          key={exception.id}
                          className={`flex items-center gap-4 p-3 rounded-lg border ${
                            expired
                              ? "bg-gray-50 border-gray-200"
                              : "bg-orange-50 border-orange-200"
                          }`}
                        >
                          {/* Exception Name */}
                          <div className="w-36 font-medium text-gray-700">
                            {exception.name}
                          </div>

                          {/* Date */}
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-500">Date:</span>
                            <div className="relative">
                              <Input
                                type="text"
                                value={formatDate(exception.date)}
                                readOnly
                                className="w-32 pr-8 bg-white"
                              />
                              <Calendar className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            </div>
                          </div>

                          {/* From */}
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-500">From:</span>
                            <div className="relative">
                              <Input
                                type="text"
                                value={exception.from}
                                readOnly
                                className="w-24 pr-8 bg-white"
                              />
                              <Clock className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            </div>
                          </div>

                          {/* To */}
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-500">To:</span>
                            <div className="relative">
                              <Input
                                type="text"
                                value={exception.to}
                                readOnly
                                className="w-24 pr-8 bg-white"
                              />
                              <Clock className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="ml-auto flex items-center gap-2">
                            {expired ? (
                              <span className="px-3 py-1 bg-gray-200 text-gray-600 text-xs font-medium rounded">
                                Expired
                              </span>
                            ) : (
                              <button
                                onClick={() => editException(exception)}
                                className="p-2 text-orange-500 hover:bg-orange-100 rounded"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              onClick={() => deleteException(exception.id)}
                              className="p-2 text-red-500 hover:bg-red-100 rounded"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Navigation Buttons */}
            <div className="mt-8 flex justify-between">
              <Button
                onClick={handleBack}
                variant="outline"
                className="px-8"
              >
                Back
              </Button>
              <RegisterButton
                type="button"
                onClick={handleNext}
                disabled={loading}
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
