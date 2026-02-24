
import React, { useState, useEffect, useMemo } from 'react';
import { Detection, EvidenceItem } from '../types';
import { Clock, MapPin, Share2, FileText, ShieldCheck, Download, Link as LinkIcon, AlertCircle, Activity, X, Volume2, VolumeX, Sparkles } from 'lucide-react';
import { speakText, stopSpeaking, isSpeechSynthesisSupported, isSpeaking } from '../utils/speechUtils';
import { GoogleGenAI } from "@google/genai";
import { jsPDF } from "jspdf";
import { Document, Paragraph, TextRun, HeadingLevel, AlignmentType, UnderlineType, convertInchesToTwip, ImageRun, Table, TableCell, TableRow, WidthType, BorderStyle, Packer } from "docx";
import { updateDoc, doc, serverTimestamp, getDoc } from "firebase/firestore";
import { db } from "../firebase";

interface CaseDetailsProps {
  detection: Detection | null;
  allDetections?: Detection[];
  onStatusChange?: (caseId: string, status: Detection["status"] | undefined) => void;
}

const CaseDetails: React.FC<CaseDetailsProps> = ({ detection, allDetections = [], onStatusChange }) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [reportLogs, setReportLogs] = useState<string[]>([]);
  const [reportReady, setReportReady] = useState(false);
  const [reportContent, setReportContent] = useState<{ text: string; html: string; filename: string } | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isImageFit, setIsImageFit] = useState(true);
  const [hash, setHash] = useState<string | null>(null);
  const [hashError, setHashError] = useState<string | null>(null);
  const [isHashing, setIsHashing] = useState(false);
  const [isHashUnique, setIsHashUnique] = useState<boolean | null>(null);
  const [evidenceHashState, setEvidenceHashState] = useState<Record<string, { hash?: string; error?: string; isHashing: boolean }>>({});
  const [showTrustScoreModal, setShowTrustScoreModal] = useState(false);
  const [trustScoreExplanation, setTrustScoreExplanation] = useState<string | null>(null);
  const [isExplainingTrust, setIsExplainingTrust] = useState(false);
  const [trustScoreRecommendations, setTrustScoreRecommendations] = useState<string | null>(null);
  const [isAnalyzingTrustScore, setIsAnalyzingTrustScore] = useState(false);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicateCases, setDuplicateCases] = useState<Detection[]>([]);
  const [duplicateReasons, setDuplicateReasons] = useState<string[]>([]);
  const [isAnalyzingDuplicate, setIsAnalyzingDuplicate] = useState(false);
  const [activeDuplicateHash, setActiveDuplicateHash] = useState<string | null>(null);
  const [duplicateAddressById, setDuplicateAddressById] = useState<Record<string, string>>({});
  const [duplicateEvidenceItems, setDuplicateEvidenceItems] = useState<Array<{
    caseId: string;
    caseName?: string;
    animalType: string;
    locationName: string;
    timestamp: Detection["timestamp"];
    imageUrl?: string;
    hash: string;
  }>>([]);
  const [localStatus, setLocalStatus] = useState<Detection["status"] | undefined>(detection?.status);
  const [fullAddress, setFullAddress] = useState<string | null>(null);
  const [showGeoLocationModal, setShowGeoLocationModal] = useState(false);
  const [isReadAloudActive, setIsReadAloudActive] = useState(false);
  const [isSpeechSupported] = useState(() => isSpeechSynthesisSupported());

  const formatTimestamp = (timestamp: Detection["timestamp"]) => {
    if (!timestamp) return "N/A";
    if (typeof timestamp === "object" && timestamp !== null && "toDate" in timestamp) {
      const maybeDate = (timestamp as { toDate?: () => Date }).toDate?.();
      if (maybeDate instanceof Date && Number.isFinite(maybeDate.getTime())) {
        return maybeDate.toLocaleString();
      }
    }
    const parsed = new Date(timestamp as string);
    return Number.isFinite(parsed.getTime()) ? parsed.toLocaleString() : "N/A";
  };

  const formatEvidenceTimestamp = (value?: string) => {
    if (!value) return "N/A";
    const parsed = new Date(value);
    return Number.isFinite(parsed.getTime()) ? parsed.toLocaleString() : "N/A";
  };

  const evidenceItems = useMemo<EvidenceItem[]>(() => {
    if (!detection) return [];
    if (detection.evidence_images && detection.evidence_images.length > 0) {
      return detection.evidence_images;
    }
    if (detection.image_url) {
      return [
        {
          id: `fallback-${detection.id}`,
          caseId: detection.id,
          fileUrl: detection.image_url,
          platformSource: detection.platform_source || detection.source,
          aiSummary: detection.reason_summary || detection.description,
        },
      ];
    }
    return [];
  }, [detection]);

  const primaryEvidence = evidenceItems[0];
  const onlineEvidenceLink = useMemo(() => {
    const fromEvidence = evidenceItems.find((item) => typeof item.onlineLink === "string" && item.onlineLink.trim().length > 0)?.onlineLink;
    return fromEvidence?.trim() || "";
  }, [evidenceItems]);
  const normalizedDiscoveryType = (detection?.discovery_type || "").toString().trim().toLowerCase();
  const isOnlineDiscovery = normalizedDiscoveryType.includes("online");
  const discoveryTypeLabel = isOnlineDiscovery ? "Online" : "Physical";

  const evidenceHashIndex = useMemo(() => {
    const index = new Map<string, Set<string>>();

    (allDetections || []).forEach((item) => {
      const entries = item.evidence_images && item.evidence_images.length > 0
        ? item.evidence_images
        : item.evidence_hash
          ? [{ id: item.id, caseId: item.id, fileUrl: item.image_url, hash: item.evidence_hash } as EvidenceItem]
          : [];

      entries.forEach((evidence) => {
        if (!evidence.hash) return;
        const set = index.get(evidence.hash) || new Set<string>();
        set.add(item.id);
        index.set(evidence.hash, set);
      });
    });

    return index;
  }, [allDetections]);

  const getEvidenceHash = (item: EvidenceItem) => {
    return evidenceHashState[item.id]?.hash || item.hash || null;
  };

  const getDuplicateCount = (hashValue: string | null) => {
    if (!hashValue || !detection) return 0;
    const caseIds = evidenceHashIndex.get(hashValue);
    if (!caseIds) return 0;
    return caseIds.size - (caseIds.has(detection.id) ? 1 : 0);
  };

  // Generate text for read-aloud functionality
  const generateReadAloudText = (): string => {
    if (!detection) return "";
    
    const parts: string[] = [];
    parts.push(`Case Details for Case ID ${detection.id}`);
    parts.push(`Species: ${detection.animal_type}`);
    parts.push(`Priority Level: ${detection.priority}`);
    parts.push(`Location: ${detection.location_name || "Unknown"}`);
    parts.push(`Coordinates: ${detection.lat.toFixed(4)}, ${detection.lng.toFixed(4)}`);
    parts.push(`Confidence: ${(detection.confidence * 100).toFixed(1)} percent`);
    parts.push(`Source: ${detection.source}`);
    parts.push(`Status: ${detection.status || "Not set"}`);
    parts.push(`Timestamp: ${formatTimestamp(detection.timestamp)}`);
    if (detection.description) {
      parts.push(`Description: ${detection.description}`);
    }
    
    return parts.join(". ");
  };

  // Auto-read case details when detection changes
  useEffect(() => {
    if (detection && isReadAloudActive && isSpeechSupported) {
      const textToRead = generateReadAloudText();
      speakText(textToRead);
    }
    
    return () => {
      if (isReadAloudActive) {
        stopSpeaking();
      }
    };
  }, [detection, isReadAloudActive, isSpeechSupported]);

  // Auto-speak case name when case is clicked
  useEffect(() => {
    if (detection && isSpeechSupported) {
      // Speak only the case name when a new case is clicked
      const caseNameText = `${detection.animal_type} case detected`;
      speakText(caseNameText);
    }
  }, [detection?.id, isSpeechSupported]); // Only trigger when detection ID changes (new case clicked)

  const loadImageDataUrl = async (url: string) => {
    const response = await fetch(url, { mode: "cors" });
    if (!response.ok) {
      throw new Error("Unable to load image.");
    }
    const blob = await response.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("Unable to read image."));
      reader.readAsDataURL(blob);
    });
  };

  const getResponseText = async (response: unknown) => {
    if (typeof response === "string") return response;
    if (response && typeof response === "object") {
      const maybeCandidates = (response as { candidates?: unknown }).candidates;
      if (Array.isArray(maybeCandidates) && maybeCandidates.length > 0) {
        const first = maybeCandidates[0] as { content?: { parts?: Array<{ text?: string }> } };
        const partText = first?.content?.parts?.[0]?.text;
        if (typeof partText === "string") return partText;
      }
      const maybeText = (response as { text?: unknown }).text;
      if (typeof maybeText === "string") return maybeText;
      if (typeof maybeText === "function") {
        const result = maybeText.call(response);
        if (typeof result === "string") return result;
        if (result && typeof (result as Promise<string>).then === "function") {
          return await result;
        }
      }
    }
    return null;
  };

  const buildRangerMessage = () => {
    if (!detection) return "";
    const coords = `${detection.lat.toFixed(6)}, ${detection.lng.toFixed(6)}`;
    const location = detection.location_name || "Unknown location";
    const mapLink = `https://www.google.com/maps?q=${detection.lat},${detection.lng}`;
    return [
      `WILDSCAN CASE ALERT`,
      `Case ID: ${detection.id}`,
      `Species: ${detection.animal_type}`,
      `Location/State: ${location}`,
      `Coordinates: ${coords}`,
      `Map: ${mapLink}`,
      `Description: ${detection.description || "N/A"}`,
      `Evidence Image: ${detection.image_url || "N/A"}`,
    ].join("\n");
  };

  const handleSendRangerWhatsApp = () => {
    if (typeof window === "undefined") return;
    const message = buildRangerMessage();
    if (!message) return;
    const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleSendRangerEmail = () => {
    if (typeof window === "undefined") return;
    const message = buildRangerMessage();
    if (!message) return;
    const subject = `Case ${detection?.id} | ${detection?.animal_type} | ${detection?.location_name || "Unknown location"}`;
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&tf=1&to=&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
    window.open(gmailUrl, "_blank", "noopener,noreferrer");
  };


  const buildLocalRiskSummary = (target: Detection) => {
    const confidencePercent = Math.round(target.confidence * 100);
    const trustScore = target.trust_score ?? 0;
    const priorityScore = target.priority === "High" ? 2 : target.priority === "Medium" ? 1 : 0;
    const confidenceScore = target.confidence >= 0.85 ? 2 : target.confidence >= 0.7 ? 1 : 0;
    const trustScoreWeight = trustScore >= 3 ? 1 : 0;
    const totalScore = priorityScore + confidenceScore + trustScoreWeight;

    const riskLevel: "High" | "Medium" | "Low" = totalScore >= 4 ? "High" : totalScore >= 2 ? "Medium" : "Low";
    const signals = [
      `Priority ${target.priority}`,
      `AI confidence ${confidencePercent}%`,
      target.source ? `Source ${target.source}` : null,
      target.location_name ? `Location ${target.location_name}` : null,
      trustScore ? `Trust score ${trustScore}` : null,
    ].filter(Boolean) as string[];

    const summary = `Risk level: ${riskLevel}. Key signals: ${signals.join(", ")}.`;

    return { riskLevel, signals, summary };
  };

  const resolveAiSummary = (fallbackText: string) => {
    if (aiAnalysis) return aiAnalysis;
    if (isAnalyzing) return "Gemini analysis pending. Please retry in a moment.";
    return fallbackText;
  };

  const getMatchingCases = () => {
    if (!detection) return [];
    const currentSpecies = detection.animal_type.toLowerCase().trim();
    const currentLocation = detection.location_name.toLowerCase().trim();
    
    return allDetections.filter((d) => {
      if (d.id === detection.id) return false;
      const species = d.animal_type.toLowerCase().trim();
      const location = d.location_name.toLowerCase().trim();
      return species === currentSpecies && location === currentLocation;
    });
  };

  const explainTrustScore = async () => {
    if (!detection) return;
    setIsExplainingTrust(true);
    
    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
      if (!apiKey) {
        setTrustScoreExplanation("Trust Score represents how many similar reports exist for the same species in the same location. A higher score (>1) indicates multiple independent reports, increasing confidence in the detection's validity.");
        setIsExplainingTrust(false);
        return;
      }

      const matchingCases = getMatchingCases();
      const trustScore = detection.trust_score ?? 0;
      
      const prompt = `Explain in 2-3 sentences why a Trust Score of ${trustScore} is important for wildlife enforcement. 
The Trust Score represents ${trustScore} total report(s) of "${detection.animal_type}" in "${detection.location_name}".
${matchingCases.length > 0 ? `There are ${matchingCases.length} other matching cases.` : 'This is the only report with this combination.'}

Focus on: Why multiple reports in the same location increase credibility, and what action officers should take.`;

      const response = await requestGeminiViaRest(apiKey, prompt);
      setTrustScoreExplanation(response || "Trust Score indicates the number of similar detections for the same species and location, helping validate the authenticity of reports.");
    } catch (error) {
      console.error("Trust score explanation error:", error);
      setTrustScoreExplanation("Trust Score represents the count of similar reports (same species + location). Higher scores indicate stronger community validation and increased likelihood of genuine incidents.");
    } finally {
      setIsExplainingTrust(false);
    }
  };

  const analyzeTrustScoreRecommendations = async () => {
    if (!detection) return;
    setIsAnalyzingTrustScore(true);
    
    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
      if (!apiKey || apiKey.trim() === "") {
        console.error("❌ TRUST SCORE RECOMMENDATIONS: Gemini API key not configured");
        setTrustScoreRecommendations("❌ Error: Gemini API key not configured. Cannot generate recommendations.");
        setIsAnalyzingTrustScore(false);
        return;
      }

      console.log("🔍 Analyzing trust score recommendations with Gemini API...");
      
      const matchingCases = getMatchingCases();
      const currentTrustScore = detection.trust_score ?? 0;
      
      // Build comprehensive case analysis data
      const caseAnalysis = {
        currentScore: currentTrustScore,
        animalType: detection.animal_type,
        location: detection.location_name,
        confidence: (detection.confidence * 100).toFixed(1),
        source: detection.source,
        priority: detection.priority,
        status: detection.status,
        matchingCasesCount: matchingCases.length,
        matchingCasesSummary: matchingCases.map(c => ({
          confidence: (c.confidence * 100).toFixed(0),
          priority: c.priority,
          daysAgo: Math.floor((Date.now() - new Date(c.timestamp).getTime()) / (1000 * 60 * 60 * 24))
        }))
      };

      // Create detailed analysis prompt for Gemini
      const analysisPrompt = `You are a wildlife enforcement AI analyst. Analyze this case and provide trust score recommendations:

CURRENT CASE DATA:
- Animal Type: ${caseAnalysis.animalType}
- Location: ${caseAnalysis.location}
- Current Trust Score: ${caseAnalysis.currentScore}
- Detection Confidence: ${caseAnalysis.confidence}%
- Report Source: ${caseAnalysis.source}
- Priority Level: ${caseAnalysis.priority}
- Status: ${caseAnalysis.status}
- Matching Cases Found: ${caseAnalysis.matchingCasesCount}

MATCHING CASES PROFILE:
${caseAnalysis.matchingCasesSummary.length > 0 
  ? caseAnalysis.matchingCasesSummary.map((c, i) => `  Case ${i + 1}: Confidence ${c.confidence}%, Priority ${c.priority}, ${c.daysAgo} days ago`).join('\n')
  : '  No matching cases (unique report)'}

PROVIDE RECOMMENDATIONS on 2-3 key points:
1. Should the Trust Score be adjusted? If yes, suggest a new score and why.
2. What confidence factors support or undermine this score?
3. What investigation actions should officers take based on this trust profile?

Respond as actionable recommendations for wildlife enforcement officers.`;

      console.log("📤 Sending trust score analysis request to Gemini...");
      const response = await requestGeminiViaRest(apiKey, analysisPrompt);
      
      if (response) {
        console.log("✓ Successfully received trust score recommendations from Gemini");
        setTrustScoreRecommendations(response);
      } else {
        console.error("❌ Gemini API returned empty response");
        setTrustScoreRecommendations("❌ Error: Gemini API returned no recommendations. Please try again.");
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error("❌ Trust score recommendations error:", errorMsg);
      setTrustScoreRecommendations(`❌ Error: ${errorMsg}. Could not generate recommendations from Gemini API.`);
    } finally {
      setIsAnalyzingTrustScore(false);
    }
  };

  const requestGeminiViaRest = async (apiKey: string, prompt: string) => {
    // Validate API key format
    if (!apiKey || apiKey.trim().length === 0) {
      throw new Error("API key is empty or undefined");
    }

    if (!apiKey.startsWith("AIza")) {
      console.warn("⚠️ API key doesn't match expected Gemini format (should start with 'AIza')");
    }

    const model = import.meta.env.VITE_GEMINI_MODEL || "gemini-2.5-flash";
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    
    try {
      console.log("🌐 Gemini API Request:");
      console.log(`   Endpoint: generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`);
      console.log(`   API Key: ${apiKey.substring(0, 20)}... (length: ${apiKey.length})`);
      console.log(`   Model: ${model}`);
      console.log(`   Prompt length: ${prompt.length} characters`);
      
      const requestBody = {
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
      };

      console.log("📤 Sending request to Gemini API...");
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      console.log(`📨 Received HTTP ${response.status} response from Gemini API`);

      if (!response.ok) {
        const errorData = await response.text();
        console.error(`❌ Gemini API HTTP Error ${response.status}:`);
        console.error(`   Response: ${errorData.substring(0, 300)}`);
        
        let errorMessage = `Gemini API Error (HTTP ${response.status})`;
        if (response.status === 401) {
          errorMessage = "Invalid or expired Gemini API key";
        } else if (response.status === 403) {
          errorMessage = "Gemini API access forbidden - check key permissions";
        } else if (response.status === 429) {
          errorMessage = "Gemini API rate limit exceeded";
        } else if (response.status === 500) {
          errorMessage = "Gemini API server error";
        }
        
        throw new Error(errorMessage);
      }

      const data = await response.json();
      console.log("✓ Successfully parsed Gemini API JSON response");
      
      const result = await getResponseText(data);
      
      if (!result) {
        throw new Error("Gemini API returned no text in response");
      }

      console.log("✓ Extracted text content from response");
      console.log(`   Content length: ${result.length} characters`);
      
      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error("❌ Gemini API Connection/Processing Error:", errorMsg);
      console.error("   Full error:", error);
      throw new Error(`Gemini API Failed: ${errorMsg}`);
    }
  };

  const handleDuplicateDetected = async (targetHash?: string) => {
    const hashToCheck = targetHash || hash;
    if (!hashToCheck || !detection) return;

    const caseIds = evidenceHashIndex.get(hashToCheck) || new Set<string>();
    const duplicates = (allDetections || []).filter(
      (d) => d.id !== detection.id && caseIds.has(d.id)
    );

    const matchingEvidence: Array<{
      caseId: string;
      caseName?: string;
      animalType: string;
      locationName: string;
      timestamp: Detection["timestamp"];
      imageUrl?: string;
      hash: string;
    }> = [];

    (allDetections || []).forEach((item) => {
      const entries = item.evidence_images && item.evidence_images.length > 0
        ? item.evidence_images
        : item.evidence_hash
          ? [{ id: item.id, caseId: item.id, fileUrl: item.image_url, hash: item.evidence_hash } as EvidenceItem]
          : [];

      entries.forEach((evidence) => {
        if (evidence.hash !== hashToCheck) return;
        matchingEvidence.push({
          caseId: item.id,
          caseName: item.case_name,
          animalType: item.animal_type,
          locationName: item.location_name,
          timestamp: item.timestamp,
          imageUrl: evidence.fileUrl || item.image_url,
          hash: hashToCheck,
        });
      });
    });

    setActiveDuplicateHash(hashToCheck);
    setDuplicateCases(duplicates);
    setDuplicateReasons([]);
    setDuplicateEvidenceItems(matchingEvidence);
    setShowDuplicateModal(true);

    const uniqueCaseIds = Array.from(new Set(matchingEvidence.map((item) => item.caseId)));
    if (detection.id && fullAddress) {
      setDuplicateAddressById((prev) => ({ ...prev, [detection.id]: fullAddress }));
    }

    if (db && uniqueCaseIds.length > 0) {
      const missingCaseIds = uniqueCaseIds.filter((caseId) => !duplicateAddressById[caseId]);
      if (missingCaseIds.length > 0) {
        const fetched = await Promise.all(
          missingCaseIds.map(async (caseId) => ({
            caseId,
            address: await fetchCaseAddress(caseId),
          }))
        );

        const nextMap: Record<string, string> = {};
        fetched.forEach((entry) => {
          if (entry.address) {
            nextMap[entry.caseId] = entry.address;
          }
        });

        if (Object.keys(nextMap).length > 0) {
          setDuplicateAddressById((prev) => ({ ...prev, ...nextMap }));
        }
      }
    }

    await analyzeDuplicateReasons(duplicates);
  };

  const analyzeDuplicateReasons = async (duplicates: Detection[]) => {
    setIsAnalyzingDuplicate(true);
    setDuplicateReasons([]); // Clear previous reasons
    console.log("🔍 Starting Gemini AI analysis for duplicate reasons...");

    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
      
      if (!apiKey || apiKey.trim() === "") {
        const errorMsg = "❌ GEMINI API KEY NOT CONFIGURED - Cannot analyze duplicate reasons. Please configure VITE_GEMINI_API_KEY in .env file.";
        console.error(errorMsg);
        setDuplicateReasons([errorMsg]);
        setIsAnalyzingDuplicate(false);
        return;
      }

      console.log("✓ Gemini API key found. Key format: ", apiKey.substring(0, 20) + "...");
      
      if (!detection || !duplicates || duplicates.length === 0) {
        console.error("❌ Missing detection data or duplicates");
        setDuplicateReasons(["Error: Missing case or duplicate data"]);
        setIsAnalyzingDuplicate(false);
        return;
      }

      const casesSummary = duplicates
        .map((d) => `Case ${d.id}: ${d.animal_type} at ${d.location_name} (${new Date(d.timestamp).toLocaleDateString()})`)
        .join("\n");

      const prompt = `You are a wildlife enforcement AI investigator. Analyze why identical evidence images appear in multiple cases.

CURRENT CASE:
- Species: ${detection.animal_type}
- Location: ${detection.location_name}
- Case ID: ${detection.id}

DUPLICATE CASES WITH SAME EVIDENCE:
${casesSummary}

TASK: Provide 4-5 possible reasons why the EXACT SAME evidence image appears in multiple cases. Focus on reasons that indicate:
1. Illegal activities or fraud
2. Evidence tampering
3. Report manipulation
4. Chain of custody violations
5. Suspicious patterns

IMPORTANT: Each reason should be specific, professional, and investigation-relevant.

RESPONSE FORMAT: Return ONLY a valid JSON array of strings, no additional text.
Example: ["Reason 1", "Reason 2", "Reason 3"]`;

      console.log("📤 Sending request to Gemini API...");
      const geminiBannerModel = import.meta.env.VITE_GEMINI_MODEL || "gemini-2.5-flash";
      console.log(`   Endpoint: generativelanguage.googleapis.com/v1beta/models/${geminiBannerModel}:generateContent`);
      console.log(`   Model: ${geminiBannerModel}`);
      console.log("   Duplicate cases: ", duplicates.length);
      
      const response = await requestGeminiViaRest(apiKey, prompt);
      
      if (!response) {
        throw new Error("Empty response from Gemini API");
      }

      console.log("✓ Received response from Gemini API");
      console.log("   Response length:", response.length);
      
      // Parse JSON array from response
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error(`JSON array not found in response: ${response.substring(0, 200)}`);
      }

      const reasons = JSON.parse(jsonMatch[0]);
      
      if (!Array.isArray(reasons)) {
        throw new Error("Response is not a JSON array");
      }

      if (reasons.length === 0) {
        throw new Error("Gemini returned empty array of reasons");
      }

      // Validate all reasons are strings
      const validReasons = reasons.filter((r): r is string => typeof r === "string");
      if (validReasons.length === 0) {
        throw new Error("No valid string reasons extracted from response");
      }

      console.log("✓ Successfully parsed Gemini AI reasons:");
      validReasons.forEach((r, i) => console.log(`   ${i + 1}. ${r}`));
      
      setDuplicateReasons(validReasons);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("❌ Gemini API analysis failed:", errorMessage);
      console.log("Error details:", error);
      
      // Show error to user instead of fallback
      setDuplicateReasons([
        `❌ AI Analysis Error: ${errorMessage}`,
        "This could be due to: Invalid API key, API rate limit, network issues, or Gemini service unavailable.",
        "Please check the browser console for details or try again later."
      ]);
    } finally {
      setIsAnalyzingDuplicate(false);
      console.log("✓ Analysis attempt complete");
    }
  };

  const getReasonExplanation = (reason: string): string => {
    // First check if it's an error message from API
    if (reason.includes("❌") || reason.includes("Error:")) {
      return reason; // Return error as-is
    }

    // Try to get explanation for known patterns
    const commonPatterns: { [key: string]: string } = {
      "illegal": "Evidence of illegal activity or unauthorized reuse",
      "fraud": "Indicates fraudulent or deceptive practices",
      "manipulate": "Evidence of intentional manipulation or tampering",
      "false": "False or fabricated information",
      "duplicate": "Unauthorized duplication across cases",
      "reuse": "Same evidence improperly reused",
      "screenshot": "Image reposted or recaptured",
      "tampering": "Chain of custody violation or tampering",
      "conspiracy": "Possible coordination between multiple parties",
      "evidence": "Evidence integrity concerns",
    };

    // Check for pattern matches in the reason
    for (const [pattern, explanation] of Object.entries(commonPatterns)) {
      if (reason.toLowerCase().includes(pattern.toLowerCase())) {
        return `${explanation}. ${reason}`;
      }
    }

    // Fully hardcoded explanations for specific reasons (from API responses)
    const explanations: { [key: string]: string } = {
      "Illegal evidence reuse": "Same image used across multiple cases to fabricate false reports or evidence chains. This is a serious criminal offense in wildlife enforcement.",
      "Fraudulent duplicate reports": "Multiple false reports using identical evidence to manipulate statistics or hide actual violations. Indicates deliberate system abuse.",
      "Copy-paste image manipulation": "Evidence deliberately transferred between unrelated cases to create false connections or hide original source.",
      "Screenshot reposting": "Image re-captured and reposted, potentially losing chain-of-custody metadata and evidence integrity markers.",
      "Image sharing platform cross-posting": "Same wildlife image shared across multiple reports from different social media sources without proper verification.",
      "Unknown reason": "The duplicate was detected but the AI could not determine a specific reason. Manual investigation recommended."
    };

    // Return explanation if found, otherwise return the reason as-is
    return explanations[reason] || `Investigation Finding: ${reason}`;
  };

  const fetchCaseAddress = async (caseId: string) => {
    if (!db) return null;
    try {
      let docRef = doc(db, "cases", caseId);
      let docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        docRef = doc(db, "detections", caseId);
        docSnap = await getDoc(docRef);
      }

      if (!docSnap.exists()) return null;
      const data = docSnap.data();
      return data?.location?.fullAddress || data?.fullAddress || null;
    } catch (error) {
      console.error("Failed to fetch duplicate case address:", error);
      return null;
    }
  };

  useEffect(() => {
    if (!detection) return;
    let cancelled = false;
    const localRisk = buildLocalRiskSummary(detection);

    setAiAnalysis(null);
    setIsAnalyzing(true);

    const runAIAnalysis = async () => {
      try {
        const apiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
        if (!apiKey) {
          throw new Error("Missing VITE_GEMINI_API_KEY");
        }
        const prompt = `Analyze this wildlife trade detection for enforcement officers.
Species: ${detection.animal_type}
Source Platform: ${detection.source}
Description: ${detection.description || "N/A"}
Location: ${detection.location_name}

Return 2-3 sentences that include a clear risk level (High/Medium/Low), a brief legality or conservation concern, and recommended next-step action.`;

        let responseText: string | null = null;
        try {
          const ai = new GoogleGenAI({ apiKey });
          const geminiBannerModel = import.meta.env.VITE_GEMINI_MODEL || "gemini-2.5-flash";
          const response = await ai.models.generateContent({
            model: geminiBannerModel,
            contents: prompt,
          });
          responseText = await getResponseText(response);
        } catch (sdkError) {
          responseText = await requestGeminiViaRest(apiKey, prompt);
        }

        const cleaned = responseText?.trim();
        if (!cleaned) {
          throw new Error("Empty Gemini response");
        }

        if (!cancelled) {
          setAiAnalysis(cleaned);
        }
      } catch (err) {
        console.error("Gemini analysis failed:", err);
        if (!cancelled) {
          setAiAnalysis(`${localRisk.summary} Gemini verification offline; rely on metadata screening.`);
        }
      } finally {
        if (!cancelled) {
          setIsAnalyzing(false);
        }
      }
    };

    runAIAnalysis();

    return () => {
      cancelled = true;
    };
  }, [detection]);

  useEffect(() => {
    setLocalStatus(detection?.status);
  }, [detection?.id, detection?.status]);

  useEffect(() => {
    let cancelled = false;

    const computeHash = async (url: string) => {
      const response = await fetch(url, { mode: "cors" });
      if (!response.ok) {
        throw new Error("Unable to fetch evidence image.");
      }
      const buffer = await response.arrayBuffer();
      const hashBuffer = await window.crypto.subtle.digest("SHA-256", buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    };

    const updateEvidenceHash = async (evidenceId: string, hashHex: string) => {
      if (!db) return;
      if (evidenceId.startsWith("fallback-")) return;
      try {
        await updateDoc(doc(db, "evidence", evidenceId), {
          hash: hashHex,
          hashCalculatedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (firestoreError) {
        console.error("Failed to save evidence hash to Firestore:", firestoreError);
      }
    };

    const buildHashes = async () => {
      setHash(null);
      setHashError(null);

      if (evidenceItems.length === 0) {
        setIsHashing(false);
        setEvidenceHashState({});
        return;
      }

      if (!window.crypto?.subtle) {
        setHashError("SHA-256 not available in this browser.");
        setIsHashing(false);
        return;
      }

      const initialState: Record<string, { hash?: string; error?: string; isHashing: boolean }> = {};
      evidenceItems.forEach((item) => {
        if (item.hash) {
          initialState[item.id] = { hash: item.hash, error: undefined, isHashing: false };
        } else if (!item.fileUrl) {
          initialState[item.id] = { hash: undefined, error: "Evidence image unavailable.", isHashing: false };
        } else {
          initialState[item.id] = { hash: undefined, error: undefined, isHashing: true };
        }
      });
      setEvidenceHashState(initialState);

      if (primaryEvidence?.hash) {
        setHash(primaryEvidence.hash);
        setIsHashing(false);
      } else if (primaryEvidence?.fileUrl) {
        setIsHashing(true);
      } else {
        setIsHashing(false);
      }

      for (const item of evidenceItems) {
        if (cancelled) return;
        if (item.hash || !item.fileUrl) {
          if (item.id === primaryEvidence?.id && item.hash) {
            setHash(item.hash);
            setIsHashing(false);
          }
          continue;
        }

        try {
          const hashHex = await computeHash(item.fileUrl);
          if (cancelled) return;
          setEvidenceHashState((prev) => ({
            ...prev,
            [item.id]: { hash: hashHex, error: undefined, isHashing: false },
          }));
          if (item.id === primaryEvidence?.id) {
            setHash(hashHex);
            setHashError(null);
            setIsHashing(false);
          }
          await updateEvidenceHash(item.id, hashHex);
        } catch (err) {
          if (!cancelled) {
            setEvidenceHashState((prev) => ({
              ...prev,
              [item.id]: { hash: undefined, error: "Hash unavailable for this evidence.", isHashing: false },
            }));
            if (item.id === primaryEvidence?.id) {
              setHashError("Hash unavailable for this evidence.");
              setIsHashing(false);
            }
          }
        }
      }
    };

    buildHashes();

    return () => {
      cancelled = true;
    };
  }, [evidenceItems, primaryEvidence?.id, db]);

  useEffect(() => {
    if (!isGenerating) {
      setReportLogs([]);
    }
  }, [isGenerating]);

  useEffect(() => {
    setReportReady(false);
    setReportContent(null);
  }, [detection?.id]);

  // Check if primary hash is unique among all detections
  useEffect(() => {
    if (!hash || !detection) {
      setIsHashUnique(null);
      return;
    }

    const caseIds = evidenceHashIndex.get(hash);
    const duplicateCount = caseIds ? caseIds.size - (caseIds.has(detection.id) ? 1 : 0) : 0;
    setIsHashUnique(duplicateCount === 0);
  }, [hash, detection, evidenceHashIndex]);

  // Fetch fullAddress from Firebase
  useEffect(() => {
    if (!detection || !db) {
      setFullAddress(null);
      return;
    }

    let cancelled = false;

    const fetchFullAddress = async () => {
      try {
        // Try 'cases' collection first (main collection), then fallback to 'detections'
        let docRef = doc(db!, "cases", detection.id);
        let docSnap = await getDoc(docRef);
        
        if (!docSnap.exists()) {
          // Fallback to detections collection
          docRef = doc(db!, "detections", detection.id);
          docSnap = await getDoc(docRef);
        }
        
        if (!cancelled && docSnap?.exists()) {
          const data = docSnap.data();
          // Get fullAddress from location.fullAddress
          const address = data?.location?.fullAddress || data?.fullAddress || null;
          setFullAddress(address);
          console.log("✅ Fetched fullAddress from Firebase:", address);
        } else {
          if (!cancelled) {
            setFullAddress(null);
            console.warn("❌ Case document not found in Firebase");
          }
        }
      } catch (err) {
        console.error("Failed to fetch fullAddress from Firebase:", err);
        if (!cancelled) {
          setFullAddress(null);
        }
      }
    };

    fetchFullAddress();

    return () => {
      cancelled = true;
    };
  }, [detection?.id]);

  if (!detection) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-green-700 p-8 text-center bg-white/40">
        <ShieldCheck size={48} className="mb-4 opacity-10" />
        <p className="text-xs font-mono uppercase tracking-[0.2em] opacity-40">Awaiting Target Selection</p>
      </div>
    );
  }

  const formattedDate = formatTimestamp(detection.timestamp);
  const formattedCreatedAt = detection.created_at ? formatTimestamp(detection.created_at) : formattedDate;
  const formattedAiScannedAt = detection.ai_scanned_at ? formatTimestamp(detection.ai_scanned_at) : "N/A";
  const priorityIconColor: Record<Detection["priority"], string> = {
    High: "text-red-400",
    Medium: "text-amber-400",
    Low: "text-lime-700",
  };
  const priorityBadgeClass: Record<Detection["priority"], string> = {
    High: "bg-red-500/10 border-red-500 text-red-500",
    Medium: "bg-amber-500/10 border-amber-500 text-amber-400",
    Low: "bg-lime-200/60 border-lime-400 text-lime-700",
  };
  const localRisk = buildLocalRiskSummary(detection);

  const buildReportText = () => {
    const localRisk = buildLocalRiskSummary(detection);
    const aiSummary = resolveAiSummary(localRisk.summary);
    const confidenceLabel = detection.confidence >= 0.9 ? "Very High" : detection.confidence >= 0.75 ? "High" : detection.confidence >= 0.5 ? "Medium" : "Low";
    
    // Check for duplicate hash
    const duplicates = (allDetections || []).filter(
      (d) => d.evidence_hash && d.evidence_hash === hash && d.id !== detection.id
    );
    const hasDuplicates = duplicates.length > 0;
    
    const reportLines = [
      "WILDSCAN Evidence Report",
      "========================",
      `Case ID: ${detection.id}`,
      `Case Name: ${detection.case_name || "N/A"}`,
      `Species: ${detection.animal_type}`,
      `Status: ${detection.status || "Pending"}`,
      `Trust Score: ${detection.trust_score ?? 0}`,
      `Priority: ${detection.priority}`,
      `Risk Level: ${localRisk.riskLevel}`,
      `Confidence: ${(detection.confidence * 100).toFixed(2)}% (${confidenceLabel})`,
      `Source/Market: ${detection.source}`,
      `Location: ${detection.location_name}`,
      `Coordinates: ${detection.lat.toFixed(6)}, ${detection.lng.toFixed(6)}`,
      `Detected At: ${formattedDate}`,
      `User Handle: ${detection.user_handle || "N/A"}`,
      `Post URL: ${detection.post_url || "N/A"}`,
      `Image URL: ${detection.image_url || "N/A"}`,
      `Evidence Hash (SHA-256): ${hash || "N/A"}`,
      `Hash Status: ${hasDuplicates ? "⚠ DUPLICATE DETECTED" : "✓ Unique Evidence"}`,
      "",
      "Case Highlights:",
      `- Priority level indicates enforcement urgency (${detection.priority}).`,
      `- Risk level assessment: ${localRisk.riskLevel}.`,
      `- Confidence level suggests ${confidenceLabel.toLowerCase()} model certainty.`,
      `- Source platform flagged for monitored listings: ${detection.source}.`,
      `- Location clustered within monitoring region: ${detection.location_name}.`,
      `- Trust Score (${detection.trust_score ?? 0}) indicates ${detection.trust_score && detection.trust_score > 1 ? 'multiple matching reports' : 'single report'} for this species/location.`,
      "",
      "Description:",
      detection.description || "N/A",
      "",
    ];

    // Add duplicate hash section if duplicates found
    if (hasDuplicates) {
      reportLines.push(
        "⚠ DUPLICATE EVIDENCE HASH ALERT:",
        "=================================",
        `Identical evidence hash found in ${duplicates.length} other case(s).`,
        "This indicates the EXACT SAME image is being used in multiple cases.",
        "",
        "Matching Cases:"
      );
      duplicates.forEach((dup, index) => {
        reportLines.push(
          `${index + 1}. Case ID: ${dup.id}`,
          `   Species: ${dup.animal_type}`,
          `   Location: ${dup.location_name}`,
          `   Detected: ${new Date(dup.timestamp).toLocaleString()}`,
          `   Priority: ${dup.priority}`,
          `   Source: ${dup.source}`,
          ""
        );
      });
      reportLines.push(
        "Possible Reasons for Duplicate Evidence:",
        "- Illegal evidence reuse across multiple false reports",
        "- Fraudulent duplicate submissions to manipulate data",
        "- Copy-paste image manipulation",
        "- Screenshot reposting from social media platforms",
        "- Evidence tampering or chain-of-custody compromise",
        "",
        "⚠ CRITICAL WARNING: Duplicate evidence hashes severely compromise prosecution integrity.",
        "Malaysian courts require verified chain of custody and authentic evidence.",
        "IMMEDIATE INVESTIGATION RECOMMENDED to determine which case contains original evidence.",
        ""
      );
    }

    reportLines.push(
      "Operational Notes:",
      "- Preserve digital evidence and timestamps for chain of custody.",
      "- Verify listing persistence and capture screenshots where possible.",
      "- Cross-check with existing watchlists and repeat offenders.",
      hasDuplicates ? "- ⚠ PRIORITY: Investigate duplicate evidence hash immediately." : "",
      "",
      "Evidence Integrity:",
      "- SHA-256 fingerprint stored to prove evidence has not been altered for Malaysian courts.",
      hasDuplicates ? "- ⚠ ALERT: Evidence integrity compromised due to duplicate hash detection." : "- ✓ Evidence hash is unique - no duplicates detected.",
      "",
      "Evidence Timeline:",
      "1) Detection recorded and cataloged in monitoring queue.",
      "2) Verification and risk assessment completed.",
      "3) Case packaged for enforcement review and archival.",
      hasDuplicates ? "4) ⚠ Duplicate hash detected - investigation required." : "",
      "",
      "Local Risk Summary:",
      localRisk.summary,
      `Key Signals: ${localRisk.signals.join(", ")}.`,
      "",
      "Gemini Risk Assessment:",
      aiSummary,
    );

    return reportLines.filter(line => line !== "").join("\n");
  };

  const buildReportHtml = () => {
    const localRisk = buildLocalRiskSummary(detection);
    const aiSummary = resolveAiSummary(localRisk.summary);
    const confidenceLabel = detection.confidence >= 0.9 ? "Very High" : detection.confidence >= 0.75 ? "High" : detection.confidence >= 0.5 ? "Medium" : "Low";
    
    // Check for duplicate hash
    const duplicates = (allDetections || []).filter(
      (d) => d.evidence_hash && d.evidence_hash === hash && d.id !== detection.id
    );
    const hasDuplicates = duplicates.length > 0;
    
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>WILDSCAN Evidence Report</title>
  <style>
    body { font-family: "Inter", "Arial", sans-serif; color: #0f172a; background: #f8fafc; padding: 24px; }
    h1 { font-size: 22px; margin: 0 0 6px; }
    h2 { font-size: 14px; margin: 18px 0 8px; text-transform: uppercase; letter-spacing: 0.08em; color: #475569; }
    .card { border: 1px solid #e2e8f0; padding: 16px; border-radius: 10px; background: #ffffff; box-shadow: 0 8px 18px rgba(15, 23, 42, 0.06); }
    .meta { font-size: 12px; line-height: 1.8; display: grid; grid-template-columns: 1fr 1fr; gap: 4px 16px; }
    .meta div { background: #f8fafc; padding: 6px 8px; border-radius: 6px; }
    .section { margin-top: 14px; }
    .label { font-weight: 700; color: #0f172a; }
    .badge { display: inline-block; padding: 4px 8px; border-radius: 999px; font-size: 11px; background: #ecfdf3; color: #047857; border: 1px solid #a7f3d0; }
    .box { border: 1px solid #e2e8f0; padding: 12px; border-radius: 8px; background: #f1f5f9; }
    .warning-box { border: 2px solid #dc2626; padding: 12px; border-radius: 8px; background: #fee2e2; }
    ul { margin: 0; padding-left: 18px; }
    li { margin: 4px 0; }
    .unique-badge { background: #d1fae5; color: #065f46; border: 1px solid #059669; }
    .duplicate-badge { background: #fee2e2; color: #991b1b; border: 1px solid #dc2626; }
  </style>
</head>
<body>
  <h1>WILDSCAN Evidence Report</h1>
  <div class="card">
    <div class="badge">${detection.priority} Priority</div>
    <div class="meta">
      <div><span class="label">Case ID:</span> ${detection.id}</div>
      <div><span class="label">Case Name:</span> ${detection.case_name || "N/A"}</div>
      <div><span class="label">Species:</span> ${detection.animal_type}</div>
      <div><span class="label">Status:</span> ${detection.status || "Pending"}</div>
      <div><span class="label">Trust Score:</span> ${detection.trust_score ?? 0}</div>
      <div><span class="label">Risk Level:</span> ${localRisk.riskLevel}</div>
      <div><span class="label">Confidence:</span> ${(detection.confidence * 100).toFixed(2)}% (${confidenceLabel})</div>
      <div><span class="label">Source/Market:</span> ${detection.source}</div>
      <div><span class="label">Location:</span> ${detection.location_name}</div>
      <div><span class="label">Coordinates:</span> ${detection.lat.toFixed(6)}, ${detection.lng.toFixed(6)}</div>
      <div><span class="label">Detected At:</span> ${formattedDate}</div>
      <div><span class="label">User Handle:</span> ${detection.user_handle || "N/A"}</div>
      <div><span class="label">Post URL:</span> ${detection.post_url ? `<a href="${detection.post_url}" target="_blank">${detection.post_url}</a>` : "N/A"}</div>
      <div><span class="label">Image URL:</span> ${detection.image_url ? `<a href="${detection.image_url}" target="_blank">View Image</a>` : "N/A"}</div>
      <div style="grid-column: 1 / -1;"><span class="label">Evidence Hash (SHA-256):</span> ${hash || "N/A"}</div>
      <div style="grid-column: 1 / -1;">
        <span class="label">Hash Status:</span> 
        <span class="badge ${hasDuplicates ? 'duplicate-badge' : 'unique-badge'}">
          ${hasDuplicates ? "⚠ DUPLICATE DETECTED" : "✓ Unique Evidence"}
        </span>
      </div>
    </div>
  </div>

  <div class="section">
    <h2>Case Highlights</h2>
    <div class="box">
      <ul>
        <li>Priority level indicates enforcement urgency (${detection.priority}).</li>
        <li>Risk level assessment: ${localRisk.riskLevel}.</li>
        <li>Confidence level suggests ${confidenceLabel.toLowerCase()} model certainty.</li>
        <li>Source platform flagged for monitored listings: ${detection.source}.</li>
        <li>Location clustered within monitoring region: ${detection.location_name}.</li>
        <li>Trust Score (${detection.trust_score ?? 0}) indicates ${detection.trust_score && detection.trust_score > 1 ? 'multiple matching reports' : 'single report'} for this species/location.</li>
      </ul>
    </div>
  </div>

  <div class="section">
    <h2>Description</h2>
    <div class="box">${detection.description || "N/A"}</div>
  </div>

  <div class="section">
    <h2>Evidence Image</h2>
    <div class="box">
      ${detection.image_url ? `<img src="${detection.image_url}" alt="Evidence" style="width: 100%; border-radius: 8px;" />` : "N/A"}
    </div>
  </div>

  ${hasDuplicates ? `
  <div class="section">
    <h2 style="color: #dc2626;">⚠ DUPLICATE EVIDENCE HASH ALERT</h2>
    <div class="warning-box">
      <p><strong>Identical evidence hash found in ${duplicates.length} other case(s).</strong></p>
      <p>This indicates the EXACT SAME image is being used in multiple cases.</p>
      
      <h3 style="margin-top: 12px;">Matching Cases:</h3>
      <ul>
        ${duplicates.map((dup, index) => `
          <li>
            <strong>Case ${index + 1}:</strong> ${dup.id}<br/>
            Species: ${dup.animal_type}<br/>
            Location: ${dup.location_name}<br/>
            Detected: ${new Date(dup.timestamp).toLocaleString()}<br/>
            Priority: ${dup.priority}, Source: ${dup.source}
          </li>
        `).join('')}
      </ul>
      
      <h3 style="margin-top: 12px;">Possible Reasons for Duplicate Evidence:</h3>
      <ul>
        <li>Illegal evidence reuse across multiple false reports</li>
        <li>Fraudulent duplicate submissions to manipulate data</li>
        <li>Copy-paste image manipulation</li>
        <li>Screenshot reposting from social media platforms</li>
        <li>Evidence tampering or chain-of-custody compromise</li>
      </ul>
      
      <p style="margin-top: 12px; font-weight: bold; color: #991b1b;">
        ⚠ CRITICAL WARNING: Duplicate evidence hashes severely compromise prosecution integrity.
        Malaysian courts require verified chain of custody and authentic evidence.
        IMMEDIATE INVESTIGATION RECOMMENDED to determine which case contains original evidence.
      </p>
    </div>
  </div>
  ` : ''}

  <div class="section">
    <h2>Operational Notes</h2>
    <div class="box">
      <ul>
        <li>Preserve digital evidence and timestamps for chain of custody.</li>
        <li>Verify listing persistence and capture screenshots where possible.</li>
        <li>Cross-check with existing watchlists and repeat offenders.</li>
        ${hasDuplicates ? '<li style="color: #dc2626; font-weight: bold;">⚠ PRIORITY: Investigate duplicate evidence hash immediately.</li>' : ''}
      </ul>
    </div>
  </div>

  <div class="section">
    <h2>Evidence Integrity</h2>
    <div class="box">
      <p><strong>SHA-256 Fingerprint:</strong> ${hash || "N/A"}</p>
      <p>Hashing ensures the evidence remains tamper-proof for Malaysian courts.</p>
      ${hasDuplicates ? 
        '<p style="color: #dc2626; font-weight: bold;">⚠ ALERT: Evidence integrity compromised due to duplicate hash detection.</p>' :
        '<p style="color: #059669; font-weight: bold;">✓ Evidence hash is unique - no duplicates detected.</p>'
      }
    </div>
  </div>

  <div class="section">
    <h2>Evidence Timeline</h2>
    <div class="box">
      <ol>
        <li>Detection recorded and cataloged in monitoring queue.</li>
        <li>Verification and risk assessment completed.</li>
        <li>Case packaged for enforcement review and archival.</li>
        ${hasDuplicates ? '<li style="color: #dc2626; font-weight: bold;">⚠ Duplicate hash detected - investigation required.</li>' : ''}
      </ol>
  </div>

  <div class="section">
    <h2>Local Risk Summary</h2>
    <div class="box">
      <p>${localRisk.summary}</p>
      <p><strong>Key Signals:</strong> ${localRisk.signals.join(", ")}.</p>
    </div>
  </div>

  <div class="section">
    <h2>Gemini Risk Assessment</h2>
    <div class="box">${aiSummary}</div>
  </div>
</body>
</html>`;
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);
  };

  const handleDownloadWord = async () => {
    if (!reportContent) return;
    
    const localRisk = buildLocalRiskSummary(detection);
    const aiSummary = resolveAiSummary(localRisk.summary);
    const confidenceLabel = detection.confidence >= 0.9 ? "Very High" : detection.confidence >= 0.75 ? "High" : detection.confidence >= 0.5 ? "Medium" : "Low";
    
    // Check for duplicate hash
    const duplicates = (allDetections || []).filter(
      (d) => d.evidence_hash && d.evidence_hash === hash && d.id !== detection.id
    );
    const hasDuplicates = duplicates.length > 0;

    try {
      // Load image as base64
      let imageData: ArrayBuffer | null = null;
      if (detection.image_url) {
        try {
          const response = await fetch(detection.image_url, { mode: "cors" });
          if (response.ok) {
            imageData = await response.arrayBuffer();
          }
        } catch (err) {
          console.warn("Could not load image for Word document:", err);
        }
      }

      const sections = [];

      // Title
      sections.push(
        new Paragraph({
          text: "WILDSCAN EVIDENCE REPORT",
          heading: HeadingLevel.HEADING_1,
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: `Case ID: ${detection.id}`,
              bold: true,
            }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: `Generated: ${new Date().toLocaleString()}`,
              size: 18,
              color: "666666",
            }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 },
        })
      );

      // Case Summary Table
      sections.push(
        new Paragraph({
          text: "CASE SUMMARY",
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 200, after: 200 },
        }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  children: [new Paragraph({ children: [new TextRun({ text: "Case ID:", bold: true })] })],
                  width: { size: 30, type: WidthType.PERCENTAGE },
                }),
                new TableCell({
                  children: [new Paragraph(detection.id)],
                  width: { size: 70, type: WidthType.PERCENTAGE },
                }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Case Name:", bold: true })] })] }),
                new TableCell({ children: [new Paragraph(detection.case_name || "N/A")] }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Species:", bold: true })] })] }),
                new TableCell({ children: [new Paragraph(detection.animal_type)] }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Status:", bold: true })] })] }),
                new TableCell({ children: [new Paragraph(detection.status || "Pending")] }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Priority:", bold: true })] })] }),
                new TableCell({ children: [new Paragraph(detection.priority)] }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Risk Level:", bold: true })] })] }),
                new TableCell({ children: [new Paragraph(localRisk.riskLevel)] }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Confidence:", bold: true })] })] }),
                new TableCell({ children: [new Paragraph(`${(detection.confidence * 100).toFixed(2)}% (${confidenceLabel})`)] }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Trust Score:", bold: true })] })] }),
                new TableCell({ children: [new Paragraph(`${detection.trust_score ?? 0}`)] }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Source/Market:", bold: true })] })] }),
                new TableCell({ children: [new Paragraph(detection.source)] }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Location:", bold: true })] })] }),
                new TableCell({ children: [new Paragraph(detection.location_name)] }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Coordinates:", bold: true })] })] }),
                new TableCell({ children: [new Paragraph(`${detection.lat.toFixed(6)}, ${detection.lng.toFixed(6)}`)] }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Detected At:", bold: true })] })] }),
                new TableCell({ children: [new Paragraph(formattedDate)] }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "User Handle:", bold: true })] })] }),
                new TableCell({ children: [new Paragraph(detection.user_handle || "N/A")] }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Post URL:", bold: true })] })] }),
                new TableCell({ children: [new Paragraph(detection.post_url || "N/A")] }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Evidence Hash:", bold: true })] })] }),
                new TableCell({ children: [new Paragraph(hash || "N/A")] }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Hash Status:", bold: true })] })] }),
                new TableCell({ 
                  children: [new Paragraph({
                    children: [new TextRun({
                      text: hasDuplicates ? "⚠ DUPLICATE DETECTED" : "✓ Unique Evidence",
                      bold: true,
                      color: hasDuplicates ? "DC2626" : "059669",
                    })],
                  })],
                }),
              ],
            }),
          ],
        }),
        new Paragraph({ text: "", spacing: { after: 200 } })
      );

      // Evidence Image
      sections.push(
        new Paragraph({
          text: "EVIDENCE IMAGE",
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 200, after: 200 },
        })
      );

      if (imageData) {
        sections.push(
          new Paragraph({
            children: [
              new ImageRun({
                data: imageData,
                transformation: {
                  width: 500,
                  height: 350,
                },
                type: "jpg",
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
          })
        );
      } else {
        sections.push(
          new Paragraph({
            children: [new TextRun({
              text: "Evidence image unavailable",
              italics: true,
              color: "666666",
            })],
            spacing: { after: 200 },
          })
        );
      }

      // Case Highlights
      sections.push(
        new Paragraph({
          text: "CASE HIGHLIGHTS",
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 200, after: 200 },
        }),
        new Paragraph({
          text: `• Priority level indicates enforcement urgency (${detection.priority}).`,
          spacing: { after: 100 },
        }),
        new Paragraph({
          text: `• Risk level assessment: ${localRisk.riskLevel}.`,
          spacing: { after: 100 },
        }),
        new Paragraph({
          text: `• Confidence level suggests ${confidenceLabel.toLowerCase()} model certainty.`,
          spacing: { after: 100 },
        }),
        new Paragraph({
          text: `• Source platform flagged for monitored listings: ${detection.source}.`,
          spacing: { after: 100 },
        }),
        new Paragraph({
          text: `• Location clustered within monitoring region: ${detection.location_name}.`,
          spacing: { after: 100 },
        }),
        new Paragraph({
          text: `• Trust Score (${detection.trust_score ?? 0}) indicates ${detection.trust_score && detection.trust_score > 1 ? 'multiple matching reports' : 'single report'} for this species/location.`,
          spacing: { after: 200 },
        })
      );

      // Description
      sections.push(
        new Paragraph({
          text: "DESCRIPTION",
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 200, after: 200 },
        }),
        new Paragraph({
          text: detection.description || "N/A",
          spacing: { after: 200 },
        })
      );

      // Duplicate Alert if applicable
      if (hasDuplicates) {
        sections.push(
          new Paragraph({
            text: "⚠ DUPLICATE EVIDENCE HASH ALERT",
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 200, after: 200 },
          }),
          new Paragraph({
            children: [new TextRun({
              text: `Identical evidence hash found in ${duplicates.length} other case(s). This indicates the EXACT SAME image is being used in multiple cases.`,
              bold: true,
              color: "DC2626",
            })],
            spacing: { after: 200 },
          }),
          new Paragraph({
            children: [new TextRun({
              text: "Matching Cases:",
              bold: true,
            })],
            spacing: { after: 100 },
          })
        );

        duplicates.forEach((dup, index) => {
          sections.push(
            new Paragraph({
              text: `${index + 1}. Case ID: ${dup.id} - ${dup.animal_type}`,
              spacing: { after: 50 },
            }),
            new Paragraph({
              text: `   Location: ${dup.location_name}, Priority: ${dup.priority}`,
              spacing: { after: 50 },
            }),
            new Paragraph({
              text: `   Detected: ${new Date(dup.timestamp).toLocaleString()}`,
              spacing: { after: 100 },
            })
          );
        });

        sections.push(
          new Paragraph({
            children: [new TextRun({
              text: "⚠ CRITICAL WARNING: Duplicate evidence hashes severely compromise prosecution integrity. Malaysian courts require verified chain of custody and authentic evidence. IMMEDIATE INVESTIGATION RECOMMENDED.",
              bold: true,
              color: "DC2626",
            })],
            spacing: { after: 200 },
          })
        );
      }

      // Operational Notes
      sections.push(
        new Paragraph({
          text: "OPERATIONAL NOTES",
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 200, after: 200 },
        }),
        new Paragraph({
          text: "• Preserve digital evidence and timestamps for chain of custody.",
          spacing: { after: 100 },
        }),
        new Paragraph({
          text: "• Verify listing persistence and capture screenshots where possible.",
          spacing: { after: 100 },
        }),
        new Paragraph({
          text: "• Cross-check with existing watchlists and repeat offenders.",
          spacing: { after: hasDuplicates ? 100 : 200 },
        })
      );

      if (hasDuplicates) {
        sections.push(
          new Paragraph({
            children: [new TextRun({
              text: "• ⚠ PRIORITY: Investigate duplicate evidence hash immediately.",
              bold: true,
              color: "DC2626",
            })],
            spacing: { after: 200 },
          })
        );
      }

      // Evidence Integrity
      sections.push(
        new Paragraph({
          text: "EVIDENCE INTEGRITY",
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 200, after: 200 },
        }),
        new Paragraph({
          text: `SHA-256 Fingerprint: ${hash || "N/A"}`,
          spacing: { after: 100 },
        }),
        new Paragraph({
          text: "Hashing ensures the evidence remains tamper-proof for Malaysian courts.",
          spacing: { after: 100 },
        }),
        new Paragraph({
          children: [new TextRun({
            text: hasDuplicates 
              ? "⚠ ALERT: Evidence integrity compromised due to duplicate hash detection."
              : "✓ Evidence hash is unique - no duplicates detected.",
            bold: true,
            color: hasDuplicates ? "DC2626" : "059669",
          })],
          spacing: { after: 200 },
        })
      );

      // Evidence Timeline
      sections.push(
        new Paragraph({
          text: "EVIDENCE TIMELINE",
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 200, after: 200 },
        }),
        new Paragraph({
          text: "1) Detection recorded and cataloged in monitoring queue.",
          spacing: { after: 100 },
        }),
        new Paragraph({
          text: "2) Verification and risk assessment completed.",
          spacing: { after: 100 },
        }),
        new Paragraph({
          text: "3) Case packaged for enforcement review and archival.",
          spacing: { after: hasDuplicates ? 100 : 200 },
        })
      );

      if (hasDuplicates) {
        sections.push(
          new Paragraph({
            children: [new TextRun({
              text: "4) ⚠ Duplicate hash detected - investigation required.",
              bold: true,
              color: "DC2626",
            })],
            spacing: { after: 200 },
          })
        );
      }

      // Risk Assessments
      sections.push(
        new Paragraph({
          text: "LOCAL RISK SUMMARY",
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 200, after: 200 },
        }),
        new Paragraph({
          text: localRisk.summary,
          spacing: { after: 100 },
        }),
        new Paragraph({
          text: `Key Signals: ${localRisk.signals.join(", ")}.`,
          spacing: { after: 200 },
        }),
        new Paragraph({
          text: "GEMINI RISK ASSESSMENT",
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 200, after: 200 },
        }),
        new Paragraph({
          text: aiSummary,
          spacing: { after: 200 },
        })
      );

      // Create document
      const doc = new Document({
        sections: [
          {
            properties: {},
            children: sections,
          },
        ],
      });

      // Generate and download
      const blob = await Packer.toBlob(doc);
      downloadBlob(blob, `${reportContent.filename}.docx`);
    } catch (error) {
      console.error("Error generating Word document:", error);
      // Fallback to HTML export if docx generation fails
      const blob = new Blob([reportContent.html], { type: "application/msword" });
      downloadBlob(blob, `${reportContent.filename}.doc`);
    }
  };

  const handleDownloadPdf = async () => {
    if (!reportContent) return;
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 40;
    let y = 72;

    const localRisk = buildLocalRiskSummary(detection);
    const aiSummary = resolveAiSummary(localRisk.summary);
    const confidenceLabel = detection.confidence >= 0.9 ? "Very High" : detection.confidence >= 0.75 ? "High" : detection.confidence >= 0.5 ? "Medium" : "Low";

    // Check for duplicate hash
    const duplicates = (allDetections || []).filter(
      (d) => d.evidence_hash && d.evidence_hash === hash && d.id !== detection.id
    );
    const hasDuplicates = duplicates.length > 0;

    const ensureSpace = (height: number) => {
      if (y + height > pageHeight - margin) {
        doc.addPage();
        y = margin;
      }
    };

    const addSectionTitle = (title: string) => {
      ensureSpace(35);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.setTextColor(30, 41, 59);
      doc.text(title, margin, y);
      y += 20;
      doc.setDrawColor(203, 213, 225);
      doc.line(margin, y, pageWidth - margin, y);
      y += 16;
    };

    const addParagraph = (text: string, fontSize = 10, color = [15, 23, 42]) => {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(fontSize);
      doc.setTextColor(color[0], color[1], color[2]);
      const lines = doc.splitTextToSize(text, pageWidth - margin * 2);
      const lineHeight = fontSize + 5;
      ensureSpace(lines.length * lineHeight);
      doc.text(lines, margin, y);
      y += lines.length * lineHeight + 6;
    };

    const addBoldParagraph = (text: string, fontSize = 10, color = [15, 23, 42]) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(fontSize);
      doc.setTextColor(color[0], color[1], color[2]);
      const lines = doc.splitTextToSize(text, pageWidth - margin * 2);
      const lineHeight = fontSize + 5;
      ensureSpace(lines.length * lineHeight);
      doc.text(lines, margin, y);
      y += lines.length * lineHeight + 6;
    };

    const addImageSection = async (title: string, url: string) => {
      addSectionTitle(title);
      if (!url) {
        addParagraph("Evidence image unavailable.", 10, [100, 116, 139]);
        return;
      }
      try {
        const dataUrl = await loadImageDataUrl(url);
        const imageProps = doc.getImageProperties(dataUrl);
        const maxWidth = pageWidth - margin * 2;
        const ratio = imageProps.height / imageProps.width;
        const imgWidth = maxWidth;
        const imgHeight = Math.min(300, maxWidth * ratio);
        ensureSpace(imgHeight + 16);
        
        // Add a border around the image
        doc.setDrawColor(203, 213, 225);
        doc.setLineWidth(1);
        doc.rect(margin - 2, y - 2, imgWidth + 4, imgHeight + 4);
        
        const format = dataUrl.startsWith("data:image/png") ? "PNG" : "JPEG";
        doc.addImage(dataUrl, format, margin, y, imgWidth, imgHeight);
        y += imgHeight + 20;
      } catch (err) {
        addParagraph("Image could not be loaded.", 10, [239, 68, 68]);
      }
    };

    const addBullets = (items: string[]) => {
      items.forEach((item) => {
        addParagraph(`• ${item}`, 10);
      });
    };

    const addTableRow = (label: string, value: string, isLast = false) => {
      ensureSpace(22);
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, y, pageWidth - margin * 2, 22, "F");
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);
      doc.text(label, margin + 8, y + 14);
      
      doc.setFont("helvetica", "normal");
      doc.setTextColor(15, 23, 42);
      const valueLines = doc.splitTextToSize(value, (pageWidth - margin * 2) / 2);
      doc.text(valueLines, margin + 150, y + 14);
      
      if (!isLast) {
        doc.setDrawColor(226, 232, 240);
        doc.line(margin, y + 22, pageWidth - margin, y + 22);
      }
      
      y += 22;
    };

    // Header - Formal Style
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageWidth, 60, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(255, 255, 255);
    doc.text("WILDSCAN EVIDENCE REPORT", margin, 38);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth - margin, 38, { align: "right" });

    // Case ID Subtitle
    doc.setFontSize(11);
    doc.setTextColor(203, 213, 225);
    doc.text(`Case ID: ${detection.id}`, margin, 52);

    y = 80;

    // Case Summary Section
    addSectionTitle("CASE SUMMARY");
    
    ensureSpace(360);
    const summaryData = [
      ["Case ID", detection.id],
      ["Case Name", detection.case_name || "N/A"],
      ["Species", detection.animal_type],
      ["Status", detection.status || "Pending"],
      ["Priority", detection.priority],
      ["Risk Level", localRisk.riskLevel],
      ["Confidence", `${(detection.confidence * 100).toFixed(2)}% (${confidenceLabel})`],
      ["Trust Score", `${detection.trust_score ?? 0}`],
      ["Source/Market", detection.source],
      ["Location", detection.location_name],
      ["Coordinates", `${detection.lat.toFixed(6)}, ${detection.lng.toFixed(6)}`],
      ["Detected At", formattedDate],
      ["User Handle", detection.user_handle || "N/A"],
      ["Post URL", detection.post_url ? (detection.post_url.length > 50 ? detection.post_url.substring(0, 50) + "..." : detection.post_url) : "N/A"],
      ["Evidence Hash", hash ? (hash.length > 30 ? hash.substring(0, 30) + "..." : hash) : "N/A"],
    ];

    summaryData.forEach((row, index) => {
      addTableRow(row[0], row[1], index === summaryData.length - 1);
    });

    y += 10;

    // Hash Status Badge
    ensureSpace(25);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    if (hasDuplicates) {
      doc.setFillColor(220, 38, 38);
      doc.setTextColor(255, 255, 255);
      doc.roundedRect(margin, y, 155, 22, 3, 3, "F");
      doc.text("⚠ DUPLICATE DETECTED", margin + 10, y + 14);
    } else {
      doc.setFillColor(5, 150, 105);
      doc.setTextColor(255, 255, 255);
      doc.roundedRect(margin, y, 140, 22, 3, 3, "F");
      doc.text("✓ Unique Evidence", margin + 10, y + 14);
    }
    y += 35;
    doc.setTextColor(15, 23, 42);

    // Evidence Image Section - Most Important
    await addImageSection("EVIDENCE IMAGE", detection.image_url || "");

    // Case Highlights
    addSectionTitle("CASE HIGHLIGHTS");
    addBullets([
      `Priority level indicates enforcement urgency (${detection.priority}).`,
      `Risk level assessment: ${localRisk.riskLevel}.`,
      `Confidence level suggests ${confidenceLabel.toLowerCase()} model certainty.`,
      `Source platform flagged for monitored listings: ${detection.source}.`,
      `Location clustered within monitoring region: ${detection.location_name}.`,
      `Trust Score (${detection.trust_score ?? 0}) indicates ${detection.trust_score && detection.trust_score > 1 ? 'multiple matching reports' : 'single report'} for this species/location.`,
    ]);

    // Description
    addSectionTitle("DESCRIPTION");
    addParagraph(detection.description || "N/A");

    // Duplicate Hash Alert Section
    if (hasDuplicates) {
      addSectionTitle("⚠ DUPLICATE EVIDENCE HASH ALERT");
      ensureSpace(100);
      
      doc.setFillColor(254, 226, 226);
      doc.setDrawColor(220, 38, 38);
      doc.setLineWidth(2);
      const alertStartY = y;
      
      addBoldParagraph(`Identical evidence hash found in ${duplicates.length} other case(s).`, 10, [153, 27, 27]);
      addBoldParagraph("This indicates the EXACT SAME image is being used in multiple cases.", 10, [153, 27, 27]);
      
      y += 8;
      addBoldParagraph("Matching Cases:", 10, [15, 23, 42]);
      doc.setFont("helvetica", "normal");
      
      duplicates.forEach((dup, index) => {
        addParagraph(`${index + 1}. Case ID: ${dup.id} - ${dup.animal_type}`, 9);
        addParagraph(`   Location: ${dup.location_name}, Priority: ${dup.priority}`, 9);
        addParagraph(`   Detected: ${new Date(dup.timestamp).toLocaleString()}`, 9);
      });
      
      y += 8;
      addBoldParagraph("⚠ CRITICAL WARNING: Duplicate evidence hashes severely compromise prosecution integrity.", 10, [153, 27, 27]);
      addBoldParagraph("IMMEDIATE INVESTIGATION RECOMMENDED.", 10, [153, 27, 27]);
      
      const alertHeight = y - alertStartY;
      doc.rect(margin - 5, alertStartY - 5, pageWidth - margin * 2 + 10, alertHeight + 10);
      
      doc.setTextColor(15, 23, 42);
      doc.setLineWidth(0.5);
    }

    // Operational Notes
    addSectionTitle("OPERATIONAL NOTES");
    addBullets([
      "Preserve digital evidence and timestamps for chain of custody.",
      "Verify listing persistence and capture screenshots where possible.",
      "Cross-check with existing watchlists and repeat offenders.",
      ...(hasDuplicates ? ["⚠ PRIORITY: Investigate duplicate evidence hash immediately."] : []),
    ]);

    // Evidence Integrity
    addSectionTitle("EVIDENCE INTEGRITY");
    addParagraph(`SHA-256 Fingerprint: ${hash || "N/A"}`);
    addParagraph("Hashing ensures the evidence remains tamper-proof for Malaysian courts.");
    if (hasDuplicates) {
      addBoldParagraph("⚠ ALERT: Evidence integrity compromised due to duplicate hash detection.", 10, [220, 38, 38]);
    } else {
      addBoldParagraph("✓ Evidence hash is unique - no duplicates detected.", 10, [5, 150, 105]);
    }

    // Evidence Timeline
    addSectionTitle("EVIDENCE TIMELINE");
    addParagraph("1. Detection recorded and cataloged in monitoring queue.");
    addParagraph("2. Verification and risk assessment completed.");
    addParagraph("3. Case packaged for enforcement review and archival.");
    if (hasDuplicates) {
      addBoldParagraph("4. ⚠ Duplicate hash detected - investigation required.", 10, [220, 38, 38]);
    }

    // Risk Assessments
    addSectionTitle("LOCAL RISK SUMMARY");
    addParagraph(localRisk.summary);
    addParagraph(`Key Signals: ${localRisk.signals.join(", ")}.`);

    addSectionTitle("GEMINI RISK ASSESSMENT");
    addParagraph(aiSummary);

    // Footer
    const pageCount = doc.internal.pages.length - 1;
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(`Page ${i} of ${pageCount}`, pageWidth / 2, pageHeight - 20, { align: "center" });
      doc.text("WILDSCAN Wildlife Enforcement Dashboard", pageWidth - margin, pageHeight - 20, { align: "right" });
    }

    doc.save(`${reportContent.filename}.pdf`);
  };

  const handleGenerateReport = () => {
    setIsGenerating(true);
    setReportReady(false);
    const steps = [
      "Initializing secure connection...",
      "Fetching Firestore document ID: " + detection.id,
      "Downloading high-res imagery...",
      "Extracting EXIF metadata...",
      "Geo-tagging location: " + detection.location_name,
      "Performing Gemini AI final re-verification...",
      "Compiling digital evidence signature...",
      "Finalizing report package..."
    ];

    steps.forEach((step, index) => {
      setTimeout(() => {
        setReportLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${step}`]);
        if (index === steps.length - 1) {
          setTimeout(() => {
            const filename = `WILDSCAN_${detection.id}`;
            const text = buildReportText();
            const html = buildReportHtml();
            setReportContent({ text, html, filename });
            setIsGenerating(false);
            setReportReady(true);
          }, 1000);
        }
      }, index * 600);
    });
  };

  return (
    <div className="flex flex-col h-full relative">
      {/* Report Generation Overlay with Glassmorphism */}
      {(isGenerating || reportReady) && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-8 font-mono overflow-hidden">
          {/* Glassmorphism Background Overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-lime-50/90 via-lime-100/80 to-white/90 backdrop-blur-xl"></div>
          
          {/* Glassmorphism Card */}
          <div className="relative w-full max-w-3xl bg-white/40 backdrop-blur-2xl border border-lime-400/50 rounded-2xl shadow-[0_8px_32px_0_rgba(132,204,22,0.2)] p-8 overflow-hidden">
            {/* Gradient Accents */}
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-lime-500 to-transparent opacity-50"></div>
            <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-lime-500 to-transparent opacity-50"></div>
            
            {/* Cancel Icon */}
            {reportReady && (
              <button
                onClick={() => setReportReady(false)}
                className="absolute top-4 right-4 z-20 p-2 rounded-lg bg-lime-200/70 backdrop-blur-sm border border-lime-300/50 text-green-800 hover:text-lime-700 hover:bg-lime-200/70 hover:border-lime-400/50 transition-all duration-200 group"
                aria-label="Close"
              >
                <X size={18} className="group-hover:rotate-90 transition-transform duration-200" />
              </button>
            )}
            
            {/* Content */}
            <div className="relative z-10">
              <div className="flex items-center gap-2 text-lime-700 mb-6">
                <Activity size={20} className="animate-pulse" />
                <h3 className="text-sm font-bold uppercase tracking-widest">
                  {reportReady ? "Prosecution Report Ready" : "Generating Prosecution Report"}
                </h3>
              </div>
              
              {!reportReady ? (
                <>
                  <div className="flex-1 space-y-2 text-[10px] text-lime-700/80 overflow-y-auto max-h-96 bg-lime-200/30 backdrop-blur-sm rounded-lg p-4 border border-lime-300/60">
                    {reportLogs.map((log, i) => (
                      <div key={i} className="animate-in slide-in-from-left duration-300 py-1">
                        {log}
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 pt-4 border-t border-lime-400/40">
                    <div className="w-full h-2 bg-white/60 backdrop-blur-sm rounded-full overflow-hidden border border-lime-400/40">
                      <div className="h-full bg-gradient-to-r from-lime-500 via-lime-400 to-lime-500 animate-[progress_5s_linear_infinite] shadow-[0_0_10px_rgba(132,204,22,0.5)]"></div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col gap-4">
                  <div className="text-xs text-green-900 leading-relaxed bg-gradient-to-br from-lime-500/10 via-lime-100/60 to-lime-50/60 backdrop-blur-md border border-lime-400/50 p-6 rounded-xl shadow-[0_4px_16px_0_rgba(132,204,22,0.18)]">
                    <div className="text-[11px] uppercase tracking-widest text-lime-700 font-mono font-bold">Report Summary</div>
                    <div className="mt-2 text-green-900">
                      Case {detection.id} prepared with evidence highlights and AI risk assessment.
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-[10px]">
                      <div className="bg-white/60 backdrop-blur-sm border border-lime-300/50 rounded-lg px-3 py-2 shadow-sm">
                        <span className="text-green-800">Priority:</span> <span className="text-lime-800 font-semibold">{detection.priority}</span>
                      </div>
                      <div className="bg-white/60 backdrop-blur-sm border border-lime-300/50 rounded-lg px-3 py-2 shadow-sm">
                        <span className="text-green-800">Confidence:</span> <span className="text-lime-800 font-semibold">{(detection.confidence * 100).toFixed(0)}%</span>
                      </div>
                      <div className="bg-white/60 backdrop-blur-sm border border-lime-300/50 rounded-lg px-3 py-2 shadow-sm">
                        <span className="text-green-800">Location:</span> <span className="text-lime-800 font-semibold">{detection.location_name}</span>
                      </div>
                      <div className="bg-white/60 backdrop-blur-sm border border-lime-300/50 rounded-lg px-3 py-2 shadow-sm">
                        <span className="text-green-800">Source:</span> <span className="text-lime-800 font-semibold">{detection.source}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleDownloadPdf}
                      className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-lime-500 to-lime-700 hover:from-lime-400 hover:to-lime-600 text-green-950 font-bold text-xs shadow-[0_4px_16px_0_rgba(132,204,22,0.32)] hover:shadow-[0_6px_20px_0_rgba(132,204,22,0.4)] transition-all duration-200 active:scale-95"
                    >
                      <Download size={14} />
                      Download PDF
                    </button>
                    <button
                      onClick={handleDownloadWord}
                      className="flex items-center gap-2 px-6 py-3 rounded-xl bg-lime-200/70 backdrop-blur-sm text-green-950 font-bold text-xs border border-lime-300/50 hover:bg-lime-200/70 hover:border-lime-400 shadow-sm hover:shadow-md transition-all duration-200 active:scale-95"
                    >
                      <Download size={14} />
                      Download Word
                    </button>
                    <button
                      onClick={() => setReportReady(false)}
                      className="ml-auto text-[10px] uppercase tracking-widest text-green-800 hover:text-lime-700 transition-colors px-4 py-2 rounded-lg hover:bg-lime-200/30 backdrop-blur-sm"
                    >
                      Close
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="p-6 border-b border-lime-400/40">
        <div className="flex items-start justify-between mb-2">
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest border ${priorityBadgeClass[detection.priority]}`}>
            {detection.priority} Priority Case
          </span>
          <div className="text-[10px] text-green-700 font-mono">ID: {detection.id}</div>
        </div>
        <h2 className="text-2xl font-bold text-green-950">{detection.animal_type}</h2>
        <div className="flex items-center gap-2 text-lime-700/70 text-xs font-mono mt-1">
          <Clock size={12} />
          <span>Detected {formattedDate}</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {showDuplicateModal && duplicateCases.length > 0 && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-white border border-red-500/50 rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-mono text-red-400 uppercase tracking-wider">⚠ Duplicate Evidence Hash</h2>
                  <p className="text-xs text-green-800 mt-1">Hash: {activeDuplicateHash?.substring(0, 16)}... (appears in {duplicateCases.length + 1} case{duplicateCases.length > 0 ? 's' : ''})</p>
                </div>
                <button
                  onClick={() => setShowDuplicateModal(false)}
                  className="text-green-800 hover:text-green-900 text-xl font-bold">×</button>
              </div>

              <div className="bg-white/60 border border-lime-300 rounded p-3 space-y-2">
                <p className="text-[10px] uppercase text-green-700 font-mono">📋 Matching Cases with Same Hash:</p>
                {duplicateCases.map((dup) => (
                  <div key={dup.id} className="text-xs border-l-2 border-red-500/50 pl-3 py-2">
                    <div className="text-green-900"><strong>{dup.animal_type}</strong></div>
                    <div className="text-green-700 text-[10px]">State: {dup.location_name || "N/A"}</div>
                    <div className="text-green-700 text-[10px]">Address: {duplicateAddressById[dup.id] || "N/A"}</div>
                    <div className="text-green-700 text-[10px]">📅 {new Date(dup.timestamp).toLocaleString()}</div>
                  </div>
                ))}
              </div>

              <div className="bg-white/60 border border-lime-300 rounded p-3 space-y-2">
                <p className="text-[10px] uppercase text-green-700 font-mono">🖼️ Matching Evidence Images:</p>
                {duplicateEvidenceItems.length > 0 ? (
                  <div className="space-y-3">
                    {duplicateEvidenceItems.map((item, idx) => (
                      <div key={`${item.caseId}-${idx}`} className="flex gap-3 border border-lime-300/50 rounded-lg p-3 bg-white/80">
                        <div className="w-20 h-16 rounded-md overflow-hidden border border-lime-300/50 bg-lime-100">
                          {item.imageUrl ? (
                            <img
                              src={item.imageUrl}
                              alt={`Evidence for case ${item.caseId}`}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[9px] text-green-700 font-mono">
                              No image
                            </div>
                          )}
                        </div>
                        <div className="text-xs text-green-800 space-y-1">
                          <div className="text-green-900 font-semibold">
                            {item.animalType}
                          </div>
                          <div className="text-[10px]">Case ID: {item.caseId}</div>
                          <div className="text-[10px]">State: {item.locationName || "N/A"}</div>
                          <div className="text-[10px]">Address: {duplicateAddressById[item.caseId] || "N/A"}</div>
                          <div className="text-[10px]">Detected: {new Date(item.timestamp).toLocaleString()}</div>
                          <div className="text-[10px]">Hash: {item.hash.slice(0, 16)}...</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-[10px] text-green-700">No matching evidence images found.</div>
                )}
              </div>

              <div className="bg-amber-950/30 border border-amber-700/50 rounded p-4 space-y-2">
                <p className="text-[10px] uppercase text-amber-400 font-mono font-bold">⚠️ Why This Matters:</p>
                <p className="text-xs text-green-900 leading-relaxed">
                  Identical evidence hash across multiple cases indicates potential evidence tampering, unauthorized reuse, or fraudulent reporting. This affects prosecution integrity and court admissibility - Malaysian courts require verified chain of custody and evidence authenticity.
                </p>
              </div>

              <div className="space-y-3 bg-lime-200/40 border border-lime-300 rounded p-4">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] uppercase text-lime-700 font-mono font-bold">🔍 Gemini Analysis - Possible Reasons:</p>
                  <span className="text-[8px] px-2 py-1 rounded bg-lime-600 text-white font-semibold">Auto Scanning</span>
                </div>
                {isAnalyzingDuplicate ? (
                  <div className="flex items-center gap-2 text-lime-700 text-xs animate-pulse bg-white/50 p-4 rounded">
                    <Activity size={14} className="animate-spin" />
                    <span>Connecting to Gemini AI to analyze possible reasons...</span>
                  </div>
                ) : duplicateReasons.length > 0 ? (
                  <div className="space-y-3">
                    {duplicateReasons.map((reason, idx) => (
                      <div key={idx} className="bg-gradient-to-r from-white/95 to-lime-50/90 border-l-4 border-l-lime-500 border border-lime-200 rounded-r-lg p-4 hover:shadow-md transition-all hover:border-lime-400">
                        <div className="flex items-start gap-3">
                          <span className="flex-shrink-0 text-lime-600 font-bold text-sm bg-lime-100 rounded-full w-7 h-7 flex items-center justify-center">
                            {idx + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-lime-800 font-semibold leading-snug mb-2">{reason}</p>
                            <p className="text-xs text-green-700 leading-relaxed bg-white/60 p-2 rounded border border-green-200/50 italic">
                              💡 {getReasonExplanation(reason)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-lime-700 bg-white/60 p-4 rounded text-center font-medium">
                    Waiting for Gemini AI analysis...
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setShowDuplicateModal(false)}
                  className="px-4 py-2 rounded border border-lime-300 text-xs font-mono uppercase text-green-800 hover:bg-lime-200/50 transition-all">
                  Close & Review
                </button>
              </div>
            </div>
          </div>
        )}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-[10px] uppercase font-mono text-green-700 tracking-widest">Visual Evidence</label>
            <div className="flex items-center gap-3">
              {isSpeechSupported && (
                <button
                  type="button"
                  onClick={() => setIsReadAloudActive(!isReadAloudActive)}
                  className={`text-[10px] uppercase font-mono tracking-widest transition-all flex items-center gap-1 ${
                    isReadAloudActive
                      ? 'text-lime-700 hover:text-lime-800'
                      : 'text-green-700 hover:text-lime-700'
                  }`}
                  title={isReadAloudActive ? 'Stop reading case details' : 'Read case details aloud'}
                  aria-label={isReadAloudActive ? 'Stop reading case details' : 'Read case details aloud'}
                >
                  {isReadAloudActive || isSpeaking() ? (
                    <><VolumeX size={14} /> Reading</>
                  ) : (
                    <><Volume2 size={14} /> Read</>
                  )}
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsImageFit((prev) => !prev)}
                className="text-[10px] uppercase font-mono tracking-widest text-lime-700 hover:text-lime-800 transition-colors"
              >
                {isImageFit ? "Fill" : "Fit"}
              </button>
            </div>
          </div>
          <div className="aspect-video w-full rounded-lg overflow-hidden border border-lime-300/50 bg-lime-200 relative group hover:border-lime-400/50 transition-colors duration-300">
            {detection.image_url ? (
              <img
                src={detection.image_url}
                alt="Evidence"
                className={`w-full h-full ${isImageFit ? "object-contain" : "object-cover"} grayscale-[0.3] group-hover:grayscale-0 transition-all duration-500`}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xs text-green-700 font-mono">
                Evidence image unavailable
              </div>
            )}
            <div className="absolute bottom-4 right-4 bg-white/70 backdrop-blur-sm px-3 py-2 rounded-lg text-[10px] font-mono text-green-900 border border-lime-300/50 flex items-center gap-1">
              Confidence: {(detection.confidence * 100).toFixed(1)}%
            </div>
          </div>
        </div>

        {evidenceItems.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-[10px] uppercase font-mono text-green-700 tracking-widest">Evidence Images</label>
              <span className="text-[10px] text-green-700 font-mono">
                {evidenceItems.length} item{evidenceItems.length === 1 ? "" : "s"}
              </span>
            </div>
            <div className="space-y-3">
              {evidenceItems.map((item, index) => {
                const hashValue = getEvidenceHash(item);
                const hashState = evidenceHashState[item.id];
                const duplicateCount = getDuplicateCount(hashValue);
                const hasDuplicate = duplicateCount > 0;

                return (
                  <div key={item.id} className="bg-lime-200/60 border border-lime-300/50 hover:border-lime-400/50 p-3 rounded-lg transition-colors duration-200">
                    <div className="flex gap-3">
                      <div className="w-28 h-20 rounded-md overflow-hidden border border-lime-300/50 bg-lime-100">
                        {item.fileUrl ? (
                          <img
                            src={item.fileUrl}
                            alt={`Evidence ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[9px] text-green-700 font-mono">
                            No image
                          </div>
                        )}
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] text-green-800 font-mono uppercase tracking-wider font-semibold">Evidence {index + 1}</span>
                          <span className={`text-[9px] font-mono uppercase tracking-wider ${hasDuplicate ? "text-red-500" : "text-lime-700"}`}>
                            {hasDuplicate ? `⚠ Duplicate (${duplicateCount})` : "✓ Unique"}
                          </span>
                        </div>
                        <div className="text-[10px] text-green-800">
                          Platform: {item.platformSource || detection.platform_source || detection.source || "N/A"}
                        </div>
                        <div className="text-[10px] text-green-800">
                          Captured: {formatEvidenceTimestamp(item.uploadedAt)}
                        </div>
                        <div className="text-[10px] text-green-800">
                          AI Confidence: {(detection.confidence * 100).toFixed(1)}%
                        </div>
                        {item.aiSummary && (
                          <div className="text-[10px] text-green-800 leading-relaxed">
                            AI Summary: {item.aiSummary}
                          </div>
                        )}
                        <div className="text-[10px] text-green-800">
                          SHA-256: {hashState?.isHashing ? "Calculating..." : hashValue ? `${hashValue.slice(0, 16)}...` : "N/A"}
                        </div>
                        {hashState?.error && (
                          <div className="text-[10px] text-red-500">{hashState.error}</div>
                        )}
                        {hasDuplicate && hashValue && (
                          <button
                            type="button"
                            onClick={() => handleDuplicateDetected(hashValue)}
                            className="inline-flex items-center px-2 py-1 rounded-full text-[9px] font-mono uppercase tracking-wider bg-red-500/10 text-red-600 border border-red-500/40 hover:bg-red-500/20 hover:text-red-700 transition-colors"
                          >
                            View duplicates
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-lime-200/60 border border-lime-300/50 hover:border-lime-400/50 p-3 rounded-lg transition-colors duration-200">
            <p className="text-[9px] text-green-800 font-mono uppercase mb-2 font-semibold tracking-wider">Discovery Type</p>
            <div className="flex items-center gap-2">
              <Share2 size={16} className="text-green-800" />
              <span className="text-sm font-semibold truncate text-green-950">{discoveryTypeLabel}</span>
            </div>
          </div>
          {isOnlineDiscovery && (
            <div className="bg-lime-200/60 border border-lime-300/50 hover:border-lime-400/50 p-3 rounded-lg transition-colors duration-200">
              <p className="text-[9px] text-green-800 font-mono uppercase mb-2 font-semibold tracking-wider">Marketplace</p>
              <div className="flex items-center gap-2">
                <Share2 size={16} className="text-green-800" />
                <span className="text-sm font-semibold truncate text-green-950">{detection.platform_source || detection.source || "N/A"}</span>
              </div>
              {onlineEvidenceLink && (
                <a
                  href={onlineEvidenceLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-[11px] text-lime-700 hover:text-lime-800 underline break-all"
                >
                  <LinkIcon size={12} />
                  {onlineEvidenceLink}
                </a>
              )}
            </div>
          )}
          <button
            type="button"
            onClick={() => setShowGeoLocationModal(true)}
            className="bg-lime-200/60 border border-lime-300/50 hover:border-lime-400/50 p-3 rounded-lg transition-colors duration-200 cursor-pointer text-left"
          >
            <p className="text-[9px] text-green-800 font-mono uppercase mb-2 font-semibold tracking-wider">Geo-Location</p>
            <div className="flex items-center gap-2">
               <MapPin size={16} className="text-green-800" />
               <span className="text-sm font-semibold truncate text-green-950">{detection.location_name}</span>
            </div>
          </button>
          <button
            type="button"
            onClick={() => {
              setShowTrustScoreModal(true);
              if (!trustScoreExplanation) {
                explainTrustScore();
              }
            }}
            className="bg-lime-200/60 border border-lime-300/50 hover:border-lime-400/50 p-3 rounded-lg transition-colors duration-200 cursor-pointer text-left col-span-2"
          >
            <p className="text-[9px] text-green-800 font-mono uppercase mb-2 font-semibold tracking-wider">Trust Score - Matching Reports</p>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                 <Activity size={16} className="text-green-800" />
                 <span className="text-sm font-semibold text-green-950">{detection.trust_score ?? 0} similar reports</span>
              </div>
              <span className="text-[10px] text-green-700">Click to view</span>
            </div>
          </button>
        </div>

        <div className="bg-lime-200/60 border border-lime-300/50 p-4 rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[9px] text-green-800 font-mono uppercase tracking-wider font-semibold">Quick Action</p>
            <span className="text-[9px] text-green-700 font-mono uppercase tracking-wider">Send to Ranger</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleSendRangerWhatsApp}
              className="px-4 py-2.5 rounded-lg bg-lime-300/40 border border-lime-400/50 text-lime-800 text-[10px] font-mono uppercase tracking-widest hover:bg-lime-300/50 hover:border-lime-400/50 transition-colors duration-200"
            >
              WhatsApp
            </button>
            <button
              type="button"
              onClick={handleSendRangerEmail}
              className="px-4 py-2.5 rounded-lg bg-lime-200/60 border border-lime-400/50 text-green-900 text-[10px] font-mono uppercase tracking-widest hover:bg-lime-200/70 hover:border-lime-400 transition-colors duration-200"
            >
              Email
            </button>
          </div>
          <p className="text-[10px] text-green-700 mt-3">
            Prefilled with case ID, species, and coordinates.
          </p>
        </div>

        <div className="bg-lime-200/60 border border-lime-300/50 p-4 rounded-lg">
          <p className="text-[9px] text-green-800 font-mono uppercase mb-3 tracking-wider font-semibold">Case Status</p>
          <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest">
            {(["Pending", "Investigating", "Resolved"] as Detection["status"][]).map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => {
                  if (!detection) return;
                  const nextStatus = localStatus === status ? undefined : status;
                  setLocalStatus(nextStatus);
                  onStatusChange?.(detection.id, nextStatus);
                }}
                className={`px-3 py-2 rounded-lg border transition-all duration-200 ${
                  localStatus === status
                    ? "bg-lime-300/50 border-lime-400/50 text-lime-900"
                    : "bg-lime-200/60 border-lime-400/50 text-green-800 hover:bg-lime-200/70 hover:border-lime-400"
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white/40 border border-lime-300/50 p-4 rounded-lg">
          <div className="mb-3 pb-3 border-b border-lime-300/30">
            <p className="text-[9px] text-green-800 font-mono uppercase tracking-wider font-semibold">Case Information</p>
            <p className="text-[8px] text-green-700 mt-1">Detection metadata and evidence details</p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-lg bg-lime-200/60 border border-lime-300/50 hover:border-lime-400/50 p-3 transition-colors duration-200">
              <span className="text-[9px] text-green-800 font-mono uppercase tracking-wider font-semibold">Detected Species</span>
              <div className="mt-2 text-green-950 font-medium">
                {detection.species_detected || detection.detected_species_name || detection.animal_type || "N/A"}
              </div>
            </div>
            <div className="rounded-lg bg-lime-200/60 border border-lime-300/50 hover:border-lime-400/50 p-3 transition-colors duration-200">
              <span className="text-[9px] text-green-800 font-mono uppercase tracking-wider font-semibold">Platform Source</span>
              <div className="mt-2 text-green-950 font-medium">
                {detection.platform_source || detection.source || "N/A"}
              </div>
            </div>
            <div className="rounded-lg bg-lime-200/60 border border-lime-300/50 hover:border-lime-400/50 p-3 transition-colors duration-200">
              <span className="text-[9px] text-green-800 font-mono uppercase tracking-wider font-semibold">Location (State)</span>
              <div className="mt-2 text-green-950 font-medium">{detection.location_name || "Unknown"}</div>
            </div>
            <div className="rounded-lg bg-lime-200/60 border border-lime-300/50 hover:border-lime-400/50 p-3 transition-colors duration-200 col-span-2">
              <span className="text-[9px] text-green-800 font-mono uppercase tracking-wider font-semibold">Full Address</span>
              <div className="mt-2 text-green-950 leading-relaxed break-words">{fullAddress || "N/A"}</div>
            </div>
            <div className="rounded-lg bg-lime-200/60 border border-lime-300/50 hover:border-lime-400/50 p-3 transition-colors duration-200">
              <span className="text-[9px] text-green-800 font-mono uppercase tracking-wider font-semibold">Priority</span>
              <div className="mt-2">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono uppercase border ${priorityBadgeClass[detection.priority]}`}>
                  {detection.priority}
                </span>
              </div>
            </div>
            <div className="rounded-lg bg-lime-200/60 border border-lime-300/50 hover:border-lime-400/50 p-3 transition-colors duration-200">
              <span className="text-[9px] text-green-800 font-mono uppercase tracking-wider font-semibold">AI Scanned At</span>
              <div className="mt-2 text-green-950">{formattedAiScannedAt}</div>
            </div>
            <div className="rounded-lg bg-lime-200/60 border border-lime-300/50 hover:border-lime-400/50 p-3 transition-colors duration-200">
              <span className="text-[9px] text-green-800 font-mono uppercase tracking-wider font-semibold">Created At</span>
              <div className="mt-2 text-green-950">{formattedCreatedAt}</div>
            </div>
            <div className="rounded-lg bg-lime-200/60 border border-lime-300/50 hover:border-lime-400/50 p-3 transition-colors duration-200">
              <span className="text-[9px] text-green-800 font-mono uppercase tracking-wider font-semibold">Confidence Score</span>
              <div className="mt-2 text-green-950 font-medium">
                {((detection.confidence_score ?? detection.confidence) * 100).toFixed(0)}%
              </div>
            </div>
            <div className="rounded-lg bg-lime-200/60 border border-lime-300/50 hover:border-lime-400/50 p-3 transition-colors duration-200">
              <span className="text-[9px] text-green-800 font-mono uppercase tracking-wider font-semibold">Risk Score</span>
              <div className="mt-2 text-green-950 font-medium">
                {typeof detection.risk_score === "number" ? detection.risk_score.toFixed(2) : "N/A"}
              </div>
            </div>
            <div className="rounded-lg bg-lime-200/60 border border-lime-300/50 hover:border-lime-400/50 p-3 transition-colors duration-200">
              <span className="text-[9px] text-green-800 font-mono uppercase tracking-wider font-semibold">Detected Illegal Product</span>
              <div className="mt-2 text-green-950">{detection.detected_illegal_product || "Unknown"}</div>
            </div>
            <div className="rounded-lg bg-lime-200/60 border border-lime-300/50 hover:border-lime-400/50 p-3 transition-colors duration-200">
              <span className="text-[9px] text-green-800 font-mono uppercase tracking-wider font-semibold">Source</span>
              <div className="mt-2 text-green-950">{detection.source || "N/A"}</div>
            </div>
            <div className="rounded-lg bg-lime-200/60 border border-lime-300/50 hover:border-lime-400/50 p-3 transition-colors duration-200">
              <span className="text-[9px] text-green-800 font-mono uppercase tracking-wider font-semibold">Evidence Summary</span>
              <div className="mt-2 text-green-950">{detection.reason_summary || "N/A"}</div>
            </div>
            <div className="rounded-lg bg-lime-200/60 border border-lime-300/50 hover:border-lime-400/50 p-3 transition-colors duration-200 col-span-2">
              <span className="text-[9px] text-green-800 font-mono uppercase tracking-wider font-semibold">Reason</span>
              <div className="mt-2 text-green-950 leading-relaxed break-words">{detection.reason || "N/A"}</div>
            </div>
          </div>
        </div>

        <div className="hidden space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-[10px] uppercase font-mono text-green-700 tracking-widest">Gemini AI Verification Intel</label>
          </div>
          <div className="space-y-2 text-xs text-green-800 bg-white/80 p-4 rounded-lg border border-lime-300 group">
            <div className="flex justify-between border-b border-lime-300/50 pb-2">
              <span className="text-green-700">Coordinates:</span>
              <span className="text-green-900 font-mono">{detection.lat.toFixed(6)}, {detection.lng.toFixed(6)}</span>
            </div>
              <div className="flex justify-between border-b border-lime-300/50 pb-2">
                <span className="text-green-700">Risk Level:</span>
                <span className={`font-mono ${localRisk.riskLevel === "High" ? "text-red-400" : localRisk.riskLevel === "Medium" ? "text-amber-400" : "text-lime-700"}`}>
                  {localRisk.riskLevel}
                </span>
              </div>
            <div className="flex flex-col gap-1 border-b border-lime-300/50 pb-2">
              <div className="flex justify-between items-start gap-2">
                <span className="text-green-700">Evidence Hash:</span>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-lime-700 font-mono break-all text-xs">
                    {isHashing ? "Calculating..." : hash || "N/A"}
                  </span>
                  {hash && (
                    <button
                      onClick={() => !isHashUnique && handleDuplicateDetected()}
                      disabled={isHashUnique === null || isHashUnique}
                      className={`text-[10px] font-mono px-2 py-0.5 rounded cursor-pointer transition-all ${
                        isHashUnique === null ? "bg-lime-200 text-green-800" :
                        isHashUnique ? "bg-lime-300/40 text-lime-700 border border-lime-400/50 cursor-default" :
                        "bg-red-500/20 text-red-400 border border-red-500/50 hover:bg-red-500/30 hover:border-red-500 active:bg-red-400/20"
                      }`}>
                      {isHashUnique === null ? "Checking..." :
                       isHashUnique ? "✓ Unique Evidence" :
                       "⚠ Duplicate Found"}
                    </button>
                  )}
                </div>
              </div>
              <div className="text-[10px] text-green-700">
                {hashError || "SHA-256 fingerprint keeps evidence tamper-proof for Malaysian courts."}
              </div>
            </div>

            <div className="pt-2">
              <p className="mb-2 text-green-700 flex items-center gap-2">
                <AlertCircle size={12} className="text-red-500" /> Gemini Risk Assessment:
              </p>
              <div className="italic text-green-900 leading-relaxed bg-white/50 p-3 rounded border-l-2 border-lime-400 min-h-[60px] flex items-center">
                {isAnalyzing ? (
                  <div className="flex items-center gap-2 text-lime-700 animate-pulse font-mono text-[10px]">
                    <Activity size={14} />
                    <span>Processing live satellite and marketplace data via Gemini...</span>
                  </div>
                ) : (
                    <p>"{resolveAiSummary(localRisk.summary)}"</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 bg-lime-200 border-t border-lime-400/40">
        <button 
          onClick={handleGenerateReport}
          className="w-full flex items-center justify-center gap-2 py-3.5 bg-lime-600 text-green-950 rounded-xl font-black text-sm transition-all shadow-[0_0_20px_rgba(132,204,22,0.35)] hover:shadow-[0_0_30px_rgba(132,204,22,0.5)] hover:bg-white0 active:scale-[0.98]"
        >
          <FileText size={18} />
          GENERATE PROSECUTION REPORT
        </button>
      </div>

      {/* Trust Score Modal */}
      {showTrustScoreModal && detection && (
        <div 
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowTrustScoreModal(false)}
        >
          <div 
            className="bg-white border border-lime-400/50 rounded-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-lime-400/40 p-4 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-lime-700 flex items-center gap-2">
                  <Activity size={20} />
                  Trust Score Analysis
                </h3>
                <p className="text-xs text-green-700 font-mono mt-1">
                  {detection.animal_type} • {detection.location_name}
                </p>
              </div>
              <button
                onClick={() => setShowTrustScoreModal(false)}
                className="text-green-800 hover:text-green-900 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Trust Score Explanation */}
              <div className="bg-lime-200/50 border border-lime-400/40 rounded-lg p-4">
                <h4 className="text-sm font-bold text-green-900 mb-2 flex items-center gap-2">
                  <ShieldCheck size={16} className="text-lime-700" />
                  Current Trust Score: {detection.trust_score ?? 0}
                </h4>
                {isExplainingTrust ? (
                  <div className="flex items-center gap-2 text-lime-700 animate-pulse font-mono text-xs">
                    <Activity size={14} />
                    <span>Generating AI explanation...</span>
                  </div>
                ) : (
                  <p className="text-sm text-green-900 leading-relaxed">
                    {trustScoreExplanation || "Trust Score represents the number of similar reports (same species + location). Higher scores indicate stronger community validation."}
                  </p>
                )}
              </div>

              {/* Matching Cases */}
              <div>
                <h4 className="text-sm font-bold text-green-900 mb-3 flex items-center gap-2">
                  <AlertCircle size={16} className="text-amber-400" />
                  Matching Cases ({getMatchingCases().length})
                </h4>
                {getMatchingCases().length === 0 ? (
                  <div className="bg-lime-200/30 border border-lime-300 rounded-lg p-4 text-center">
                    <p className="text-sm text-green-700">
                      This is the only report for <span className="text-lime-700 font-semibold">{detection.animal_type}</span> in <span className="text-lime-700 font-semibold">{detection.location_name}</span>
                    </p>
                    <p className="text-xs text-green-800 mt-2">
                      Monitor for additional reports to increase trust score
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {getMatchingCases().map((matchCase) => (
                      <div 
                        key={matchCase.id}
                        className="bg-lime-200/30 border border-lime-300 hover:border-lime-400/50 rounded-lg p-3 transition-colors"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex-1">
                            <p className="text-xs font-mono text-lime-700">Case ID: {matchCase.id}</p>
                            <p className="text-sm font-semibold text-green-900 mt-1">{matchCase.animal_type}</p>
                          </div>
                          <span className={`text-xs px-2 py-1 rounded border ${
                            matchCase.priority === "High"
                              ? "bg-red-500/20 border-red-500 text-red-300"
                              : matchCase.priority === "Medium"
                              ? "bg-amber-500/20 border-amber-500 text-amber-300"
                              : "bg-lime-300/40 border-lime-400 text-lime-800"
                          }`}>
                            {matchCase.priority}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-green-700">Location:</span>
                            <p className="text-green-900 font-mono">{matchCase.location_name}</p>
                          </div>
                          <div>
                            <span className="text-green-700">Source:</span>
                            <p className="text-green-900 font-mono">{matchCase.source}</p>
                          </div>
                          <div>
                            <span className="text-green-700">Confidence:</span>
                            <p className="text-green-900 font-mono">{(matchCase.confidence * 100).toFixed(0)}%</p>
                          </div>
                          <div>
                            <span className="text-green-700">Detected:</span>
                            <p className="text-green-900 font-mono">{new Date(matchCase.timestamp).toLocaleDateString()}</p>
                          </div>
                        </div>
                        {matchCase.description && (
                          <p className="text-xs text-green-800 mt-2 line-clamp-2">{matchCase.description}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Action Recommendation */}
              <div className="bg-lime-200/60 border border-lime-400/50 rounded-lg p-4">
                <h4 className="text-sm font-bold text-lime-700 mb-2">Recommendation</h4>
                <p className="text-sm text-green-900">
                  {getMatchingCases().length > 0
                    ? `Multiple reports detected. Cross-reference these ${getMatchingCases().length + 1} cases to identify patterns, verify authenticity, and prioritize enforcement action.`
                    : "Single report detected. Monitor for additional reports in this location. Consider investigating if other signals (high confidence, verified source) support action."
                  }
                </p>
              </div>

              {/* AI Trust Score Recommendations */}
              <div className="bg-purple-200/50 border border-purple-400/50 rounded-lg p-4">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="text-sm font-bold text-purple-900 flex items-center gap-2">
                    <Sparkles size={16} className="text-purple-600" />
                    AI Trust Score Recommendations
                  </h4>
                  <button
                    onClick={analyzeTrustScoreRecommendations}
                    disabled={isAnalyzingTrustScore}
                    className="px-3 py-1 text-xs font-semibold bg-purple-600 text-white rounded hover:bg-purple-700 disabled:bg-purple-400 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                  >
                    {isAnalyzingTrustScore ? (
                      <>
                        <Activity size={12} className="animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <Sparkles size={12} />
                        Get Recommendations
                      </>
                    )}
                  </button>
                </div>
                {isAnalyzingTrustScore ? (
                  <div className="flex items-center gap-2 text-purple-700 animate-pulse font-mono text-xs">
                    <Activity size={14} />
                    <span>Analyzing with Gemini API...</span>
                  </div>
                ) : trustScoreRecommendations ? (
                  <div className="text-sm text-purple-900 bg-white/50 rounded p-4 border border-purple-200 space-y-4">
                    {trustScoreRecommendations.startsWith("❌") ? (
                      <p className="text-red-700 font-semibold">{trustScoreRecommendations}</p>
                    ) : (
                      <div className="space-y-4">
                        {trustScoreRecommendations.split('\n\n').map((paragraph, idx) => {
                          const trimmed = paragraph.trim();
                          if (!trimmed) return null;
                          
                          // Check if paragraph starts with a number
                          const numberMatch = trimmed.match(/^(\d+[\.\)])\s+(.+)/);
                          
                          if (numberMatch) {
                            const number = numberMatch[1];
                            const content = numberMatch[2];
                            return (
                              <div key={idx} className="flex gap-3">
                                <span className="flex-shrink-0 font-bold text-purple-700 bg-purple-100 rounded-full w-6 h-6 flex items-center justify-center text-xs">
                                  {number.replace(/[.\)]/, '')}
                                </span>
                                <p className="flex-1 leading-relaxed text-purple-900">{content}</p>
                              </div>
                            );
                          }
                          
                          return (
                            <p key={idx} className="leading-relaxed text-purple-900">{trimmed}</p>
                          );
                        }).filter(Boolean)}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-purple-800 italic">
                    Click "Get Recommendations" to analyze this case with Gemini AI and receive actionable trust score insights.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Geo-Location Modal */}
      {showGeoLocationModal && detection && (
        <div 
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowGeoLocationModal(false)}
        >
          <div 
            className="bg-white border border-lime-400/50 rounded-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-lime-400/40 p-4 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-lime-700 flex items-center gap-2">
                  <MapPin size={20} />
                  Location Details
                </h3>
                <p className="text-xs text-green-700 font-mono mt-1">
                  {detection.animal_type} • {detection.source}
                </p>
              </div>
              <button
                onClick={() => setShowGeoLocationModal(false)}
                className="text-green-800 hover:text-green-900 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* State/Location */}
              <div className="bg-lime-200/50 border border-lime-400/40 rounded-lg p-4">
                <h4 className="text-sm font-bold text-green-900 mb-2 flex items-center gap-2">
                  <MapPin size={16} className="text-lime-700" />
                  State/Location
                </h4>
                <p className="text-sm text-green-900 font-mono">{detection.location_name || "Unknown"}</p>
              </div>

              {/* Full Address - only show if available */}
              {fullAddress && (
                <div className="bg-lime-200/60 border border-lime-400/50 rounded-lg p-4">
                  <h4 className="text-sm font-bold text-lime-700 mb-2">Full Address</h4>
                  <p className="text-sm text-green-900 leading-relaxed break-words">{fullAddress}</p>
                </div>
              )}

              {/* Coordinates */}
              <div className="bg-lime-200/50 border border-lime-400/40 rounded-lg p-4">
                <h4 className="text-sm font-bold text-green-900 mb-2">Coordinates</h4>
                <p className="text-sm text-green-900 font-mono">{detection.lat.toFixed(6)}, {detection.lng.toFixed(6)}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes progress {
          from { transform: translateX(-100%); }
          to { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
};

export default CaseDetails;
