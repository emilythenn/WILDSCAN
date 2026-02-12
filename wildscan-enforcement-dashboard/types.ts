
export interface Detection {
  id: string;
  animal_type: string;
  case_name?: string;
  source: string;
  image_url: string;
  lat: number;
  lng: number;
  timestamp: any; // Firestore Timestamp
  priority: 'High' | 'Medium' | 'Low';
  confidence: number;
  location_name: string;
  user_handle?: string;
  post_url?: string;
  description?: string;
  status?: 'Pending' | 'Investigating' | 'Resolved';
  evidence_hash?: string;
  trust_score?: number;
}

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  label: string;
}
