"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export interface CompanyInfo {
  companyName: string;
  restaurantCount: string;
  taxIdNumber: string;
  vatIdentificationNumber: string;
  street: string;
  city: string;
  country: string;
  federalState: string;
  zipCode: string;
}

export interface RestaurantAddress {
  restaurantName: string;
  street: string;
  city: string;
  country: string;
  federalState: string;
}

export interface RegistrationData {
  companyInfo: CompanyInfo;
  restaurants: RestaurantAddress[];
  currentStep: number;
}

interface RegistrationContextType {
  formData: RegistrationData;
  updateFormData: (data: Partial<RegistrationData>) => void;
  goToStep: (step: number) => void;
  saveToLocalStorage: () => void;
  loadFromLocalStorage: () => void;
}

const RegistrationContext = createContext<RegistrationContextType | undefined>(undefined);

const defaultFormData: RegistrationData = {
  companyInfo: {
    companyName: "",
    restaurantCount: "",
    taxIdNumber: "",
    vatIdentificationNumber: "",
    street: "",
    city: "",
    country: "",
    federalState: "",
    zipCode: "",
  },
  restaurants: [],
  currentStep: 1,
};

export function RegistrationProvider({ children }: { children: ReactNode }) {
  const [formData, setFormData] = useState<RegistrationData>(defaultFormData);

  useEffect(() => {
    // Load from localStorage on mount
    loadFromLocalStorage();
  }, []);

  const updateFormData = (data: Partial<RegistrationData>) => {
    setFormData((prev) => {
      const updated = { ...prev, ...data };
      // Auto-save to localStorage
      if (typeof window !== "undefined") {
        localStorage.setItem("registrationData", JSON.stringify(updated));
      }
      return updated;
    });
  };

  const goToStep = (step: number) => {
    if (step >= 1 && step <= 4) {
      updateFormData({ currentStep: step });
    }
  };

  const saveToLocalStorage = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem("registrationData", JSON.stringify(formData));
    }
  };

  const loadFromLocalStorage = () => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("registrationData");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setFormData(parsed);
        } catch (error) {
          console.error("Error loading registration data:", error);
        }
      }
    }
  };

  return (
    <RegistrationContext.Provider
      value={{
        formData,
        updateFormData,
        goToStep,
        saveToLocalStorage,
        loadFromLocalStorage,
      }}
    >
      {children}
    </RegistrationContext.Provider>
  );
}

export function useRegistration() {
  const context = useContext(RegistrationContext);
  if (context === undefined) {
    throw new Error("useRegistration must be used within a RegistrationProvider");
  }
  return context;
}
