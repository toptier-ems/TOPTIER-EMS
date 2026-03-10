import { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { Accomplishment, PdCertificate, PdEvent, Profile } from '../types/database';
import { format } from 'date-fns';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { ArrowLeft, Download } from 'lucide-react';

const CERTIFICATE_LOGO_SRC = '/certificate-logo.png';

type CertificateData = {
  certificate: PdCertificate;
  accomplishment: Accomplishment;
  recipient: Profile | null;
  event: PdEvent | null;
  issuer: Profile | null;
};

export default function CertificatePage() {
  const { id } = useParams<{ id: string }>();
  const certificateRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<CertificateData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    (async () => {
      const { data: cert, error: certErr } = await supabase
        .from('pd_certificates')
        .select('*')
        .eq('id', id)
        .single();
      if (certErr || !cert) {
        setError('Certificate not found');
        setLoading(false);
        return;
      }
      const accId = (cert as PdCertificate).accomplishment_id;
      const { data: acc } = await supabase.from('accomplishments').select('*').eq('id', accId).single();
      if (!acc) {
        setError('Accomplishment not found');
        setLoading(false);
        return;
      }
      const [recipientRes, eventRes, issuerRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', (acc as Accomplishment).user_id).single(),
        (acc as Accomplishment).pd_event_id
          ? supabase.from('pd_events').select('*').eq('id', (acc as Accomplishment).pd_event_id!).single()
          : { data: null },
        supabase.from('profiles').select('*').eq('id', (cert as PdCertificate).issued_by).single(),
      ]);
      setData({
        certificate: cert as PdCertificate,
        accomplishment: acc as Accomplishment,
        recipient: recipientRes.data as Profile | null,
        event: eventRes.data as PdEvent | null,
        issuer: issuerRes.data as Profile | null,
      });
      setLoading(false);
    })();
  }, [id]);

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-500">Loading...</div>;
  if (error || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6">
        <p className="text-gray-600">{error || 'Certificate not found'}</p>
        <Link to="/profile" className="mt-4 text-toptier-primary hover:underline flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> Back to profile
        </Link>
      </div>
    );
  }

  const { certificate, accomplishment, recipient, event, issuer } = data;
  const recipientName = recipient?.full_name ?? 'Participant';
  const title = event?.title ?? accomplishment.title;
  const completedDate = accomplishment.achieved_at ? format(new Date(accomplishment.achieved_at), 'do MMMM yyyy') : '—';
  const issuerName = issuer?.full_name ?? 'Toptier Digital Solutions';
  const issuerTitle = issuer?.position ? (issuer.position === 'ceo' ? 'CEO' : issuer.position.charAt(0).toUpperCase() + issuer.position.slice(1)) : 'Director';

  const downloadPDF = async () => {
    if (!certificateRef.current) return;
    setDownloading(true);
    try {
      const canvas = await html2canvas(certificateRef.current, {
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
      const safeName = recipientName.replace(/\s+/g, '_').replace(/[^\w\-]/g, '');
      pdf.save(`Certificate_${title.replace(/\s+/g, '_').slice(0, 30)}_${safeName}.pdf`);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between gap-4 mb-4">
          <Link to="/profile" className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-toptier-primary">
            <ArrowLeft className="w-4 h-4" /> Back to profile
          </Link>
          <button
            type="button"
            onClick={downloadPDF}
            disabled={downloading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-toptier-primary text-white text-sm font-medium hover:bg-toptier-primary-hover disabled:opacity-50"
          >
            <Download className="w-4 h-4" /> {downloading ? 'Preparing...' : 'Download PDF'}
          </button>
        </div>

        {/* Certificate - PSM-style layout (ref for PDF capture) */}
        <div
          ref={certificateRef}
          className="bg-white rounded-lg shadow-lg overflow-hidden border-2 border-amber-600"
          style={{ borderWidth: '4px' }}
        >
          <div className="border-4 border-blue-900/90 m-2 rounded">
            {/* Logo */}
            <div className="flex justify-center pt-6 pb-2">
              <img src={CERTIFICATE_LOGO_SRC} alt="Toptier Digital Solutions" className="h-16 w-auto object-contain" />
            </div>
            {/* Left ribbon accent */}
            <div className="relative">
              <div className="absolute left-0 top-0 bottom-0 w-16 bg-blue-900/90 rounded-r-lg" style={{ width: '56px' }} />
              <div className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full border-4 border-amber-500 bg-amber-50 flex items-center justify-center">
                <span className="text-[8px] font-semibold text-center leading-tight text-gray-700">Certificate Completion</span>
              </div>
            </div>

            <div className="pl-20 pr-6 py-8">
              <h1 className="text-2xl font-bold text-center uppercase tracking-wide text-gray-900 mt-2">
                Certificate of Completion
              </h1>
              <p className="text-center text-gray-700 mt-4">This is to certify that</p>
              <p className="text-center text-xl font-bold text-green-700 uppercase mt-2">{recipientName}</p>
              <p className="text-center text-gray-700 mt-4">
                has successfully completed the <strong>{title}</strong>
                {event?.category && ` (${event.category})`} offered by Toptier Digital Solutions on {completedDate}.
              </p>

              <div className="mt-8 flex justify-between items-end text-sm text-gray-600">
                <div>
                  <p className="font-mono text-gray-400">{certificate.certificate_number}</p>
                  <p className="font-medium text-gray-700 mt-1">Certificate No.</p>
                </div>
                <div className="text-right">
                  <p className="font-medium text-gray-900">{issuerName}</p>
                  <p className="text-gray-600">Designation — {issuerTitle}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-gray-500 mt-4">Toptier Digital Solutions · Professional Development</p>
      </div>
    </div>
  );
}
