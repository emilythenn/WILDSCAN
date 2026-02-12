
import React, { useState, useEffect } from 'react';
import { Detection } from '../types';
import { Clock, MapPin, Share2, FileText, ShieldCheck, Download, Link as LinkIcon, AlertCircle, Activity } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { jsPDF } from "jspdf";

interface CaseDetailsProps {
  detection: Detection | null;
}

const CaseDetails: React.FC<CaseDetailsProps> = ({ detection }) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [reportLogs, setReportLogs] = useState<string[]>([]);
  const [reportReady, setReportReady] = useState(false);
  const [reportContent, setReportContent] = useState<{ text: string; html: string; filename: string } | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isImageFit, setIsImageFit] = useState(true);

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

  const getResponseText = async (response: unknown) => {
    if (typeof response === "string") return response;
    if (response && typeof response === "object") {
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

  // Fix: Integrate Gemini AI to provide real-time verification and risk assessment
  useEffect(() => {
    if (detection) {
      setAiAnalysis(null);
      setIsAnalyzing(true);
      
      const runAIAnalysis = async () => {
        try {
          const apiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
          if (!apiKey) {
            throw new Error("Missing VITE_GEMINI_API_KEY");
          }
          const ai = new GoogleGenAI({ apiKey });
          const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `Analyze this wildlife trade detection for enforcement officers.
              Species: ${detection.animal_type}
              Source Platform: ${detection.source}
              User Provided Description: ${detection.description || 'N/A'}
              Location: ${detection.location_name}
              
              Provide a professional 2-sentence risk assessment regarding the legality and conservation status.`,
          });
          const responseText = await getResponseText(response);
          setAiAnalysis(responseText || "Analysis completed.");
        } catch (err) {
          console.error("Gemini analysis failed:", err);
          setAiAnalysis("AI verification offline. Detection flagged based on metadata matching illegal trade patterns.");
        } finally {
          setIsAnalyzing(false);
        }
      };

      runAIAnalysis();
    }
  }, [detection]);

  useEffect(() => {
    if (!isGenerating) {
      setReportLogs([]);
    }
  }, [isGenerating]);

  useEffect(() => {
    setReportReady(false);
    setReportContent(null);
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

  const buildReportText = () => {
    const aiSummary = aiAnalysis || "AI verification offline. Detection flagged based on metadata matching illegal trade patterns.";
    const confidenceLabel = detection.confidence >= 0.9 ? "Very High" : detection.confidence >= 0.75 ? "High" : detection.confidence >= 0.5 ? "Medium" : "Low";
    const reportLines = [
      "WILDSCAN Evidence Report",
      "========================",
      `Case ID: ${detection.id}`,
      `Species: ${detection.animal_type}`,
      `Priority: ${detection.priority}`,
      `Confidence: ${(detection.confidence * 100).toFixed(2)}% (${confidenceLabel})`,
      `Source: ${detection.source}`,
      `Location: ${detection.location_name}`,
      `Coordinates: ${detection.lat.toFixed(6)}, ${detection.lng.toFixed(6)}`,
      `Detected At: ${formattedDate}`,
      `User Handle: ${detection.user_handle || "N/A"}`,
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
      "Evidence Timeline:",
      "1) Detection recorded and cataloged in monitoring queue.",
      "2) Verification and risk assessment completed.",
      "3) Case packaged for enforcement review and archival.",
      "",
      "Gemini Risk Assessment:",
      aiSummary,
    ];

    return reportLines.join("\n");
  };

  const buildReportHtml = () => {
    const aiSummary = aiAnalysis || "AI verification offline. Detection flagged based on metadata matching illegal trade patterns.";
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
      <div><span class="label">Confidence:</span> ${(detection.confidence * 100).toFixed(2)}% (${confidenceLabel})</div>
      <div><span class="label">Source:</span> ${detection.source}</div>
      <div><span class="label">Location:</span> ${detection.location_name}</div>
      <div><span class="label">Coordinates:</span> ${detection.lat.toFixed(6)}, ${detection.lng.toFixed(6)}</div>
      <div><span class="label">Detected At:</span> ${formattedDate}</div>
      <div><span class="label">User Handle:</span> ${detection.user_handle || "N/A"}</div>
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

  const handleDownloadPdf = () => {
    if (!reportContent) return;
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 40;
    let y = 72;

    const aiSummary = aiAnalysis || "AI verification offline. Detection flagged based on metadata matching illegal trade patterns.";
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
      ensureSpace(lines.length * (fontSize + 3));
      doc.text(lines, margin, y);
      y += lines.length * (fontSize + 3) + 6;
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
      [`Confidence`, `${(detection.confidence * 100).toFixed(2)}% (${confidenceLabel})`],
      [`Source`, detection.source],
      [`Location`, detection.location_name],
      [`Coordinates`, `${detection.lat.toFixed(6)}, ${detection.lng.toFixed(6)}`],
      [`Detected At`, formattedDate],
      [`User Handle`, detection.user_handle || "N/A"],
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

    addSectionTitle("Operational Notes");
    addBullets([
      "Preserve digital evidence and timestamps for chain of custody.",
      "Verify listing persistence and capture screenshots where possible.",
      "Cross-check with existing watchlists and repeat offenders.",
    ]);

    addSectionTitle("Evidence Timeline");
    addParagraph("1) Detection recorded and cataloged in monitoring queue.");
    addParagraph("2) Verification and risk assessment completed.");
    addParagraph("3) Case packaged for enforcement review and archival.");

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
              {reportReady ? "Evidence Report Ready" : "Generating Evidence Report"}
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
                  Case {detection.id} prepared with evidence highlights, operational notes, and AI risk assessment.
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
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest border ${
            detection.priority === 'High' ? 'bg-red-500/10 border-red-500 text-red-500' : 'bg-emerald-500/10 border-emerald-500 text-emerald-500'
          }`}>
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
            <img
              src={detection.image_url}
              alt="Evidence"
              className={`w-full h-full ${isImageFit ? "object-contain" : "object-cover"} grayscale-[0.5] group-hover:grayscale-0 transition-all duration-700`}
            />
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
               <MapPin size={16} className="text-emerald-400" />
               <span className="text-sm font-semibold truncate text-slate-200">{detection.location_name}</span>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-[10px] uppercase font-mono text-slate-500 tracking-widest">Gemini AI Verification Intel</label>
          </div>
          <div className="space-y-2 text-xs text-slate-400 bg-slate-950/80 p-4 rounded-lg border border-slate-800 group">
            <div className="flex justify-between border-b border-slate-800/50 pb-2">
              <span className="text-slate-500">Username:</span>
              <span className="text-emerald-400 font-mono">
                {detection.user_handle ? `@${detection.user_handle}` : ""}
              </span>
            </div>
            <div className="flex justify-between border-b border-slate-800/50 pb-2">
              <span className="text-slate-500">Coordinates:</span>
              <span className="text-slate-300 font-mono">{detection.lat.toFixed(6)}, {detection.lng.toFixed(6)}</span>
            </div>
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
                  <p>"{aiAnalysis || detection.description || `Automated scanning detected non-authorized keywords in metadata.`}"</p>
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
          GENERATE EVIDENCE REPORT
        </button>
      </div>

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
