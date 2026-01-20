const BASE_URL = process.env.NEXT_PUBLIC_ERP_BASE_URL;

/**
 * ERPNext token formatını düzelt
 * ERPNext genellikle "token {api_key}:{api_secret}" formatını bekler
 */
export function formatToken(token: string): string {
  if (!token) return token;
  
  // Eğer zaten "token " ile başlıyorsa, olduğu gibi döndür
  if (token.startsWith("token ") || token.startsWith("Token ")) {
    return token;
  }
  
  // Eğer "Bearer " ile başlıyorsa, "token " ile değiştir (ERPNext için)
  if (token.startsWith("Bearer ") || token.startsWith("bearer ")) {
    return token.replace(/^Bearer /i, "token ");
  }
  
  // Eğer sadece api_key:api_secret formatındaysa, "token " ekle
  if (token.includes(":")) {
    return `token ${token}`;
  }
  
  // Diğer durumlarda olduğu gibi döndür
  return token;
}

/**
 * ERPNext'e GET isteği atar.
 */
export async function erpGet(endpoint: string, token?: string) {
  if (!BASE_URL) throw new Error("NEXT_PUBLIC_ERP_BASE_URL tanımlı değil.");
  
  const headers: any = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = formatToken(token);

  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method: "GET",
    headers,
    cache: "no-store",
  });

  if (!res.ok) {
    return null;
  }
  return res.json();
}

/**
 * ERPNext'e POST isteği atar.
 */
export async function erpPost(endpoint: string, data: any, token?: string) {
  if (!BASE_URL) throw new Error("NEXT_PUBLIC_ERP_BASE_URL tanımlı değil.");

  const headers: any = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = formatToken(token);

  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method: "POST",
    headers,
    body: JSON.stringify(data),
  });

  return res.json();
}

/**
 * ERPNext'e PUT isteği atar.
 */
export async function erpPut(endpoint: string, data: any, token?: string) {
  if (!BASE_URL) throw new Error("NEXT_PUBLIC_ERP_BASE_URL tanımlı değil.");

  const headers: any = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = formatToken(token);

  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method: "PUT",
    headers,
    body: JSON.stringify(data),
  });

  return res.json();
}

/**
 * ERPNext'e Login isteği atar. (EKSİK OLAN KISIM BURASIYDI)
 */
export async function erpLogin(data: { usr: string; pwd: string }) {
  if (!BASE_URL) throw new Error("NEXT_PUBLIC_ERP_BASE_URL tanımlı değil.");

  const res = await fetch(`${BASE_URL}/api/method/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
      let msg = "Giriş başarısız.";
      try {
          const json = await res.json();
          msg = json.message || msg;
      } catch {}
      throw new Error(msg);
  }

  return res.json();
}

/**
 * ERPNext'e Dosya Yükler.
 */
export async function erpUploadFile(
  file: File, 
  token: string, 
  options: { 
    doctype?: string; 
    docname?: string; 
    is_private?: number; 
    folder?: string 
  } = {}
) {
  if (!BASE_URL) throw new Error("NEXT_PUBLIC_ERP_BASE_URL tanımlı değil.");

  const formData = new FormData();
  formData.append("file", file, file.name);
  formData.append("is_private", options.is_private ? "1" : "0");
  
  if (options.folder) formData.append("folder", options.folder);
  if (options.doctype && options.docname) {
      formData.append("doctype", options.doctype);
      formData.append("docname", options.docname);
  }

  const res = await fetch(`${BASE_URL}/api/method/upload_file`, {
    method: "POST",
    headers: {
      "Authorization": formatToken(token)
    },
    body: formData,
  });

  if (!res.ok) {
     const errorText = await res.text();
     throw new Error(`File upload failed: ${errorText}`);
  }

  return res.json();
}