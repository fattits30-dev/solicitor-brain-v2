export interface AIActivity {
  id: string;
  description: string;
  timestamp: string;
  type: 'ocr' | 'rag' | 'draft' | 'privacy' | 'search';
}

export interface DashboardStats {
  activeCases: number;
  documentsProcessed: number;
  aiQueries: number;
  privacyScore: number;
}

export interface RecentCase {
  id: string;
  title: string;
  client: string;
  status: string;
  priority: 'high' | 'medium' | 'low';
  lastActivity: string;
  icon: string;
}
