const BASE = process.env.NEXT_PUBLIC_ERP_BASE_URL;

if (!BASE) {
  throw new Error('NEXT_PUBLIC_ERP_BASE_URL environment variable is not set. Please create a .env.local file with NEXT_PUBLIC_ERP_BASE_URL=http://your-erp-url');
}

async function handle(res: Response) {
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText}: ${text}`);
  }
  return text ? JSON.parse(text) : null;
}

export async function erpLogin(email: string, password: string) {
  const res = await fetch(`${BASE}/api/method/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      usr: email,
      pwd: password,
    }),
    cache: 'no-store',
  });
  
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Login failed: ${text}`);
  }
  
  const result = await handle(res);
  
  // Frappe/ERPNext login returns user info on success
  if (result && (result.message === 'Logged In' || result.full_name)) {
    return {
      success: true,
      user: result.full_name || email,
      email: email,
    };
  }
  
  throw new Error('Login failed');
}

export async function erpGet(path: string, token?: string) {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  
  if (token) {
    headers['Authorization'] = `token ${token}`;
  }
  
  const res = await fetch(`${BASE}${path}`, {
    headers,
    cache: 'no-store',
  });
  return handle(res);
}

export async function erpPost(path: string, body: any, token?: string) {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  
  if (token) {
    headers['Authorization'] = `token ${token}`;
  }
  
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  return handle(res);
}

export async function erpPut(path: string, body: any, token?: string) {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  
  if (token) {
    headers['Authorization'] = `token ${token}`;
  }
  
  const res = await fetch(`${BASE}${path}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(body),
  });
  return handle(res);
}