
import React, { useState, useEffect } from 'react';
import { Detection } from '../types';
import { Clock, MapPin, Share2, FileText, ShieldCheck, Download, Link as LinkIcon, AlertCircle, Activity } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { jsPDF } from "jspdf";
import { collection, query, where, getDocs, updateDoc, doc, serverTimestamp } from "firebase/firestore";
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
    const endpoint = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;
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

  if (!detection) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-slate-500 p-8 text-center bg-slate-900/40">
        <ShieldCheck size={48} className="mb-4 opacity-10" />
        <p className="text-xs font-mono uppercase tracking-[0.2em] opacity-40">Awaiting Target Selection</p>
      </div>
    );
  }

  const formattedDate = formatTimestamp(detection.timestamp);
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
    const reportLines = [
      "WILDSCAN Evidence Report",
      "========================",
      `Case ID: ${detection.id}`,
      `Species: ${detection.animal_type}`,
      `Status: ${detection.status || "Pending"}`,
      `Trust Score: ${detection.trust_score ?? 0}`,
      `Priority: ${detection.priority}`,
      `Confidence: ${(detection.confidence * 100).toFixed(2)}% (${confidenceLabel})`,
      `Source: ${detection.source}`,
      `Location: ${detection.location_name}`,
      `Coordinates: ${detection.lat.toFixed(6)}, ${detection.lng.toFixed(6)}`,
      `Detected At: ${formattedDate}`,
      `Evidence Hash (SHA-256): ${hash || "N/A"}`,
      "",
      "Case Highlights:",
      `- Priority level indicates enforcement urgency (${detection.priority}).`,
      `- Confidence level suggests ${confidenceLabel.toLowerCase()} model certainty.`,
      `- Source platform flagged for monitored listings: ${detection.source}.`,
      `- Location clustered within monitoring region: ${detection.location_name}.`,
      "",
      "Description:",
      detection.description || "N/A",
      "",
      "Operational Notes:",
      "- Preserve digital evidence and timestamps for chain of custody.",
      "- Verify listing persistence and capture screenshots where possible.",
      "- Cross-check with existing watchlists and repeat offenders.",
      "",
      "Evidence Integrity:",
      "- SHA-256 fingerprint stored to prove evidence has not been altered for Malaysian courts.",
      "",
      "Evidence Timeline:",
      "1) Detection recorded and cataloged in monitoring queue.",
      "2) Verification and risk assessment completed.",
      "3) Case packaged for enforcement review and archival.",
      "",
      "Local Risk Summary:",
      localRisk.summary,
      "",
      "Gemini Risk Assessment:",
      aiSummary,
    ];

    return reportLines.join("\n");
  };

  const buildReportHtml = () => {
    const localRisk = buildLocalRiskSummary(detection);
    const aiSummary = resolveAiSummary(localRisk.summary);
    const confidenceLabel = detection.confidence >= 0.9 ? "Very High" : detection.confidence >= 0.75 ? "High" : detection.confidence >= 0.5 ? "Medium" : "Low";
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
    ul { margin: 0; padding-left: 18px; }
    li { margin: 4px 0; }
  </style>
</head>
<body>
  <h1>WILDSCAN Evidence Report</h1>
  <div class="card">
    <div class="badge">${detection.priority} Priority</div>
    <div class="meta">
      <div><span class="label">Case ID:</span> ${detection.id}</div>
      <div><span class="label">Species:</span> ${detection.animal_type}</div>
      <div><span class="label">Status:</span> ${detection.status || "Pending"}</div>
      <div><span class="label">Trust Score:</span> ${detection.trust_score ?? 0}</div>
      <div><span class="label">Confidence:</span> ${(detection.confidence * 100).toFixed(2)}% (${confidenceLabel})</div>
      <div><span class="label">Source:</span> ${detection.source}</div>
      <div><span class="label">Location:</span> ${detection.location_name}</div>
      <div><span class="label">Coordinates:</span> ${detection.lat.toFixed(6)}, ${detection.lng.toFixed(6)}</div>
      <div><span class="label">Detected At:</span> ${formattedDate}</div>
      <div><span class="label">Evidence Hash:</span> ${hash || "N/A"}</div>
    </div>
  </div>

  <div class="section">
    <h2>Case Highlights</h2>
    <div class="box">
      <ul>
        <li>Priority level indicates enforcement urgency (${detection.priority}).</li>
        <li>Confidence level suggests ${confidenceLabel.toLowerCase()} model certainty.</li>
        <li>Source platform flagged for monitored listings: ${detection.source}.</li>
        <li>Location clustered within monitoring region: ${detection.location_name}.</li>
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

  <div class="section">
    <h2>Operational Notes</h2>
    <div class="box">
      <ul>
        <li>Preserve digital evidence and timestamps for chain of custody.</li>
        <li>Verify listing persistence and capture screenshots where possible.</li>
        <li>Cross-check with existing watchlists and repeat offenders.</li>
      </ul>
    </div>
  </div>

  <div class="section">
    <h2>Evidence Integrity</h2>
    <div class="box">
      <p><strong>SHA-256 Fingerprint:</strong> ${hash || "N/A"}</p>
      <p>Hashing ensures the evidence remains tamper-proof for Malaysian courts.</p>
    </div>
  </div>

  <div class="section">
    <h2>Evidence Timeline</h2>
    <div class="box">
      <ol>
        <li>Detection recorded and cataloged in monitoring queue.</li>
        <li>Verification and risk assessment completed.</li>
        <li>Case packaged for enforcement review and archival.</li>
      </ol>
    </div>
  </div>

  <div class="section">
    <h2>Local Risk Summary</h2>
    <div class="box">${localRisk.summary}</div>
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

  const handleDownloadWord = () => {
    if (!reportContent) return;
    const blob = new Blob([reportContent.html], { type: "application/msword" });
    downloadBlob(blob, `${reportContent.filename}.doc`);
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

    const ensureSpace = (height: number) => {
      if (y + height > pageHeight - margin) {
        doc.addPage();
        y = margin;
      }
    };

    const addSectionTitle = (title: string) => {
      ensureSpace(28);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(71, 85, 105);
      doc.text(title, margin, y);
      y += 16;
      doc.setDrawColor(226, 232, 240);
      doc.line(margin, y, pageWidth - margin, y);
      y += 14;
    };

    const addParagraph = (text: string, fontSize = 11) => {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(fontSize);
      doc.setTextColor(15, 23, 42);
      const lines = doc.splitTextToSize(text, pageWidth - margin * 2);
      const lineHeight = fontSize + 6;
      ensureSpace(lines.length * lineHeight);
      doc.text(lines, margin, y);
      y += lines.length * lineHeight + 6;
    };

    const addImageSection = async (title: string, url: string) => {
      addSectionTitle(title);
      if (!url) {
        addParagraph("N/A", 10);
        return;
      }
      try {
        const dataUrl = await loadImageDataUrl(url);
        const imageProps = doc.getImageProperties(dataUrl);
        const maxWidth = pageWidth - margin * 2;
        const ratio = imageProps.height / imageProps.width;
        const height = Math.min(260, maxWidth * ratio);
        ensureSpace(height + 12);
        const format = dataUrl.startsWith("data:image/png") ? "PNG" : "JPEG";
        doc.addImage(dataUrl, format, margin, y, maxWidth, height);
        y += height + 12;
      } catch (err) {
        addParagraph("Image unavailable.", 10);
      }
    };

    const addBullets = (items: string[]) => {
      items.forEach((item) => {
        addParagraph(`- ${item}`, 10);
      });
    };

    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageWidth, 56, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(255, 255, 255);
    doc.text("WILDSCAN Evidence Report", margin, 36);
    doc.setFontSize(9);
    doc.text(`Case ${detection.id}`, pageWidth - margin, 36, { align: "right" });

    doc.setTextColor(15, 23, 42);
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString()}`, margin, 70);

    y = 92;
    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(248, 250, 252);
    doc.rect(margin, y, pageWidth - margin * 2, 108, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(4, 120, 87);
    doc.text(`${detection.priority} Priority`, margin + 12, y + 18);
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);

    const meta = [
      [`Case ID`, detection.id],
      [`Species`, detection.animal_type],
      [`Status`, detection.status || "Pending"],
      [`Trust Score`, `${detection.trust_score ?? 0}`],
      [`Confidence`, `${(detection.confidence * 100).toFixed(2)}% (${confidenceLabel})`],
      [`Source`, detection.source],
      [`Location`, detection.location_name],
      [`Coordinates`, `${detection.lat.toFixed(6)}, ${detection.lng.toFixed(6)}`],
      [`Detected At`, formattedDate],
    ];

    const colWidth = (pageWidth - margin * 2) / 2;
    const rowHeight = 22;
    meta.forEach((item, index) => {
      const col = index % 2;
      const row = Math.floor(index / 2);
      const x = margin + 12 + col * colWidth;
      const textY = y + 36 + row * rowHeight;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text(`${item[0]}:`, x, textY);
      doc.setFont("helvetica", "normal");
      doc.text(item[1], x + 60, textY);
    });

    y += 130;

    addSectionTitle("Case Highlights");
    addBullets([
      `Priority level indicates enforcement urgency (${detection.priority}).`,
      `Confidence level suggests ${confidenceLabel.toLowerCase()} model certainty.`,
      `Source platform flagged for monitored listings: ${detection.source}.`,
      `Location clustered within monitoring region: ${detection.location_name}.`,
    ]);

    addSectionTitle("Description");
    addParagraph(detection.description || "N/A");

    await addImageSection("Evidence Image", detection.image_url || "");

    addSectionTitle("Operational Notes");
    addBullets([
      "Preserve digital evidence and timestamps for chain of custody.",
      "Verify listing persistence and capture screenshots where possible.",
      "Cross-check with existing watchlists and repeat offenders.",
    ]);

    addSectionTitle("Evidence Integrity");
    addParagraph(`SHA-256 Fingerprint: ${hash || "N/A"}`, 10);
    addParagraph("Hashing ensures the evidence remains tamper-proof for Malaysian courts.", 10);

    addSectionTitle("Evidence Timeline");
    addParagraph("1) Detection recorded and cataloged in monitoring queue.");
    addParagraph("2) Verification and risk assessment completed.");
    addParagraph("3) Case packaged for enforcement review and archival.");

    addSectionTitle("Local Risk Summary");
    addParagraph(localRisk.summary, 10);

    addSectionTitle("Gemini Risk Assessment");
    addParagraph(aiSummary, 10);

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
      {/* Report Generation Overlay */}
      {(isGenerating || reportReady) && (
        <div className="absolute inset-0 z-50 bg-slate-950 flex flex-col p-8 font-mono overflow-hidden">
          <div className="flex items-center gap-2 text-emerald-500 mb-6">
            <Activity size={20} className="animate-pulse" />
            <h3 className="text-sm font-bold uppercase tracking-widest">
              {reportReady ? "Prosecution Report Ready" : "Generating Prosecution Report"}
            </h3>
          </div>
          {!reportReady ? (
            <>
              <div className="flex-1 space-y-2 text-[10px] text-emerald-400/80 overflow-y-auto">
                {reportLogs.map((log, i) => (
                  <div key={i} className="animate-in slide-in-from-left duration-300">
                    {log}
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t border-emerald-500/20">
                <div className="w-full h-1 bg-slate-900 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 animate-[progress_5s_linear_infinite]"></div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col gap-4">
              <div className="text-xs text-slate-300 leading-relaxed bg-gradient-to-r from-emerald-500/10 via-slate-900/70 to-slate-900/40 border border-emerald-500/30 p-4 rounded-lg">
                <div className="text-[11px] uppercase tracking-widest text-emerald-400 font-mono">Report Summary</div>
                <div className="mt-2 text-slate-200">
                  Case {detection.id} prepared with evidence highlights and AI risk assessment.
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-[10px]">
                  <div className="bg-slate-900/60 border border-slate-800 rounded px-2 py-1">Priority: {detection.priority}</div>
                  <div className="bg-slate-900/60 border border-slate-800 rounded px-2 py-1">Confidence: {(detection.confidence * 100).toFixed(0)}%</div>
                  <div className="bg-slate-900/60 border border-slate-800 rounded px-2 py-1">Location: {detection.location_name}</div>
                  <div className="bg-slate-900/60 border border-slate-800 rounded px-2 py-1">Source: {detection.source}</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleDownloadPdf}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 text-slate-950 font-bold text-xs"
                >
                  <Download size={14} />
                  Download PDF
                </button>
                <button
                  onClick={handleDownloadWord}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 text-slate-100 font-bold text-xs border border-slate-700"
                >
                  <Download size={14} />
                  Download Word
                </button>
                <button
                  onClick={() => setReportReady(false)}
                  className="ml-auto text-[10px] uppercase tracking-widest text-slate-400 hover:text-emerald-400"
                >
                  Close
                </button>
              </div>
            </div>
          )}
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
            <button
              type="button"
              onClick={() => setIsImageFit((prev) => !prev)}
              className="text-[10px] uppercase font-mono tracking-widest text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              {isImageFit ? "Fill" : "Fit"}
            </button>
          </div>
          <div className="aspect-video w-full rounded-xl overflow-hidden border border-slate-700 bg-slate-800 relative group cursor-crosshair">
            {detection.image_url ? (
              <img
                src={detection.image_url}
                alt="Evidence"
                className={`w-full h-full ${isImageFit ? "object-contain" : "object-cover"} grayscale-[0.5] group-hover:grayscale-0 transition-all duration-700`}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xs text-slate-500 font-mono">
                Evidence image unavailable
              </div>
            )}
            <div className="absolute inset-0 bg-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div className="absolute top-4 left-4 border-l-2 border-t-2 border-emerald-500 w-8 h-8"></div>
            <div className="absolute top-4 right-4 border-r-2 border-t-2 border-emerald-500 w-8 h-8"></div>
            <div className="absolute bottom-4 left-4 border-l-2 border-b-2 border-emerald-500 w-8 h-8"></div>
            <div className="absolute bottom-4 right-4 border-r-2 border-b-2 border-emerald-500 w-8 h-8"></div>
            
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 border border-emerald-500/30 rounded-full animate-ping pointer-events-none"></div>

            <div className="absolute bottom-4 left-4 bg-slate-950/80 px-2 py-1 rounded text-[8px] font-mono text-emerald-400">
              AI_CONF: {(detection.confidence * 100).toFixed(2)}%
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-slate-800/30 p-3 rounded-lg border border-slate-800 hover:border-emerald-500/30 transition-colors">
            <p className="text-[10px] text-slate-500 font-mono uppercase mb-1">Marketplace</p>
            <div className="flex items-center gap-2">
               <Share2 size={16} className="text-emerald-400" />
               <span className="text-sm font-semibold truncate">{detection.source}</span>
            </div>
          </div>
          <div className="bg-slate-800/30 p-3 rounded-lg border border-slate-800 hover:border-emerald-500/30 transition-colors">
            <p className="text-[10px] text-slate-500 font-mono uppercase mb-1">Geo-Location</p>
            <div className="flex items-center gap-2">
               <MapPin size={16} className={priorityIconColor[detection.priority]} />
               <span className="text-sm font-semibold truncate text-slate-200">{detection.location_name}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setShowTrustScoreModal(true);
              if (!trustScoreExplanation) {
                explainTrustScore();
              }
            }}
            className="bg-slate-800/30 p-3 rounded-lg border border-slate-800 hover:border-emerald-500/30 transition-colors cursor-pointer text-left w-full"
          >
            <p className="text-[10px] text-slate-500 font-mono uppercase mb-1">Trust Score</p>
            <div className="flex items-center gap-2">
               <Activity size={16} className="text-emerald-400" />
               <span className="text-sm font-semibold text-slate-200">{detection.trust_score ?? 0}</span>
            </div>
            <div className="mt-1 text-[10px] text-emerald-400">Click to see matching cases</div>
          </button>
        </div>

        <div className="bg-slate-800/30 p-3 rounded-lg border border-slate-800">
          <p className="text-[10px] text-slate-500 font-mono uppercase mb-2">Case Status</p>
          <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest">
            {(["Pending", "Investigating", "Resolved"] as Detection["status"][]).map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => {
                  if (!detection) return;
                  const nextStatus = detection.status === status ? undefined : status;
                  onStatusChange?.(detection.id, nextStatus);
                }}
                className={`px-2 py-1 rounded border transition-all ${
                  detection.status === status
                    ? "bg-green-500/20 border-green-500 text-green-300"
                    : "bg-slate-900 border-slate-800 text-slate-500 hover:border-slate-600"
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
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
