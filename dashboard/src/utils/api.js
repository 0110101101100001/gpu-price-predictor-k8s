const BASE_URL = import.meta.env.VITE_API_URL || "/api";

export const predict = async (payload) => {
  const response = await fetch(`${BASE_URL}/predict`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Erro ${response.status}: ${response.statusText}`);
  }

  return response.json();
};

export const health = async () => {
  const response = await fetch(`${BASE_URL}/health`);
  if (!response.ok) throw new Error("API indisponível");
  return response.json();
};
