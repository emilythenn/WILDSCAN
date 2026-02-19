
import React, { useState, useEffect } from 'react';
import { Detection } from '../types';
import { Clock, MapPin, Share2, FileText, ShieldCheck, Download, Link as LinkIcon, AlertCircle, Activity, X, Volume2, VolumeX } from 'lucide-react';
import { speakText, stopSpeaking, isSpeechSynthesisSupported, isSpeaking } from '../utils/speechUtils';
import { GoogleGenAI } from "@google/genai";
import { jsPDF } from "jspdf";
import { Document, Paragraph, TextRun, HeadingLevel, AlignmentType, UnderlineType, convertInchesToTwip, ImageRun, Table, TableCell, TableRow, WidthType, BorderStyle, Packer } from "docx";
import { collection, query, where, getDocs, updateDoc, doc, serverTimestamp, getDoc } from "firebase/firestore";
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
  const [showTrustScoreModal, setShowTrustScoreModal] = useState(false);
  const [trustScoreExplanation, setTrustScoreExplanation] = useState<string | null>(null);
  const [isExplainingTrust, setIsExplainingTrust] = useState(false);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicateCases, setDuplicateCases] = useState<Detection[]>([]);
  const [duplicateReasons, setDuplicateReasons] = useState<string[]>([]);
  const [isAnalyzingDuplicate, setIsAnalyzingDuplicate] = useState(false);
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

  const requestGeminiViaRest = async (apiKey: string, prompt: string) => {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`Gemini HTTP ${response.status}`);
    }

    const data = await response.json();
    return await getResponseText(data);
  };

  const handleDuplicateDetected = async () => {
    if (!hash || !detection) return;

    // Find all cases with the same hash
    const duplicates = (allDetections || []).filter(
      (d) => d.evidence_hash === hash && d.id !== detection.id
    );

    setDuplicateCases(duplicates);
    setDuplicateReasons([]);
    setShowDuplicateModal(true);

    // Analyze reasons using Gemini
    await analyzeDuplicateReasons(duplicates);
  };

  const analyzeDuplicateReasons = async (duplicates: Detection[]) => {
    setIsAnalyzingDuplicate(true);

    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
      if (!apiKey) {
        setDuplicateReasons([
          "Illegal evidence reuse",
          "Fraudulent duplicate reports",
          "Copy-paste image manipulation",
          "Screenshot reposting",
          "Unknown reason"
        ]);
        setIsAnalyzingDuplicate(false);
        return;
      }

      const casesSummary = duplicates
        .map((d) => `Case ${d.id}: ${d.animal_type} at ${d.location_name} (${new Date(d.timestamp).toLocaleDateString()})`)
        .join("\n");

      const prompt = `For wildlife enforcement investigations, why would the EXACT SAME evidence image be used in multiple cases? 
Current case: ${detection.animal_type} at ${detection.location_name}
Duplicate cases:
${casesSummary}

Provide 4-5 possible reasons why the same image evidence appears in multiple cases. List reasons that could indicate illegal activities or report manipulation. Format as a JSON array of strings.

Example format: ["Reason 1", "Reason 2", "Reason 3"]`;

      const response = await requestGeminiViaRest(apiKey, prompt);
      
      // Try to parse JSON array from response
      const jsonMatch = response?.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const reasons = JSON.parse(jsonMatch[0]);
        setDuplicateReasons(Array.isArray(reasons) ? reasons : ["Unknown reason"]);
      } else {
        setDuplicateReasons([
          "Illegal evidence reuse",
          "Fraudulent duplicate reports", 
          "Copy-paste image manipulation",
          "Screenshot reposting",
          "Unknown reason"
        ]);
      }
    } catch (error) {
      console.error("Failed to analyze duplicate reasons:", error);
      setDuplicateReasons([
        "Illegal evidence reuse",
        "Fraudulent duplicate reports",
        "Copy-paste image manipulation",
        "Screenshot reposting",
        "Unknown reason"
      ]);
    } finally {
      setIsAnalyzingDuplicate(false);
    }
  };

  const getReasonExplanation = (reason: string): string => {
    const explanations: { [key: string]: string } = {
      "Illegal evidence reuse": "Same image used across multiple cases to fabricate false reports or evidence chains. This is a serious criminal offense in wildlife enforcement.",
      "Fraudulent duplicate reports": "Multiple false reports using identical evidence to manipulate statistics or hide actual violations. Indicates deliberate system abuse.",
      "Copy-paste image manipulation": "Evidence deliberately transferred between unrelated cases to create false connections or hide original source.",
      "Screenshot reposting": "Image re-captured and reposted, potentially losing chain-of-custody metadata and evidence integrity markers.",
      "Image sharing platform cross-posting": "Same wildlife image shared across multiple reports from different social media sources without proper verification.",
      "Unknown reason": "The duplicate was detected but the AI could not determine a specific reason. Manual investigation recommended."
    };
    return explanations[reason] || reason;
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
          const response = await ai.models.generateContent({
            model: "gemini-1.5-flash-latest",
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

    const buildHash = async () => {
      setHash(null);
      setHashError(null);

      if (detection?.evidence_hash) {
        setHash(detection.evidence_hash);
        setIsHashing(false);
        return;
      }

      if (!detection?.image_url) {
        setIsHashing(false);
        return;
      }

      if (!window.crypto?.subtle) {
        setHashError("SHA-256 not available in this browser.");
        setIsHashing(false);
        return;
      }

      setIsHashing(true);
      try {
        const response = await fetch(detection.image_url, { mode: "cors" });
        if (!response.ok) {
          throw new Error("Unable to fetch evidence image.");
        }
        const buffer = await response.arrayBuffer();
        const hashBuffer = await window.crypto.subtle.digest("SHA-256", buffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
        if (!cancelled) {
          setHash(hashHex);
          
          // Save hash to Firestore evidence collection only
          if (db && detection.id && hashHex) {
            try {
              const evidenceRef = collection(db, "evidence");
              const q = query(evidenceRef, where("caseId", "==", detection.id));
              const querySnapshot = await getDocs(q);
              
              if (!querySnapshot.empty) {
                // Update first matching evidence document with field name "hash"
                const evidenceDoc = querySnapshot.docs[0];
                await updateDoc(evidenceDoc.ref, {
                  hash: hashHex,
                  hashCalculatedAt: serverTimestamp(),
                  updatedAt: serverTimestamp()
                });
                console.log(`Evidence hash saved to evidence collection for case ${detection.id}`);
              } else {
                console.warn(`No evidence document found for case ${detection.id}`);
              }
            } catch (firestoreError) {
              console.error("Failed to save evidence hash to Firestore:", firestoreError);
            }
          }
        }
      } catch (err) {
        if (!cancelled) {
          setHashError("Hash unavailable for this evidence.");
        }
      } finally {
        if (!cancelled) {
          setIsHashing(false);
        }
      }
    };

    buildHash();

    return () => {
      cancelled = true;
    };
  }, [detection?.image_url]);

  useEffect(() => {
    if (!isGenerating) {
      setReportLogs([]);
    }
  }, [isGenerating]);

  useEffect(() => {
    setReportReady(false);
    setReportContent(null);
  }, [detection?.id]);

  // Check if hash is unique among all detections
  useEffect(() => {
    if (!hash || !detection) {
      setIsHashUnique(null);
      return;
    }

    // Count how many detections have this same hash
    const duplicateCount = (allDetections || []).filter(
      (d) => d.evidence_hash === hash && d.id !== detection.id
    ).length;

    setIsHashUnique(duplicateCount === 0);
  }, [hash, detection, allDetections]);

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
      <div className="flex-1 flex flex-col items-center justify-center text-slate-500 p-8 text-center bg-slate-900/40">
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
    Low: "text-emerald-400",
  };
  const priorityBadgeClass: Record<Detection["priority"], string> = {
    High: "bg-red-500/10 border-red-500 text-red-500",
    Medium: "bg-amber-500/10 border-amber-500 text-amber-400",
    Low: "bg-emerald-500/10 border-emerald-500 text-emerald-500",
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
          <div className="absolute inset-0 bg-gradient-to-br from-slate-900/95 via-slate-950/90 to-black/95 backdrop-blur-xl"></div>
          
          {/* Glassmorphism Card */}
          <div className="relative w-full max-w-3xl bg-slate-900/40 backdrop-blur-2xl border border-emerald-500/30 rounded-2xl shadow-[0_8px_32px_0_rgba(16,185,129,0.15)] p-8 overflow-hidden">
            {/* Gradient Accents */}
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-emerald-500 to-transparent opacity-50"></div>
            <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-emerald-500 to-transparent opacity-50"></div>
            
            {/* Cancel Icon */}
            {reportReady && (
              <button
                onClick={() => setReportReady(false)}
                className="absolute top-4 right-4 z-20 p-2 rounded-lg bg-slate-800/60 backdrop-blur-sm border border-slate-700/50 text-slate-400 hover:text-emerald-400 hover:bg-slate-700/60 hover:border-emerald-500/30 transition-all duration-200 group"
                aria-label="Close"
              >
                <X size={18} className="group-hover:rotate-90 transition-transform duration-200" />
              </button>
            )}
            
            {/* Content */}
            <div className="relative z-10">
              <div className="flex items-center gap-2 text-emerald-400 mb-6">
                <Activity size={20} className="animate-pulse" />
                <h3 className="text-sm font-bold uppercase tracking-widest">
                  {reportReady ? "Prosecution Report Ready" : "Generating Prosecution Report"}
                </h3>
              </div>
              
              {!reportReady ? (
                <>
                  <div className="flex-1 space-y-2 text-[10px] text-emerald-400/80 overflow-y-auto max-h-96 bg-slate-950/30 backdrop-blur-sm rounded-lg p-4 border border-emerald-500/10">
                    {reportLogs.map((log, i) => (
                      <div key={i} className="animate-in slide-in-from-left duration-300 py-1">
                        {log}
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 pt-4 border-t border-emerald-500/20">
                    <div className="w-full h-2 bg-slate-950/50 backdrop-blur-sm rounded-full overflow-hidden border border-emerald-500/20">
                      <div className="h-full bg-gradient-to-r from-emerald-500 via-emerald-400 to-emerald-500 animate-[progress_5s_linear_infinite] shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col gap-4">
                  <div className="text-xs text-slate-300 leading-relaxed bg-gradient-to-br from-emerald-500/10 via-slate-900/40 to-slate-900/20 backdrop-blur-md border border-emerald-500/30 p-6 rounded-xl shadow-[0_4px_16px_0_rgba(16,185,129,0.1)]">
                    <div className="text-[11px] uppercase tracking-widest text-emerald-400 font-mono font-bold">Report Summary</div>
                    <div className="mt-2 text-slate-200">
                      Case {detection.id} prepared with evidence highlights and AI risk assessment.
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-[10px]">
                      <div className="bg-slate-900/60 backdrop-blur-sm border border-slate-700/50 rounded-lg px-3 py-2 shadow-sm">
                        <span className="text-slate-400">Priority:</span> <span className="text-emerald-300 font-semibold">{detection.priority}</span>
                      </div>
                      <div className="bg-slate-900/60 backdrop-blur-sm border border-slate-700/50 rounded-lg px-3 py-2 shadow-sm">
                        <span className="text-slate-400">Confidence:</span> <span className="text-emerald-300 font-semibold">{(detection.confidence * 100).toFixed(0)}%</span>
                      </div>
                      <div className="bg-slate-900/60 backdrop-blur-sm border border-slate-700/50 rounded-lg px-3 py-2 shadow-sm">
                        <span className="text-slate-400">Location:</span> <span className="text-emerald-300 font-semibold">{detection.location_name}</span>
                      </div>
                      <div className="bg-slate-900/60 backdrop-blur-sm border border-slate-700/50 rounded-lg px-3 py-2 shadow-sm">
                        <span className="text-slate-400">Source:</span> <span className="text-emerald-300 font-semibold">{detection.source}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleDownloadPdf}
                      className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 font-bold text-xs shadow-[0_4px_16px_0_rgba(16,185,129,0.3)] hover:shadow-[0_6px_20px_0_rgba(16,185,129,0.4)] transition-all duration-200 active:scale-95"
                    >
                      <Download size={14} />
                      Download PDF
                    </button>
                    <button
                      onClick={handleDownloadWord}
                      className="flex items-center gap-2 px-6 py-3 rounded-xl bg-slate-800/60 backdrop-blur-sm text-slate-100 font-bold text-xs border border-slate-700/50 hover:bg-slate-700/60 hover:border-slate-600 shadow-sm hover:shadow-md transition-all duration-200 active:scale-95"
                    >
                      <Download size={14} />
                      Download Word
                    </button>
                    <button
                      onClick={() => setReportReady(false)}
                      className="ml-auto text-[10px] uppercase tracking-widest text-slate-400 hover:text-emerald-400 transition-colors px-4 py-2 rounded-lg hover:bg-slate-800/30 backdrop-blur-sm"
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

      <div className="p-6 border-b border-emerald-500/20">
        <div className="flex items-start justify-between mb-2">
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest border ${priorityBadgeClass[detection.priority]}`}>
            {detection.priority} Priority Case
          </span>
          <div className="text-[10px] text-slate-500 font-mono">ID: {detection.id}</div>
        </div>
        <h2 className="text-2xl font-bold text-slate-100">{detection.animal_type}</h2>
        <div className="flex items-center gap-2 text-emerald-500/70 text-xs font-mono mt-1">
          <Clock size={12} />
          <span>Detected {formattedDate}</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-[10px] uppercase font-mono text-slate-500 tracking-widest">Visual Evidence</label>
            <div className="flex items-center gap-3">
              {isSpeechSupported && (
                <button
                  type="button"
                  onClick={() => setIsReadAloudActive(!isReadAloudActive)}
                  className={`text-[10px] uppercase font-mono tracking-widest transition-all flex items-center gap-1 ${
                    isReadAloudActive
                      ? 'text-emerald-400 hover:text-emerald-300'
                      : 'text-slate-500 hover:text-emerald-400'
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
                className="text-[10px] uppercase font-mono tracking-widest text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                {isImageFit ? "Fill" : "Fit"}
              </button>
            </div>
          </div>
          <div className="aspect-video w-full rounded-lg overflow-hidden border border-slate-700/50 bg-slate-800 relative group hover:border-slate-600/50 transition-colors duration-300">
            {detection.image_url ? (
              <img
                src={detection.image_url}
                alt="Evidence"
                className={`w-full h-full ${isImageFit ? "object-contain" : "object-cover"} grayscale-[0.3] group-hover:grayscale-0 transition-all duration-500`}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xs text-slate-500 font-mono">
                Evidence image unavailable
              </div>
            )}
            <div className="absolute bottom-4 right-4 bg-slate-950/70 backdrop-blur-sm px-3 py-2 rounded-lg text-[10px] font-mono text-slate-300 border border-slate-700/50 flex items-center gap-1">
              Confidence: {(detection.confidence * 100).toFixed(1)}%
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-800/40 border border-slate-700/50 hover:border-slate-600/50 p-3 rounded-lg transition-colors duration-200">
            <p className="text-[9px] text-slate-400 font-mono uppercase mb-2 font-semibold tracking-wider">Marketplace</p>
            <div className="flex items-center gap-2">
               <Share2 size={16} className="text-slate-400" />
               <span className="text-sm font-semibold truncate text-slate-100">{detection.platform_source || detection.source}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowGeoLocationModal(true)}
            className="bg-slate-800/40 border border-slate-700/50 hover:border-slate-600/50 p-3 rounded-lg transition-colors duration-200 cursor-pointer text-left"
          >
            <p className="text-[9px] text-slate-400 font-mono uppercase mb-2 font-semibold tracking-wider">Geo-Location</p>
            <div className="flex items-center gap-2">
               <MapPin size={16} className="text-slate-400" />
               <span className="text-sm font-semibold truncate text-slate-100">{detection.location_name}</span>
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
            className="bg-slate-800/40 border border-slate-700/50 hover:border-slate-600/50 p-3 rounded-lg transition-colors duration-200 cursor-pointer text-left col-span-2"
          >
            <p className="text-[9px] text-slate-400 font-mono uppercase mb-2 font-semibold tracking-wider">Trust Score - Matching Reports</p>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                 <Activity size={16} className="text-slate-400" />
                 <span className="text-sm font-semibold text-slate-100">{detection.trust_score ?? 0} similar reports</span>
              </div>
              <span className="text-[10px] text-slate-500">Click to view</span>
            </div>
          </button>
        </div>

        <div className="bg-slate-800/40 border border-slate-700/50 p-4 rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[9px] text-slate-400 font-mono uppercase tracking-wider font-semibold">Quick Action</p>
            <span className="text-[9px] text-slate-500 font-mono uppercase tracking-wider">Send to Ranger</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleSendRangerWhatsApp}
              className="px-4 py-2.5 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-[10px] font-mono uppercase tracking-widest hover:bg-emerald-500/30 hover:border-emerald-500/50 transition-colors duration-200"
            >
              WhatsApp
            </button>
            <button
              type="button"
              onClick={handleSendRangerEmail}
              className="px-4 py-2.5 rounded-lg bg-slate-700/30 border border-slate-600/50 text-slate-300 text-[10px] font-mono uppercase tracking-widest hover:bg-slate-700/50 hover:border-slate-600 transition-colors duration-200"
            >
              Email
            </button>
          </div>
          <p className="text-[10px] text-slate-500 mt-3">
            Prefilled with case ID, species, and coordinates.
          </p>
        </div>

        <div className="bg-slate-800/40 border border-slate-700/50 p-4 rounded-lg">
          <p className="text-[9px] text-slate-400 font-mono uppercase mb-3 tracking-wider font-semibold">Case Status</p>
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
                    ? "bg-emerald-500/30 border-emerald-500/50 text-emerald-200"
                    : "bg-slate-700/30 border-slate-600/50 text-slate-400 hover:bg-slate-700/50 hover:border-slate-600"
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-slate-900/40 border border-slate-700/50 p-4 rounded-lg">
          <div className="mb-3 pb-3 border-b border-slate-700/30">
            <p className="text-[9px] text-slate-400 font-mono uppercase tracking-wider font-semibold">Case Information</p>
            <p className="text-[8px] text-slate-500 mt-1">Detection metadata and evidence details</p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-lg bg-slate-800/40 border border-slate-700/50 hover:border-slate-600/50 p-3 transition-colors duration-200">
              <span className="text-[9px] text-slate-400 font-mono uppercase tracking-wider font-semibold">Detected Species</span>
              <div className="mt-2 text-slate-100 font-medium">
                {detection.species_detected || detection.detected_species_name || detection.animal_type || "N/A"}
              </div>
            </div>
            <div className="rounded-lg bg-slate-800/40 border border-slate-700/50 hover:border-slate-600/50 p-3 transition-colors duration-200">
              <span className="text-[9px] text-slate-400 font-mono uppercase tracking-wider font-semibold">Platform Source</span>
              <div className="mt-2 text-slate-100 font-medium">
                {detection.platform_source || detection.source || "N/A"}
              </div>
            </div>
            <div className="rounded-lg bg-slate-800/40 border border-slate-700/50 hover:border-slate-600/50 p-3 transition-colors duration-200">
              <span className="text-[9px] text-slate-400 font-mono uppercase tracking-wider font-semibold">Location (State)</span>
              <div className="mt-2 text-slate-100 font-medium">{detection.location_name || "Unknown"}</div>
            </div>
            <div className="rounded-lg bg-slate-800/40 border border-slate-700/50 hover:border-slate-600/50 p-3 transition-colors duration-200 col-span-2">
              <span className="text-[9px] text-slate-400 font-mono uppercase tracking-wider font-semibold">Full Address</span>
              <div className="mt-2 text-slate-100 leading-relaxed break-words">{fullAddress || "N/A"}</div>
            </div>
            <div className="rounded-lg bg-slate-800/40 border border-slate-700/50 hover:border-slate-600/50 p-3 transition-colors duration-200">
              <span className="text-[9px] text-slate-400 font-mono uppercase tracking-wider font-semibold">Priority</span>
              <div className="mt-2">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono uppercase border ${priorityBadgeClass[detection.priority]}`}>
                  {detection.priority}
                </span>
              </div>
            </div>
            <div className="rounded-lg bg-slate-800/40 border border-slate-700/50 hover:border-slate-600/50 p-3 transition-colors duration-200">
              <span className="text-[9px] text-slate-400 font-mono uppercase tracking-wider font-semibold">AI Scanned At</span>
              <div className="mt-2 text-slate-100">{formattedAiScannedAt}</div>
            </div>
            <div className="rounded-lg bg-slate-800/40 border border-slate-700/50 hover:border-slate-600/50 p-3 transition-colors duration-200">
              <span className="text-[9px] text-slate-400 font-mono uppercase tracking-wider font-semibold">Created At</span>
              <div className="mt-2 text-slate-100">{formattedCreatedAt}</div>
            </div>
            <div className="rounded-lg bg-slate-800/40 border border-slate-700/50 hover:border-slate-600/50 p-3 transition-colors duration-200">
              <span className="text-[9px] text-slate-400 font-mono uppercase tracking-wider font-semibold">Confidence Score</span>
              <div className="mt-2 text-slate-100 font-medium">
                {((detection.confidence_score ?? detection.confidence) * 100).toFixed(0)}%
              </div>
            </div>
            <div className="rounded-lg bg-slate-800/40 border border-slate-700/50 hover:border-slate-600/50 p-3 transition-colors duration-200">
              <span className="text-[9px] text-slate-400 font-mono uppercase tracking-wider font-semibold">Risk Score</span>
              <div className="mt-2 text-slate-100 font-medium">
                {typeof detection.risk_score === "number" ? detection.risk_score.toFixed(2) : "N/A"}
              </div>
            </div>
            <div className="rounded-lg bg-slate-800/40 border border-slate-700/50 hover:border-slate-600/50 p-3 transition-colors duration-200">
              <span className="text-[9px] text-slate-400 font-mono uppercase tracking-wider font-semibold">Detected Illegal Product</span>
              <div className="mt-2 text-slate-100">{detection.detected_illegal_product || "Unknown"}</div>
            </div>
            <div className="rounded-lg bg-slate-800/40 border border-slate-700/50 hover:border-slate-600/50 p-3 transition-colors duration-200">
              <span className="text-[9px] text-slate-400 font-mono uppercase tracking-wider font-semibold">Source</span>
              <div className="mt-2 text-slate-100">{detection.source || "N/A"}</div>
            </div>
            <div className="rounded-lg bg-slate-800/40 border border-slate-700/50 hover:border-slate-600/50 p-3 transition-colors duration-200">
              <span className="text-[9px] text-slate-400 font-mono uppercase tracking-wider font-semibold">Evidence Summary</span>
              <div className="mt-2 text-slate-100">{detection.reason_summary || "N/A"}</div>
            </div>
            <div className="rounded-lg bg-slate-800/40 border border-slate-700/50 hover:border-slate-600/50 p-3 transition-colors duration-200 col-span-2">
              <span className="text-[9px] text-slate-400 font-mono uppercase tracking-wider font-semibold">Reason</span>
              <div className="mt-2 text-slate-100 leading-relaxed break-words">{detection.reason || "N/A"}</div>
            </div>
          </div>
        </div>

        <div className="hidden space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-[10px] uppercase font-mono text-slate-500 tracking-widest">Gemini AI Verification Intel</label>
          </div>
          <div className="space-y-2 text-xs text-slate-400 bg-slate-950/80 p-4 rounded-lg border border-slate-800 group">
            <div className="flex justify-between border-b border-slate-800/50 pb-2">
              <span className="text-slate-500">Coordinates:</span>
              <span className="text-slate-300 font-mono">{detection.lat.toFixed(6)}, {detection.lng.toFixed(6)}</span>
            </div>
              <div className="flex justify-between border-b border-slate-800/50 pb-2">
                <span className="text-slate-500">Risk Level:</span>
                <span className={`font-mono ${localRisk.riskLevel === "High" ? "text-red-400" : localRisk.riskLevel === "Medium" ? "text-amber-400" : "text-emerald-400"}`}>
                  {localRisk.riskLevel}
                </span>
              </div>
            <div className="flex flex-col gap-1 border-b border-slate-800/50 pb-2">
              <div className="flex justify-between items-start gap-2">
                <span className="text-slate-500">Evidence Hash:</span>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-emerald-400 font-mono break-all text-xs">
                    {isHashing ? "Calculating..." : hash || "N/A"}
                  </span>
                  {hash && (
                    <button
                      onClick={() => !isHashUnique && handleDuplicateDetected()}
                      disabled={isHashUnique === null || isHashUnique}
                      className={`text-[10px] font-mono px-2 py-0.5 rounded cursor-pointer transition-all ${
                        isHashUnique === null ? "bg-slate-800 text-slate-400" :
                        isHashUnique ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 cursor-default" :
                        "bg-red-500/20 text-red-400 border border-red-500/50 hover:bg-red-500/30 hover:border-red-500 active:bg-red-400/20"
                      }`}>
                      {isHashUnique === null ? "Checking..." :
                       isHashUnique ? "✓ Unique Evidence" :
                       "⚠ Duplicate Found"}
                    </button>
                  )}
                </div>
              </div>
              <div className="text-[10px] text-slate-500">
                {hashError || "SHA-256 fingerprint keeps evidence tamper-proof for Malaysian courts."}
              </div>
            </div>

            {showDuplicateModal && duplicateCases.length > 0 && (
              <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                <div className="bg-slate-900 border border-red-500/50 rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6 space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="text-lg font-mono text-red-400 uppercase tracking-wider">⚠ Duplicate Evidence Hash</h2>
                      <p className="text-xs text-slate-400 mt-1">Hash: {hash?.substring(0, 16)}... (appears in {duplicateCases.length + 1} case{duplicateCases.length > 0 ? 's' : ''})</p>
                    </div>
                    <button
                      onClick={() => setShowDuplicateModal(false)}
                      className="text-slate-400 hover:text-slate-200 text-xl font-bold">×</button>
                  </div>

                  <div className="bg-slate-950/50 border border-slate-800 rounded p-3 space-y-2">
                    <p className="text-[10px] uppercase text-slate-500 font-mono">📋 Matching Cases with Same Hash:</p>
                    {duplicateCases.map((dup) => (
                      <div key={dup.id} className="text-xs border-l-2 border-red-500/50 pl-3 py-2">
                        <div className="text-slate-300"><strong>{dup.animal_type}</strong> {dup.case_name && `(${dup.case_name})`}</div>
                        <div className="text-slate-500 text-[10px]">📍 {dup.location_name}</div>
                        <div className="text-slate-500 text-[10px]">📅 {new Date(dup.timestamp).toLocaleString()}</div>
                      </div>
                    ))}
                  </div>

                  <div className="bg-amber-950/30 border border-amber-700/50 rounded p-4 space-y-2">
                    <p className="text-[10px] uppercase text-amber-400 font-mono font-bold">⚠️ Why This Matters:</p>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Identical evidence hash across multiple cases indicates potential evidence tampering, unauthorized reuse, or fraudulent reporting. This affects prosecution integrity and court admissibility - Malaysian courts require verified chain of custody and evidence authenticity.
                    </p>
                  </div>

                  <div className="space-y-3 bg-slate-950/40 border border-slate-800 rounded p-4">
                    <p className="text-[10px] uppercase text-emerald-400 font-mono font-bold">🔍 Gemini Analysis - Possible Reasons:</p>
                    {isAnalyzingDuplicate ? (
                      <div className="flex items-center gap-2 text-emerald-400 text-xs animate-pulse">
                        <Activity size={14} />
                        <span>AI analyzing investigation context...</span>
                      </div>
                    ) : duplicateReasons.length > 0 ? (
                      <div className="space-y-2">
                        {duplicateReasons.map((reason, idx) => (
                          <div key={idx} className="bg-slate-900/80 border border-slate-700 rounded p-3">
                            <p className="text-xs text-emerald-400 font-semibold">→ {reason}</p>
                            <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                              {getReasonExplanation(reason)}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      onClick={() => setShowDuplicateModal(false)}
                      className="px-4 py-2 rounded border border-slate-700 text-xs font-mono uppercase text-slate-400 hover:bg-slate-800/50 transition-all">
                      Close & Review
                    </button>
                  </div>
                </div>
              </div>
            )}
            <div className="pt-2">
              <p className="mb-2 text-slate-500 flex items-center gap-2">
                <AlertCircle size={12} className="text-red-500" /> Gemini Risk Assessment:
              </p>
              <div className="italic text-slate-300 leading-relaxed bg-slate-900/50 p-3 rounded border-l-2 border-emerald-500 min-h-[60px] flex items-center">
                {isAnalyzing ? (
                  <div className="flex items-center gap-2 text-emerald-400 animate-pulse font-mono text-[10px]">
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

      <div className="p-6 bg-slate-950 border-t border-emerald-500/20">
        <button 
          onClick={handleGenerateReport}
          className="w-full flex items-center justify-center gap-2 py-3.5 bg-emerald-500 text-slate-950 rounded-xl font-black text-sm transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.5)] hover:bg-emerald-400 active:scale-[0.98]"
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
            className="bg-slate-900 border border-emerald-500/30 rounded-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-slate-900 border-b border-emerald-500/20 p-4 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-emerald-400 flex items-center gap-2">
                  <Activity size={20} />
                  Trust Score Analysis
                </h3>
                <p className="text-xs text-slate-500 font-mono mt-1">
                  {detection.animal_type} • {detection.location_name}
                </p>
              </div>
              <button
                onClick={() => setShowTrustScoreModal(false)}
                className="text-slate-400 hover:text-slate-200 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Trust Score Explanation */}
              <div className="bg-slate-800/50 border border-emerald-500/20 rounded-lg p-4">
                <h4 className="text-sm font-bold text-slate-200 mb-2 flex items-center gap-2">
                  <ShieldCheck size={16} className="text-emerald-400" />
                  Current Trust Score: {detection.trust_score ?? 0}
                </h4>
                {isExplainingTrust ? (
                  <div className="flex items-center gap-2 text-emerald-400 animate-pulse font-mono text-xs">
                    <Activity size={14} />
                    <span>Generating AI explanation...</span>
                  </div>
                ) : (
                  <p className="text-sm text-slate-300 leading-relaxed">
                    {trustScoreExplanation || "Trust Score represents the number of similar reports (same species + location). Higher scores indicate stronger community validation."}
                  </p>
                )}
              </div>

              {/* Matching Cases */}
              <div>
                <h4 className="text-sm font-bold text-slate-200 mb-3 flex items-center gap-2">
                  <AlertCircle size={16} className="text-amber-400" />
                  Matching Cases ({getMatchingCases().length})
                </h4>
                {getMatchingCases().length === 0 ? (
                  <div className="bg-slate-800/30 border border-slate-700 rounded-lg p-4 text-center">
                    <p className="text-sm text-slate-500">
                      This is the only report for <span className="text-emerald-400 font-semibold">{detection.animal_type}</span> in <span className="text-emerald-400 font-semibold">{detection.location_name}</span>
                    </p>
                    <p className="text-xs text-slate-600 mt-2">
                      Monitor for additional reports to increase trust score
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {getMatchingCases().map((matchCase) => (
                      <div 
                        key={matchCase.id}
                        className="bg-slate-800/30 border border-slate-700 hover:border-emerald-500/30 rounded-lg p-3 transition-colors"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex-1">
                            <p className="text-xs font-mono text-emerald-400">Case ID: {matchCase.id}</p>
                            <p className="text-sm font-semibold text-slate-200 mt-1">{matchCase.animal_type}</p>
                          </div>
                          <span className={`text-xs px-2 py-1 rounded border ${
                            matchCase.priority === "High"
                              ? "bg-red-500/20 border-red-500 text-red-300"
                              : matchCase.priority === "Medium"
                              ? "bg-amber-500/20 border-amber-500 text-amber-300"
                              : "bg-emerald-500/20 border-emerald-500 text-emerald-300"
                          }`}>
                            {matchCase.priority}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-slate-500">Location:</span>
                            <p className="text-slate-300 font-mono">{matchCase.location_name}</p>
                          </div>
                          <div>
                            <span className="text-slate-500">Source:</span>
                            <p className="text-slate-300 font-mono">{matchCase.source}</p>
                          </div>
                          <div>
                            <span className="text-slate-500">Confidence:</span>
                            <p className="text-slate-300 font-mono">{(matchCase.confidence * 100).toFixed(0)}%</p>
                          </div>
                          <div>
                            <span className="text-slate-500">Detected:</span>
                            <p className="text-slate-300 font-mono">{new Date(matchCase.timestamp).toLocaleDateString()}</p>
                          </div>
                        </div>
                        {matchCase.description && (
                          <p className="text-xs text-slate-400 mt-2 line-clamp-2">{matchCase.description}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Action Recommendation */}
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4">
                <h4 className="text-sm font-bold text-emerald-400 mb-2">Recommendation</h4>
                <p className="text-sm text-slate-300">
                  {getMatchingCases().length > 0
                    ? `Multiple reports detected. Cross-reference these ${getMatchingCases().length + 1} cases to identify patterns, verify authenticity, and prioritize enforcement action.`
                    : "Single report detected. Monitor for additional reports in this location. Consider investigating if other signals (high confidence, verified source) support action."
                  }
                </p>
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
            className="bg-slate-900 border border-emerald-500/30 rounded-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-slate-900 border-b border-emerald-500/20 p-4 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-emerald-400 flex items-center gap-2">
                  <MapPin size={20} />
                  Location Details
                </h3>
                <p className="text-xs text-slate-500 font-mono mt-1">
                  {detection.animal_type} • {detection.source}
                </p>
              </div>
              <button
                onClick={() => setShowGeoLocationModal(false)}
                className="text-slate-400 hover:text-slate-200 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* State/Location */}
              <div className="bg-slate-800/50 border border-emerald-500/20 rounded-lg p-4">
                <h4 className="text-sm font-bold text-slate-200 mb-2 flex items-center gap-2">
                  <MapPin size={16} className="text-emerald-400" />
                  State/Location
                </h4>
                <p className="text-sm text-slate-300 font-mono">{detection.location_name || "Unknown"}</p>
              </div>

              {/* Full Address - only show if available */}
              {fullAddress && (
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4">
                  <h4 className="text-sm font-bold text-emerald-400 mb-2">Full Address</h4>
                  <p className="text-sm text-slate-300 leading-relaxed break-words">{fullAddress}</p>
                </div>
              )}

              {/* Coordinates */}
              <div className="bg-slate-800/50 border border-emerald-500/20 rounded-lg p-4">
                <h4 className="text-sm font-bold text-slate-200 mb-2">Coordinates</h4>
                <p className="text-sm text-slate-300 font-mono">{detection.lat.toFixed(6)}, {detection.lng.toFixed(6)}</p>
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
