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
import { Eye, EyeOff } from "lucide-react";

// Function to get country flag emoji based on country code
function getCountryFlag(countryCode: string): string {
  const flagMap: Record<string, string> = {
    "+44": "🇬🇧", // United Kingdom
    "+1": "🇺🇸", // United States
    "+90": "🇹🇷", // Turkey
    "+49": "🇩🇪", // Germany
  };
  return flagMap[countryCode] || "🇬🇧";
}

export default function RegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    reference: "",
    companyName: "",
    firstName: "",
    lastName: "",
    email: "",
    telephone: "",
    telephoneCode: "+44",
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

    // Parola hem büyük hem küçük harf içermeli (ERPNext gereksinimi)
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

  // Parola geçerliliğini kontrol et (ERPNext gereksinimlerine uygun)
  const isPasswordValid = (password: string): boolean => {
    if (!password || password.length < 8) return false;
    
    const hasLowercase = /[a-z]/.test(password);
    const hasUppercase = /[A-Z]/.test(password);
    const hasDigits = /[0-9]/.test(password);
    
    // ERPNext: Hem büyük hem küçük harf zorunlu, rakam önerilir
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

  // Reference alanı için canlı (on typing) doğrulama
  useEffect(() => {
    const reference = formData.reference?.trim();

    // Boş ise hiçbir uyarı gösterme
    if (!reference) {
      setReferenceStatus("idle");
      setReferenceMessage(null);
      return;
    }

    // Debounce: kullanıcı yazmayı bırakınca 500ms sonra kontrol et
    const timeout = setTimeout(async () => {
      setReferenceStatus("checking");
      setReferenceMessage(null);

      try {
        const res = await fetch("/api/reference/validate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
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
        console.error("Live reference validation failed:", error);
        setReferenceStatus("invalid");
        setReferenceMessage("Reference check failed. Please try again.");
      }
    }, 500);

    return () => clearTimeout(timeout);
  }, [formData.reference]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Parola geçerliliği kontrolü
    if (!isPasswordValid(formData.password)) {
      alert("Parola en az 8 karakter olmalı, hem büyük hem küçük harf ve en az bir rakam içermelidir.");
      return;
    }

    if (!passwordMatch) {
      alert("Parolalar eşleşmiyor.");
      return;
    }

    if (!agreedToTerms) {
      alert("Lütfen kullanım şartlarını kabul edin.");
      return;
    }

    // Reference (Sales Person ID) optional:
    // Eğer doldurulmuşsa ERPNext üzerinde doğrula, boşsa kontrol etme.
    if (formData.reference) {
      try {
        const res = await fetch("/api/reference/validate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ reference: formData.reference }),
        });

        const data = await res.json();
        console.log("Reference validate response:", data);

        if (!res.ok || !data.valid) {
          alert(data.error || data.message || "Reference not found");
          return;
        }
      } catch (error) {
        console.error("Reference validation failed:", error);
        alert("Failed to validate reference. Please try again.");
        return;
      }
    }

    // ERP'de User oluştur
    try {
      const telephoneFull = `${formData.telephoneCode} ${formData.telephone}`;

      const res = await fetch("/api/erp/register-user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          firstName: formData.firstName || formData.companyName,
          telephone: telephoneFull,
          companyName: formData.companyName,
          reference: formData.reference,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        // Parola hatası için özel mesaj göster
        if (data.errorType === "password_validation") {
          alert(data.error || "Parola gereksinimleri karşılanmıyor. Lütfen daha güçlü bir parola kullanın.");
        } else {
          alert(data.error || "Kullanıcı kaydı başarısız oldu. Lütfen tekrar deneyin.");
        }
        return;
      }
    } catch (error) {
      console.error("ERP user registration failed:", error);
      alert("Failed to create user in ERP. Please try again.");
      return;
    }

    // Save initial form data and navigate to company information step
    if (typeof window !== "undefined") {
      localStorage.setItem(
        "initialRegistrationData",
        JSON.stringify({ ...formData, confirmPassword, telephoneCode: formData.telephoneCode })
      );
    }

    // Navigate to company information page
    router.push("/register/company-information");
  };

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
              {/* Reference Field */}
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
                {/* Reference validation message */}
                {formData.reference && referenceStatus === "invalid" && (
                  <p className="text-xs text-red-500">
                    {referenceMessage || "No reference found"}
                  </p>
                )}
                {formData.reference && referenceStatus === "valid" && (
                  <p className="text-xs text-green-600">Reference found</p>
                )}
              </div>

              {/* Company Name */}
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

              {/* Company Representative Section */}
              <div className="space-y-4">
                <Label className="text-[24px] font-bold text-[#111827]">
                  Company Representative <span className="text-red-500">*</span>
                </Label>

                {/* Customer Name and Telephone number */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Customer Name */}
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

                  {/* Telephone number */}
                  <div className="space-y-2">
                    <Label htmlFor="telephone" className="text-[18px] font-semibold text-gray-700">
                      Telephone number <span className="text-red-500">*</span>
                    </Label>
                    <div className="flex gap-2">
                      <div className="flex items-center gap-1 px-3 border border-gray-300 rounded-md bg-white">
                        <span className="text-xl">{getCountryFlag(formData.telephoneCode)}</span>
                        <select
                          className="border-0 outline-none bg-transparent text-sm"
                          value={formData.telephoneCode}
                          onChange={(e) => setFormData({ ...formData, telephoneCode: e.target.value })}
                        >
                          <option value="+44">+44</option>
                          <option value="+1">+1</option>
                          <option value="+90">+90</option>
                          <option value="+49">+49</option>
                        </select>
                      </div>
                      <Input
                        id="telephone"
                        name="telephone"
                        type="tel"
                        placeholder="(123) 456 67 87"
                        value={formData.telephone}
                        onChange={handleChange}
                        required
                        className="flex-1"
                      />
                    </div>
                  </div>
                </div>

                {/* E-mail address */}
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

              {/* Password Section */}
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

                  {/* Password Strength Indicator */}
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

                    {/* Password Requirements */}
                    <div className="text-xs text-gray-500 space-y-1 mt-3">
                      <div className={passwordStrength.checks.lowercase && passwordStrength.checks.uppercase ? "text-green-600" : ""}>
                        ✓ Küçük ve büyük harf içermeli [a-z / A-Z]
                      </div>
                      <div className={passwordStrength.checks.digits ? "text-green-600" : ""}>
                        {passwordStrength.checks.digits ? "✓" : "○"} En az bir rakam içermeli [0-9]
                      </div>
                      <div className={passwordStrength.checks.length ? "text-green-600" : ""}>
                        {passwordStrength.checks.length ? "✓" : "○"} 8-25 karakter arası olmalı
                      </div>
                      <div className={passwordStrength.checks.special ? "text-green-600" : ""}>
                        {passwordStrength.checks.special ? "✓" : "○"} Özel karakter önerilir [@, #, $, %, vb.]
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
                      {showConfirmPassword ? (
                        <EyeOff className="h-5 w-5" />
                      ) : (
                        <Eye className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                  {!passwordMatch && confirmPassword && (
                    <p className="text-xs text-red-500">Passwords do not match</p>
                  )}
                </div>
              </div>

              {/* Terms of Use */}
              <div className="space-y-3">
                <Label className="text-[18px] font-semibold text-gray-700">
                  Term of Use <span className="text-red-500">*</span>
                </Label>
                <div className="border border-gray-300 rounded-md p-4 max-h-60 overflow-y-auto bg-gray-50">
                  <div className="text-xs text-gray-600 leading-relaxed space-y-2">
                    <h3 className="font-semibold text-gray-800 mb-2">
                      General Terms and Conditions of CC Culinary Collective GmbH
                    </h3>
                    <p>
                      <strong>a.</strong> CC Culinary Collective GmbH is a platform that connects food
                      service establishments. The goal is to increase partner revenues by opening
                      shop-in-shop and cloud kitchen concept branches within stores and to reduce the
                      costs of restaurants offering various services.
                    </p>
                    <p>
                      <strong>b.</strong> No registration or membership fee is charged for membership
                      on the CC platform.
                    </p>
                    <p>
                      <strong>c.</strong> The agreement is concluded for an indefinite period.
                    </p>
                    <p>
                      <strong>d.</strong> Both parties may terminate the agreement with four (4)
                      weeks&apos; notice.
                    </p>
                    <p>
                      <strong>e.</strong> Both contracting parties may transfer their rights and
                      obligations under this agreement to third parties with the consent of the other
                      party.
                    </p>
                    <p>
                      <strong>f.</strong> CC Culinary Collective GmbH is entitled to have individual
                      services performed by third parties in its own name.
                    </p>
                    <p>
                      <strong>g.</strong> During the term of the agreement and for two (2) years after
                      its termination, the restaurant is prohibited from competing with the platform.
                      This includes, in particular, the development or operation of comparable concepts
                      as well as direct or indirect participation in competing companies.
                    </p>
                    <p>
                      <strong>h.</strong> CC Culinary Collective GmbH is liable only in cases of intent
                      or gross negligence. Liability for indirect or consequential damages is excluded.
                      Events of force majeure do not constitute a breach of contract.
                    </p>
                    <p>
                      <strong>i.</strong> Amendments or additions to this agreement must be in writing.
                    </p>
                    <p>
                      <strong>j.</strong> Should individual provisions of this agreement be wholly or
                      partially invalid, the validity of the remaining provisions shall remain
                      unaffected.
                    </p>
                  </div>
                </div>

                {/* Agreement Checkbox */}
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

              {/* Register Button */}
              <div className="flex justify-center">
                <RegisterButton
                  type="submit"
                  disabled={!passwordMatch || !agreedToTerms || !confirmPassword}
                >
                  Register
                </RegisterButton>
              </div>

              {/* Login Link */}
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
