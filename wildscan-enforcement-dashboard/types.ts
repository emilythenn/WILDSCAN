
export interface EvidenceItem {
  id: string;
  caseId: string;
  fileUrl: string;
  platformSource?: string;
  onlineLink?: string;
  aiSummary?: string;
  hash?: string;
  uploadedAt?: string;
}

export interface Detection {
  id: string;
  animal_type: string;
  case_name?: string;
  source: string;
  platform_source?: string;
  image_url: string;
  lat: number;
  lng: number;
  timestamp: any; // Firestore Timestamp
  priority: 'High' | 'Medium' | 'Low';
  confidence: number;
  confidence_score?: number;
  location_name: string;
  fullAddress?: string;
  species_detected?: string;
  detected_species_name?: string;
  detected_illegal_product?: string;
  ai_scanned_at?: string;
  created_at?: string;
  reason_summary?: string;
  reason?: string;
  risk_score?: number;
  user_handle?: string;
  post_url?: string;
  description?: string;
  status?: 'Pending' | 'Investigating' | 'Resolved';
  evidence_hash?: string;
  trust_score?: number;
  discovery_type?: string;
  evidence_images?: EvidenceItem[];
}

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  label: string;
}
