import React from 'react';
import { QualityReport } from '../services/qualityGateService';
import { ShieldCheck, AlertTriangle } from 'lucide-react';

export const QualityReportCard: React.FC<{ report: QualityReport; compact?: boolean }> = ({ report, compact }) => {
  const color = report.passed ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' : 'text-amber-300 border-amber-500/30 bg-amber-500/10';
  return (
    <div className={`rounded-2xl border p-3 ${color}`}>
      <div className="flex items-center gap-2 mb-2">
        {report.passed ? <ShieldCheck size={16} /> : <AlertTriangle size={16} />}
        <span className="text-[10px] font-black uppercase tracking-widest">Quality {report.score}/100</span>
        <span className="ml-auto text-[9px] font-bold uppercase opacity-70">{report.passed ? 'Pass' : 'Needs review'}</span>
      </div>
      {!compact && (
        <div className="space-y-1">
          {report.checks.map((c) => (
            <div key={c.id} className="flex items-start gap-2 text-[10px]">
              <span className={c.passed ? 'text-emerald-400' : c.severity === 'fail' ? 'text-red-400' : 'text-amber-300'}>{c.passed ? '✓' : '!'}</span>
              <span className="text-white/80 font-bold">{c.label}</span>
              <span className="text-white/40 ml-auto text-right">{c.detail}</span>
            </div>
          ))}
          {report.healed.length > 0 && (
            <div className="pt-2 text-[9px] text-white/50 uppercase tracking-wide">
              Auto-fixed: {report.healed.join(' · ')}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
