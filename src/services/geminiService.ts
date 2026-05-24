/**
 * Decodes and processes API responses gracefully.
 * Handles both JSON payloads and HTML fallback pages safely to prevent obscure JSON parse errors.
 */
async function handleResponse(response: Response, defaultError: string): Promise<any> {
  const text = await response.text();
  let data: any = null;
  
  try {
    data = JSON.parse(text);
  } catch (e) {
    const trimmed = text.trim().toLowerCase();
    if (trimmed.startsWith("<!doctype") || trimmed.startsWith("<html")) {
      throw new Error("Server routing issue or fatal error: received HTML page instead of JSON payload.");
    }
    throw new Error(`Server response was unreadable: ${text.substring(0, 200)}`);
  }

  if (!response.ok) {
    throw new Error(data?.error || defaultError);
  }

  return data;
}

export async function identifyMedicine(base64Image?: string, textDescription?: string): Promise<string> {
  const response = await fetch("/api/pharma/identify", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ base64Image, textDescription }),
  });

  const data = await handleResponse(response, "Failed to identify medicine");
  return data.result;
}

export async function getMedicineByDisease(disease: string): Promise<string> {
  const response = await fetch("/api/pharma/disease", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: disease }),
  });

  const data = await handleResponse(response, "Failed to perform clinical lookup");
  return data.result;
}

export async function getAlternativesByGeneric(genericName: string): Promise<string> {
  const response = await fetch("/api/pharma/alternatives", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: genericName }),
  });

  const data = await handleResponse(response, "Failed to search molecular equivalents");
  return data.result;
}
