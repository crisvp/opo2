export interface DocumentSource {
  id: string;
  name: string;
  baseUrl: string;
  isEnabled: boolean;
  rateLimitPerSecond: number | null;
  rateLimitPerDay: number | null;
  requiresAuth: boolean;
}

export interface DocumentImportJob {
  id: string;
  sourceId: string;
  userId: string;
  searchQuery: unknown | null;
  documentIds: unknown | null;
  status: string;
  totalRequested: number | null;
  importedCount: number;
  skippedCount: number;
  errorCount: number;
  errorDetails: unknown | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}
