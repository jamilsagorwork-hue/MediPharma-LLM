export async function identifyMedicine(base64Image: string): Promise<string> {
  const response = await fetch("/api/pharma/identify", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ base64Image }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to identify medicine");
  }

  const data = await response.json();
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

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to perform clinical lookup");
  }

  const data = await response.json();
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

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to search molecular equivalents");
  }

  const data = await response.json();
  return data.result;
}
