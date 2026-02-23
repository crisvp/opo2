const DC_API_URL = "https://api.www.documentcloud.org/api";

export interface DcDocument {
  id: number;
  slug: string;
  title: string;
  description: string;
  pages: number;
  canonical_url: string;
  created_at: string;
  updated_at: string;
  organization: { name: string } | null;
}

export interface DcSearchResult {
  count: number;
  next: string | null;
  previous: string | null;
  results: DcDocument[];
}

export async function searchDocumentCloud(params: {
  q: string;
  organization?: string;
  project?: string;
  ordering?: string;
  page?: number;
  perPage?: number;
}): Promise<DcSearchResult> {
  const url = new URL(`${DC_API_URL}/documents/`);
  if (params.q) url.searchParams.set("q", params.q);
  if (params.organization) url.searchParams.set("organization", params.organization);
  if (params.project) url.searchParams.set("project", params.project);
  if (params.ordering) url.searchParams.set("ordering", params.ordering);
  if (params.page) url.searchParams.set("page", String(params.page));
  if (params.perPage) url.searchParams.set("per_page", String(params.perPage));

  const response = await fetch(url.toString(), {
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    throw new Error(`DocumentCloud API error: ${response.status}`);
  }

  return response.json() as Promise<DcSearchResult>;
}

export async function getDocumentCloudDocument(id: number): Promise<DcDocument> {
  const response = await fetch(`${DC_API_URL}/documents/${id}/`, {
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    throw new Error(`DocumentCloud API error: ${response.status}`);
  }

  return response.json() as Promise<DcDocument>;
}
