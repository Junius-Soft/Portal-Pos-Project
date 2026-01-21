"use client";

import { useEffect, useState, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface BusinessRegion {
  region: string;
  radius: number;
  lat?: number;
  lng?: number;
}

interface DeliveryMapProps {
  businessRegions: { [key: number]: BusinessRegion };
}

// Farklı renkler için
const colors = [
  "#ef4444", // red
  "#f97316", // orange
  "#eab308", // yellow
  "#22c55e", // green
  "#3b82f6", // blue
  "#8b5cf6", // purple
];

export default function DeliveryMap({ businessRegions }: DeliveryMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [isClient, setIsClient] = useState(false);
  const circlesRef = useRef<L.Circle[]>([]);
  const markersRef = useRef<L.Marker[]>([]);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Harita oluştur
  useEffect(() => {
    if (!isClient || !mapContainerRef.current || mapRef.current) return;

    // Default marker icon fix
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
      iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
      shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
    });

    // Haritayı oluştur
    const map = L.map(mapContainerRef.current, {
      center: [53.5511, 9.9937], // Hamburg default
      zoom: 10,
      scrollWheelZoom: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    mapRef.current = map;

    // Harita boyutunu düzelt
    setTimeout(() => {
      map.invalidateSize();
    }, 100);

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [isClient]);

  // Business regions değiştiğinde daireleri güncelle
  useEffect(() => {
    if (!mapRef.current) return;

    const map = mapRef.current;

    // Eski daireleri ve markerları temizle
    circlesRef.current.forEach((circle) => circle.remove());
    markersRef.current.forEach((marker) => marker.remove());
    circlesRef.current = [];
    markersRef.current = [];

    // Yeni daireler ve markerlar ekle
    const bounds: L.LatLngBounds[] = [];

    Object.entries(businessRegions).forEach(([index, region]) => {
      if (!region.lat || !region.lng) return;

      const colorIndex = parseInt(index) % colors.length;
      const color = colors[colorIndex];

      // Daire ekle
      const circle = L.circle([region.lat, region.lng], {
        radius: region.radius * 1000, // km to meters
        color: color,
        fillColor: color,
        fillOpacity: 0.2,
        weight: 2,
      }).addTo(map);

      circlesRef.current.push(circle);
      bounds.push(circle.getBounds());

      // Marker ekle
      const marker = L.marker([region.lat, region.lng])
        .bindPopup(`
          <div>
            <strong>Business ${parseInt(index) + 1}</strong><br/>
            Region: ${region.region}<br/>
            Radius: ${region.radius} km
          </div>
        `)
        .addTo(map);

      markersRef.current.push(marker);
    });

    // Tüm daireleri kapsayacak şekilde zoom yap
    if (bounds.length > 0) {
      const combinedBounds = bounds[0];
      bounds.slice(1).forEach((b) => combinedBounds.extend(b));
      map.fitBounds(combinedBounds, { padding: [20, 20] });
    }

    // Harita boyutunu düzelt
    setTimeout(() => {
      map.invalidateSize();
    }, 100);
  }, [businessRegions]);

  // Window resize'da haritayı düzelt
  useEffect(() => {
    const handleResize = () => {
      if (mapRef.current) {
        mapRef.current.invalidateSize();
      }
    };

    window.addEventListener("resize", handleResize);
    
    // İlk yüklemede de çağır
    const timer = setTimeout(handleResize, 500);

    return () => {
      window.removeEventListener("resize", handleResize);
      clearTimeout(timer);
    };
  }, []);

  if (!isClient) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100">
        <div className="text-gray-500">Loading map...</div>
      </div>
    );
  }

  return (
    <div 
      ref={mapContainerRef} 
      className="w-full h-full"
      style={{ minHeight: "500px" }}
    />
  );
}
