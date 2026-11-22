async function fetchResponse(url: string): Promise<Response> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Could not fetch ${url}: ${response.status} ${response.statusText}`,
    );
  }

  return response;
}

export async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetchResponse(url);
  return (await response.json()) as T;
}

export async function fetchText(url: string): Promise<string> {
  const response = await fetchResponse(url);
  return await response.text();
}
