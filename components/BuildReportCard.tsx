import React, { useMemo, useState } from 'react';
import { Copy, Check, Download, FileText } from 'lucide-react';
import { GrooveObject } from '../types';
import { QualityReport } from '../services/qualityGateService';
import { BuildTool, buildMidiReport, copyTextReport, downloadTextReport, reportFilename } from '../services/buildReportService';

export const BuildReportCard: React.FC<{
  groove: GrooveObject;
  tool?: BuildTool;
  quality?: QualityReport;
  extra?: Record<string, string | number | undefined>;
}> = ({ groove, tool = 'OTHER', quality, extra }) => {
  const text = useMemo(() => buildMidiReport(groove, tool, quality, extra), [groove, tool, quality, extra]);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    const ok = await copyTextReport(text);
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="rounded-2xl border border-sky-500/30 bg-sky-500/5 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <FileText size={14} className="text-sky-400" />
        <span className="text-[10px] font-black uppercase tracking-widest text-sky-300">Build report</span>
        <span className="ml-auto text-[9px] text-white/40" dir="rtl">העתיקו ושלחו לכאן לתיקון</span>
      </div>
      <textarea
        readOnly
        value={text}
        className="w-full h-40 md:h-56 bg-black/70 border border-white/10 rounded-xl p-2 text-[10px] font-mono text-gray-300 leading-relaxed resize-y"
      />
      <div className="flex gap-2">
        <button type="button" onClick={() => void copy()} className="flex-1 py-2 rounded-xl bg-sky-600 text-white text-[10px] font-black uppercase flex items-center justify-center gap-2">
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? 'הועתק' : 'העתיקו דוח'}
        </button>
        <button type="button" onClick={() => downloadTextReport(text, reportFilename(groove))} className="px-3 py-2 rounded-xl bg-white/10 text-white text-[10px] font-black uppercase flex items-center justify-center gap-2">
          <Download size={12} /> TXT
        </button>
      </div>
    </div>
  );
};
