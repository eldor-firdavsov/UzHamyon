'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { AlertCircle, Check, ChevronLeft, ChevronRight, FileSpreadsheet, Loader2, SlidersHorizontal, UploadCloud, X } from 'lucide-react';
import type { ImportPreviewRow, ImportColumnMapping } from '@/lib/imports/schemas';
import { TxListSkeleton } from '@/components/mobile/TxRows';

interface ImportJob {
  id: string;
  filename: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  total_rows: number;
  imported_rows?: number;
  failed_rows?: number;
  skipped_rows?: number;
  success_rows?: number;
  error_rows?: number;
  created_at: string;
}

interface PreviewData {
  jobId?: string;
  filename: string;
  headers: string[];
  mapping?: ImportColumnMapping;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  rows: ImportPreviewRow[];
}

export default function ImportManager() {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showMapping, setShowMapping] = useState(false);
  const [mapping, setMapping] = useState<Partial<ImportColumnMapping>>({});

  const [duplicateStrategy, setDuplicateStrategy] = useState<'skip' | 'import_all'>('skip');
  const [committing, setCommitting] = useState(false);
  const [commitResult, setCommitResult] = useState<{
    insertedCount: number;
    skippedCount: number;
    jobId: string;
  } | null>(null);

  const [jobs, setJobs] = useState<ImportJob[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [jobsReloadTrigger, setJobsReloadTrigger] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let isCancelled = false;

    async function loadJobs() {
      try {
        const res = await fetch('/api/imports/jobs');
        const data = await res.json();
        if (!isCancelled) {
          if (res.ok && data.jobs) {
            setJobs(data.jobs);
          }
          setLoadingJobs(false);
        }
      } catch {
        if (!isCancelled) {
          setLoadingJobs(false);
        }
      }
    }

    loadJobs();

    return () => {
      isCancelled = true;
    };
  }, [jobsReloadTrigger]);

  const refreshJobs = () => {
    setLoadingJobs(true);
    setJobsReloadTrigger((prev) => prev + 1);
  };

  const handleFileSelect = async (fileToProcess?: File, customMapping?: Partial<ImportColumnMapping>) => {
    const file = fileToProcess || selectedFile;
    if (!file) return;

    if (fileToProcess) {
      setSelectedFile(fileToProcess);
    }

    setUploadError(null);
    setCommitResult(null);

    const formData = new FormData();
    formData.append('file', file);
    if (customMapping) {
      formData.append('mapping', JSON.stringify(customMapping));
    }

    setUploading(true);
    try {
      const res = await fetch('/api/imports/preview', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Faylni ko‘rib chiqishda xatolik yuz berdi');
      }
      setPreview(data.preview);
      if (data.preview?.mapping) {
        setMapping(data.preview.mapping);
      }
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : 'Yuklash muvaffaqiyatsiz tugadi');
    } finally {
      setUploading(false);
    }
  };

  const handleCommit = async () => {
    if (!preview) return;
    setCommitting(true);
    setUploadError(null);

    try {
      const validRowsToCommit = preview.rows
        .filter((r) => r.isValid && r.parsed)
        .map((r) => ({
          transaction_date: r.parsed!.transaction_date,
          description: r.parsed!.description,
          amount: r.parsed!.amount,
          currency: r.parsed!.currency,
          type: r.parsed!.type,
          merchant: r.parsed!.merchant || null,
          notes: r.parsed!.notes || null,
        }));

      if (validRowsToCommit.length === 0) {
        throw new Error('Saqlash uchun to‘g‘ri qatorlar topilmadi.');
      }

      const res = await fetch('/api/imports/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId: preview.jobId || undefined,
          filename: preview.filename,
          duplicateStrategy,
          rows: validRowsToCommit,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Ma’lumotlarni saqlashda xatolik yuz berdi');
      }

      const insertedCount = data.result?.importedRows ?? data.result?.insertedCount ?? 0;
      const skippedCount = data.result?.skippedRows ?? data.result?.skippedCount ?? 0;
      const jobId = data.result?.jobId ?? data.result?.job?.id ?? '';

      setCommitResult({
        insertedCount,
        skippedCount,
        jobId,
      });
      refreshJobs();
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : 'Importni tasdiqlashda xatolik');
    } finally {
      setCommitting(false);
    }
  };

  const resetAll = () => {
    setPreview(null);
    setCommitResult(null);
    setUploadError(null);
    setSelectedFile(null);
    setShowMapping(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const fmt = (n: number) => String(Math.round(Math.abs(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const shortDate = (iso: string) => {
    const m = ['yan', 'fev', 'mar', 'apr', 'may', 'iyn', 'iyl', 'avg', 'sen', 'okt', 'noy', 'dek'][Number(iso.slice(5, 7)) - 1];
    return m ? `${Number(iso.slice(8, 10))}-${m}` : iso;
  };
  const toImport = preview ? preview.validRows - (duplicateStrategy === 'skip' ? preview.duplicateRows : 0) : 0;
  const mappingFields: Array<[keyof ImportColumnMapping, string]> = [
    ['dateColumn', 'Sana'],
    ['descriptionColumn', 'Nomi'],
    ['amountColumn', 'Summa'],
    ['typeColumn', 'Turi'],
  ];

  return (
    <div className="uz-page">
      <header className="uz-page-head">
        <Link href="/settings" aria-label="Orqaga" className="uz-page-back">
          <ChevronLeft size={22} />
        </Link>
        <h1>Import</h1>
      </header>

      {/* Done */}
      {commitResult && (
        <div className="uz-imp-done">
          <span className="uz-imp-done-ic"><Check size={40} strokeWidth={3} /></span>
          <div className="uz-imp-done-num">+{commitResult.insertedCount}</div>
          <div className="uz-sh-hint">
            amal qo‘shildi{commitResult.skippedCount > 0 ? ` · ${commitResult.skippedCount} ta takror o‘tkazildi` : ''}
          </div>
          <Link id="view-imported-transactions-link" href="/transactions" className="uz-qa-save" style={{ width: '100%', textDecoration: 'none' }}>
            Faoliyatni ochish
          </Link>
          <button id="import-another-btn" type="button" className="uz-sh-plain" onClick={resetAll}>
            Yana fayl yuklash
          </button>
        </div>
      )}

      {/* Pick a file */}
      {!commitResult && !preview && (
        <>
          <label
            className="uz-imp-drop"
            data-dragging={isDragging}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              const f = e.dataTransfer.files?.[0];
              if (f) void handleFileSelect(f);
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="sr-only"
              disabled={uploading}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFileSelect(f);
              }}
            />
            <span className="uz-imp-drop-ic">
              {uploading ? <Loader2 size={30} className="animate-spin" /> : <UploadCloud size={30} strokeWidth={2.2} />}
            </span>
            <span className="uz-imp-drop-title">{uploading ? 'O‘qilmoqda…' : 'Fayl tanlang'}</span>
            <span className="uz-sh-hint">Bank ko‘chirmasi: CSV yoki Excel</span>
          </label>
          {uploadError && <div className="uz-qa-error" role="alert">{uploadError}</div>}

          <section className="uz-m-section">
            <h2 className="uz-page-sub">Tarix</h2>
            {loadingJobs ? (
              <TxListSkeleton count={2} />
            ) : jobs.length === 0 ? (
              <div className="uz-sh-hint" style={{ textAlign: 'left', padding: '0 4px' }}>Hali import qilinmagan</div>
            ) : (
              <div className="uz-m-list">
                {jobs.map((j) => {
                  const added = j.imported_rows ?? j.success_rows ?? 0;
                  const failed = j.status === 'failed';
                  return (
                    <div key={j.id} className="uz-m-row" style={{ cursor: 'default' }}>
                      <span className="uz-m-row-ic" style={{ background: failed ? '#FDECEA' : '#E5F6DA', color: failed ? '#C62F21' : '#2E6B00' }}>
                        {failed ? <AlertCircle size={20} /> : <FileSpreadsheet size={20} />}
                      </span>
                      <span className="uz-m-row-main">
                        <span className="uz-m-row-name" style={{ fontSize: 15 }}>{j.filename}</span>
                        <span className="uz-m-row-sub">{shortDate(j.created_at.slice(0, 10))}</span>
                      </span>
                      <span className="uz-m-row-amt" data-in={!failed} style={failed ? { color: '#C62F21' } : undefined}>
                        {failed ? 'Xato' : `+${added}`}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}

      {/* Check before importing */}
      {!commitResult && preview && (
        <>
          <div className="uz-imp-sum">
            <div className="uz-imp-sum-file">
              <FileSpreadsheet size={20} aria-hidden="true" />
              <span>{preview.filename}</span>
            </div>
            <div className="uz-imp-stats">
              <span data-kind="ok"><b className="num">{preview.validRows}</b> tayyor</span>
              {preview.duplicateRows > 0 && <span data-kind="dup"><b className="num">{preview.duplicateRows}</b> takror</span>}
              {preview.invalidRows > 0 && <span data-kind="bad"><b className="num">{preview.invalidRows}</b> xato</span>}
            </div>
          </div>

          <div className="uz-m-list">
            {preview.duplicateRows > 0 && (
              <label className="uz-sh-row">
                <span className="uz-sh-row-label">Takrorlarni o‘tkazib yuborish</span>
                <input
                  type="checkbox"
                  role="switch"
                  className="uz-switch"
                  checked={duplicateStrategy === 'skip'}
                  onChange={(e) => setDuplicateStrategy(e.target.checked ? 'skip' : 'import_all')}
                />
              </label>
            )}
            <button type="button" className="uz-m-row" aria-expanded={showMapping} onClick={() => setShowMapping((v) => !v)}>
              <SlidersHorizontal size={20} color="#6B7068" aria-hidden="true" />
              <span className="uz-m-row-main"><span className="uz-m-row-name" style={{ fontSize: 16, fontWeight: 500 }}>Ustunlar</span></span>
              <ChevronRight size={18} color="#AEB4AA" style={{ transform: showMapping ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }} aria-hidden="true" />
            </button>
            {showMapping && (
              <>
                {mappingFields.map(([key, label]) => (
                  <label key={key} className="uz-sh-row">
                    <span className="uz-sh-row-label">{label}</span>
                    <select
                      className="uz-sh-row-date"
                      value={(mapping[key] as string) || ''}
                      onChange={(e) => setMapping((m) => ({ ...m, [key]: e.target.value || undefined }))}
                    >
                      <option value="">—</option>
                      {preview.headers.map((h) => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </label>
                ))}
                <div style={{ padding: '8px 14px 12px' }}>
                  <button type="button" className="uz-page-retry" style={{ width: '100%' }} disabled={uploading} onClick={() => void handleFileSelect(undefined, mapping)}>
                    {uploading ? 'O‘qilmoqda…' : 'Qayta o‘qish'}
                  </button>
                </div>
              </>
            )}
          </div>

          <div className="uz-m-list">
            {preview.rows.slice(0, 30).map((r) => {
              const inc = r.parsed?.type === 'income';
              return (
                <div key={r.rowIndex} className="uz-m-row" style={{ cursor: 'default', opacity: r.isDuplicate && duplicateStrategy === 'skip' ? 0.5 : 1 }}>
                  <span className="uz-m-row-main">
                    <span className="uz-m-row-name" style={{ fontSize: 15 }}>{r.parsed?.description || `Qator ${r.rowIndex + 1}`}</span>
                    <span className="uz-m-row-sub" style={r.errors.length ? { color: '#C62F21' } : undefined}>
                      {r.errors.length ? r.errors[0] : r.isDuplicate ? 'Takror' : r.parsed?.transaction_date ? shortDate(r.parsed.transaction_date) : ''}
                    </span>
                  </span>
                  {r.parsed && (
                    <span className="uz-m-row-amt" data-in={inc}>
                      {inc ? '+' : '−'}{fmt(r.parsed.amount)}{r.parsed.currency && r.parsed.currency !== 'UZS' ? ` ${r.parsed.currency}` : ''}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          {preview.rows.length > 30 && <div className="uz-sh-hint">va yana {preview.rows.length - 30} qator</div>}
          {uploadError && <div className="uz-qa-error" role="alert">{uploadError}</div>}

          <div className="uz-imp-foot">
            <button type="button" className="uz-qa-round" aria-label="Bekor qilish" onClick={resetAll} disabled={committing}>
              <X size={20} strokeWidth={2.2} />
            </button>
            <button type="button" className="uz-qa-save" style={{ flex: 1 }} disabled={committing || toImport <= 0} onClick={handleCommit}>
              {committing ? 'Import qilinmoqda…' : `${toImport} ta amalni qo‘shish`}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
