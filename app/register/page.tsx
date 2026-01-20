"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import RegisterButton from "@/components/RegisterButton";
import { Eye, EyeOff, CheckCircle, Mail, Loader2, FileText } from "lucide-react";
import PhoneInput from "react-phone-number-input";
import "react-phone-number-input/style.css";

export default function RegisterPage() {
  const router = useRouter();
  
  // E-posta gönderildi mi durumunu kontrol eden state
  const [isEmailSent, setIsEmailSent] = useState(false);
  const [loading, setLoading] = useState(false);


  const [formData, setFormData] = useState({
    reference: "",
    companyName: "",
    firstName: "",
    lastName: "",
    email: "",
    telephone: "",
    password: "",
  });
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [passwordMatch, setPasswordMatch] = useState(true);
  const [passwordStrength, setPasswordStrength] = useState({
    strength: "Weak",
    percentage: 0,
    checks: {
      lowercase: false,
      uppercase: false,
      digits: false,
      special: false,
      length: false,
    },
  });
  const [referenceStatus, setReferenceStatus] = useState<
    "idle" | "checking" | "valid" | "invalid"
  >("idle");
  const [referenceMessage, setReferenceMessage] = useState<string | null>(null);

  const calculatePasswordStrength = (password: string) => {
    const checks = {
      lowercase: /[a-z]/.test(password),
      uppercase: /[A-Z]/.test(password),
      digits: /[0-9]/.test(password),
      special: /[@#$%&*!]/.test(password),
      length: password.length >= 8 && password.length <= 25,
    };

    const passedChecks = Object.values(checks).filter(Boolean).length;
    let strength = "Weak";
    let percentage = 0;

    if (!checks.lowercase || !checks.uppercase) {
      strength = "Weak";
      percentage = 20;
    } else if (passedChecks <= 2) {
      strength = "Weak";
      percentage = 33;
    } else if (passedChecks <= 4) {
      strength = "Medium";
      percentage = 66;
    } else {
      strength = "Strong";
      percentage = 100;
    }

    setPasswordStrength({ strength, percentage, checks });
  };

  const isPasswordValid = (password: string): boolean => {
    if (!password || password.length < 8) return false;
    const hasLowercase = /[a-z]/.test(password);
    const hasUppercase = /[A-Z]/.test(password);
    const hasDigits = /[0-9]/.test(password);
    return hasLowercase && hasUppercase && hasDigits;
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const password = e.target.value;
    setFormData({ ...formData, password });
    calculatePasswordStrength(password);
    if (confirmPassword) {
      setPasswordMatch(password === confirmPassword);
    }
  };

  const handleConfirmPasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const confirm = e.target.value;
    setConfirmPassword(confirm);
    setPasswordMatch(formData.password === confirm);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

 
  // Reference canlı doğrulama
  useEffect(() => {
    const reference = formData.reference?.trim();
    if (!reference) {
      setReferenceStatus("idle");
      setReferenceMessage(null);
      return;
    }
    const timeout = setTimeout(async () => {
      setReferenceStatus("checking");
      setReferenceMessage(null);
      try {
        const res = await fetch("/api/reference/validate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reference }),
        });
        const data = await res.json();
        if (res.ok && data.valid) {
          setReferenceStatus("valid");
          setReferenceMessage(null);
        } else {
          setReferenceStatus("invalid");
          setReferenceMessage(data.error || data.message || "No reference found");
        }
      } catch (error) {
        setReferenceStatus("invalid");
        setReferenceMessage("Reference check failed.");
      }
    }, 500);
    return () => clearTimeout(timeout);
  }, [formData.reference]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isPasswordValid(formData.password)) {
      alert("Password requirements are not met.");
      return;
    }
    if (!passwordMatch) {
      alert("Passwords do not match.");
      return;
    }
    if (!agreedToTerms) {
      alert("Please accept the terms of use.");
      return;
    }

    setLoading(true);

    // 1. Reference Check (Varsa)
    if (formData.reference) {
      try {
        const res = await fetch("/api/reference/validate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reference: formData.reference }),
        });
        const data = await res.json();
        if (!res.ok || !data.valid) {
          alert(data.error || "Reference not found");
          setLoading(false);
          return;
        }
      } catch (error) {
        alert("Reference validation failed.");
        setLoading(false);
        return;
      }
    }

    // 2. MAIL DOĞRULAMA BAŞLAT (Yeni Akış)
    try {
      const res = await fetch("/api/auth/start-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: formData.firstName || formData.companyName,
          email: formData.email,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Registration could not be started.");
        setLoading(false);
        return;
      }

      // BAŞARILI: Verileri LocalStorage'a kaydet (Doğrulama sonrası kullanmak için)
      if (typeof window !== "undefined") {
        localStorage.setItem(
          "initialRegistrationData",
          JSON.stringify({ ...formData, confirmPassword })
        );
        localStorage.removeItem("registrationData");
        sessionStorage.setItem("userEmail", formData.email);
      }

      // 3. EKRANI DEĞİŞTİR (Yönlendirme YAPMA)
      setIsEmailSent(true);
      setLoading(false);

    } catch (error) {
      console.error("Signup error:", error);
      alert("An error occurred. Please try again.");
      setLoading(false);
    }
  };

  // --- EĞER MAIL GÖNDERİLDİYSE BU EKRANI GÖSTER ---
  if (isEmailSent) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12">
        <Card className="w-full max-w-md border-gray-200 shadow-lg text-center">
          <CardContent className="pt-10 pb-10 flex flex-col items-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <Mail className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Check Your Email</h2>
            <p className="text-gray-600 mb-6 px-4">
              We've sent a verification link to <strong>{formData.email}</strong>.
              <br /><br />
              Please click the link in your inbox (or spam folder) to complete your registration.
            </p>
            <Button 
              variant="outline" 
              onClick={() => router.push("/login")}
              className="w-full"
            >
              Return to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // --- NORMAL KAYIT FORMU ---
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-2xl">
        <Card className="border-gray-200 shadow-lg">
          <CardHeader className="space-y-1">
            <CardTitle className="text-[30px] leading-[36px] font-bold text-[#111827] tracking-[0px]">
              Restaurant Registration
            </CardTitle>
            <p className="text-sm text-gray-600 mt-2">
              <span className="text-red-500">*</span> Indicates required fields
            </p>
          </CardHeader>

          <CardContent>
            <form className="space-y-6" onSubmit={handleSubmit}>
              

             
              
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="reference" className="text-[18px] font-semibold text-gray-700">
                    Reference
                  </Label>
                </div>
                <Input
                  id="reference"
                  name="reference"
                  type="text"
                  placeholder="Enter"
                  value={formData.reference}
                  onChange={handleChange}
                  className="w-full"
                />
                {formData.reference && referenceStatus === "invalid" && (
                  <p className="text-xs text-red-500">{referenceMessage || "No reference found"}</p>
                )}
                {formData.reference && referenceStatus === "valid" && (
                  <p className="text-xs text-green-600">Reference found</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="companyName" className="text-[18px] font-semibold text-gray-700">
                  Company Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="companyName"
                  name="companyName"
                  type="text"
                  placeholder="Enter"
                  value={formData.companyName}
                  onChange={handleChange}
                  required
                  className="w-full"
                />
              </div>

              <div className="space-y-4">
                <Label className="text-[24px] font-bold text-[#111827]">
                  Company Representative <span className="text-red-500">*</span>
                </Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName" className="text-[18px] font-semibold text-gray-700">
                      Customer Name
                    </Label>
                    <Input
                      id="firstName"
                      name="firstName"
                      type="text"
                      placeholder="Enter First Name"
                      value={formData.firstName}
                      onChange={handleChange}
                      className="w-full"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="telephone" className="text-[18px] font-semibold text-gray-700">
                      Telephone number <span className="text-red-500">*</span>
                    </Label>
                    <PhoneInput
                      international
                      defaultCountry="GB"
                      value={formData.telephone}
                      onChange={(value) => setFormData({ ...formData, telephone: value || "" })}
                      className="phone-input"
                      numberInputProps={{
                        id: "telephone",
                        name: "telephone",
                        required: true,
                      }}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-[18px] font-semibold text-gray-700">
                    E-mail address <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="Enter E-mail address"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    className="w-full"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-[18px] font-semibold text-gray-700">
                    Password
                  </Label>
                  <div className="relative">
                    <Input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter"
                      value={formData.password}
                      onChange={handlePasswordChange}
                      className="w-full pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-gray-600">Password Strenght:</Label>
                      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all ${
                            passwordStrength.strength === "Weak"
                              ? "bg-red-500"
                              : passwordStrength.strength === "Medium"
                              ? "bg-yellow-500"
                              : "bg-green-500"
                          }`}
                          style={{ width: `${passwordStrength.percentage}%` }}
                        />
                      </div>
                      <span className="text-xs font-semibold text-gray-700">
                        {passwordStrength.strength}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 space-y-1 mt-3">
                      <div className={passwordStrength.checks.lowercase && passwordStrength.checks.uppercase ? "text-green-600" : ""}>
                        ✓ Must contain lowercase and uppercase letters [a-z / A-Z]
                      </div>
                      <div className={passwordStrength.checks.digits ? "text-green-600" : ""}>
                        {passwordStrength.checks.digits ? "✓" : "○"} Must contain at least one digit [0-9]
                      </div>
                      <div className={passwordStrength.checks.length ? "text-green-600" : ""}>
                        {passwordStrength.checks.length ? "✓" : "○"} Must be between 8-25 characters
                      </div>
                      <div className={passwordStrength.checks.special ? "text-green-600" : ""}>
                        {passwordStrength.checks.special ? "✓" : "○"} Special characters recommended [@, #, $, %, etc.]
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-[18px] font-semibold text-gray-700">
                    Confirm Password
                  </Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Enter"
                      value={confirmPassword}
                      onChange={handleConfirmPasswordChange}
                      className={`w-full pr-10 ${!passwordMatch && confirmPassword ? "border-red-500" : ""}`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    >
                      {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                  {!passwordMatch && confirmPassword && (
                    <p className="text-xs text-red-500">Passwords do not match</p>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-[18px] font-semibold text-gray-700">
                  Term of Use <span className="text-red-500">*</span>
                </Label>
                <div className="border border-gray-300 rounded-md p-4 max-h-60 overflow-y-auto bg-gray-50">
                  <div className="text-xs text-gray-600 leading-relaxed space-y-2">
                    <h3 className="font-semibold text-gray-800 mb-2">
                      General Terms and Conditions of CC Culinary Collective GmbH
                    </h3>
                    <p>...</p> 
                    {/* (Metin kısaltıldı, orijinal metin burada kalmalı) */}
                  </div>
                </div>
                <div className="flex items-start space-x-2">
                  <Checkbox
                    id="terms"
                    checked={agreedToTerms}
                    onCheckedChange={(checked) => setAgreedToTerms(checked === true)}
                    className="mt-1"
                  />
                  <Label
                    htmlFor="terms"
                    className="text-sm font-normal text-gray-700 cursor-pointer leading-relaxed"
                  >
                    I have read and agree to the terms of use.
                  </Label>
                </div>
              </div>

              <div className="flex justify-center">
                <RegisterButton
                  type="submit"
                  disabled={!passwordMatch || !agreedToTerms || !confirmPassword || loading}
                >
                  {loading ? "Sending Email..." : "Register"}
                </RegisterButton>
              </div>

              <div className="text-center text-sm text-gray-600">
                Do you have an account?{" "}
                <Link
                  href="/"
                  className="font-medium text-orange-600 hover:text-orange-500 transition-colors"
                >
                  Login here.
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}