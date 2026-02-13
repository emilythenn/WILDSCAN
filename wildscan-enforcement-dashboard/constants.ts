
import { Detection } from './types';

// Predefined Sources (Fixed - won't change on case updates)
export const PREDEFINED_SOURCES = [
  "Facebook Marketplace",
  "Instagram",
  "Telegram Channel",
  "WhatsApp Groups",
  "TikTok",
  "Twitter/X",
  "YouTube",
  "WeChat",
  "Mudah.my",
  "Shopee",
  "Lazada",
  "Dark Web Forum",
  "Unknown",
  "Others"
];

// Predefined Locations (Fixed - won't change on case updates)
export const PREDEFINED_LOCATIONS = [
  "Kuala Lumpur",
  "Selangor",
  "Johor Bahru",
  "Penang",
  "Pahang",
  "Kedah",
  "Perak",
  "Terengganu",
  "Kelantan",
  "Kota Bharu",
  "Ipoh",
  "Shah Alam",
  "Subang Jaya",
  "Petaling Jaya",
  "Cyberjaya",
  "Putrajaya",
  "Labuan",
  "Sabah",
  "Sarawak",
  "Online/Unknown",
  "Others"
];

export const mockDetections: Detection[] = [
  {
    id: 'WS-2026-001',
    animal_type: 'Sun Bear',
    source: 'Facebook Marketplace',
    image_url: 'https://picsum.photos/seed/sunbear/600/400',
    lat: 4.2105,
    lng: 101.9758,
    timestamp: new Date().toISOString(),
    priority: 'High',
    confidence: 0.98,
    location_name: 'Pahang, Malaysia',
    user_handle: 'WildLifeTrade_KL',
    description: 'Rare baby Sun Bear available for adoption. Calm temperament. 2 months old.'
  },
  {
    id: 'WS-2026-002',
    animal_type: 'Pangolin',
    source: 'Telegram Channel',
    image_url: 'https://picsum.photos/seed/pangolin/600/400',
    lat: 1.3521,
    lng: 103.8198,
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    priority: 'High',
    confidence: 0.94,
    location_name: 'Johor Bahru',
    user_handle: 'Anon_Exotics_JB',
    description: 'Fresh stocks available. Scales and live subjects. Bulk orders only.'
  },
  {
    id: 'WS-2026-003',
    animal_type: 'Slow Loris',
    source: 'Instagram',
    image_url: 'https://picsum.photos/seed/loris/600/400',
    lat: 5.4141,
    lng: 100.3288,
    timestamp: new Date(Date.now() - 7200000).toISOString(),
    priority: 'Medium',
    confidence: 0.88,
    location_name: 'Penang',
    user_handle: 'CutePets_MY',
    description: 'Special weekend sale. Only 2 left. Cutest eyes you will ever see.'
  },
  {
    id: 'WS-2026-004',
    animal_type: 'Clouded Leopard',
    source: 'Dark Web Forum',
    image_url: 'https://picsum.photos/seed/leopard/600/400',
    lat: 3.1319,
    lng: 101.6841,
    timestamp: new Date(Date.now() - 86400000).toISOString(),
    priority: 'High',
    confidence: 0.99,
    location_name: 'Kuala Lumpur',
    user_handle: 'KingOfJungle',
    description: 'Unique specimen. Sourced from deep jungle. Serious buyers with BTC only.'
  },
  {
    id: 'WS-2026-005',
    animal_type: 'White-Rumped Shama',
    source: 'Mudah.my',
    image_url: 'https://picsum.photos/seed/bird/600/400',
    lat: 6.1254,
    lng: 102.2386,
    timestamp: new Date(Date.now() - 129600000).toISOString(),
    priority: 'Low',
    confidence: 0.72,
    location_name: 'Kota Bharu',
    user_handle: 'MelodyBirds_KB',
    description: 'A-Grade singer. Rare white tail. Perfect for competitions.'
  }
];
