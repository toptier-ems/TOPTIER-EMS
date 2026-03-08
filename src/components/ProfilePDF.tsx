import { useRef } from 'react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { Download } from 'lucide-react';
import type { Profile } from '../types/database';
import type { Accomplishment } from '../types/database';
import { POSITION_LABELS } from '../types/database';
import { format, parseISO } from 'date-fns';

function formatExperienceDates(a: Accomplishment): string {
  const start = a.start_date ? format(parseISO(a.start_date), 'MMM yyyy') : null;
  const end = a.is_current_role === true ? 'Present' : (a.end_date ? format(parseISO(a.end_date), 'MMM yyyy') : null);
  if (start && end) return `${start} – ${end}`;
  if (start) return start;
  if (a.achieved_at) return format(parseISO(a.achieved_at), 'MMM d, yyyy');
  return '';
}

interface Props {
  profile: Profile;
  accomplishments: Accomplishment[];
}

export default function ProfilePDF({ profile, accomplishments }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);

  const downloadPDF = async () => {
    if (!cardRef.current) return;
    const canvas = await html2canvas(cardRef.current, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
    });
    const img = canvas.toDataURL('image/jpeg', 0.92);
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = 15;
    const contentW = pageW - margin * 2;
    const imgH = (canvas.height * contentW) / canvas.width;
    pdf.addImage(img, 'JPEG', margin, margin, contentW, Math.min(imgH, pageH - margin * 2));
    if (imgH > pageH - margin * 2) {
      pdf.addPage();
      pdf.addImage(img, 'JPEG', margin, margin - (pageH - margin * 2), contentW, imgH);
    }
    pdf.save(`${profile.full_name.replace(/\s+/g, '_')}_profile.pdf`);
  };

  return (
    <>
      <button
        type="button"
        onClick={downloadPDF}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-toptier-primary text-white text-sm font-medium hover:bg-toptier-primary-hover"
      >
        <Download className="w-4 h-4" /> Download profile as PDF
      </button>
      <div
        ref={cardRef}
        className="p-6 bg-white rounded-xl border border-gray-200 text-left max-w-2xl mx-auto"
        style={{ boxSizing: 'border-box' }}
      >
        <div className="flex items-start gap-4 mb-6">
          {profile.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt=""
              className="w-24 h-24 rounded-full object-cover border-2 border-gray-200"
            />
          ) : (
            <div className="w-24 h-24 rounded-full bg-gray-200 border-2 border-gray-200" />
          )}
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{profile.full_name}</h1>
            <p className="text-toptier-muted">{POSITION_LABELS[profile.position]}</p>
            <p className="text-gray-600 text-sm">{profile.email}</p>
            {profile.bio && <p className="text-gray-600 mt-2 max-w-xl">{profile.bio}</p>}
          </div>
        </div>
        <h2 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2 mb-3">Accomplishments</h2>
        {accomplishments.length === 0 ? (
          <p className="text-gray-600">No experience listed.</p>
        ) : (
          <ul className="space-y-3">
            {accomplishments.map((a) => (
              <li key={a.id} className="text-gray-700">
                <p className="font-medium text-gray-900">
                  {a.title}
                  {a.company ? ` at ${a.company}` : ''}
                </p>
                {a.employment_type && <p className="text-sm text-gray-600">{a.employment_type}</p>}
                {a.description && <p className="text-sm">{a.description}</p>}
                <p className="text-xs text-toptier-muted">
                  {formatExperienceDates(a)}
                  {a.location ? ` · ${a.location}` : ''}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
