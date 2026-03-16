import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FinanceHubShell } from '@/components/finance/FinanceHubShell';

type ViewMode = 'engine' | 'results';

type DocumentCategory = 'invoice' | 'quote' | 'contract' | 'receipt' | 'w9';

interface DocItem {
  id: string;
  category: DocumentCategory;
  title: string;
  subtitle: string;
  date: string;
  amount?: string;
  thumbnail?: string;
}

const SAMPLE_DOCS: DocItem[] = [
  { id: 'inv-001', category: 'invoice', title: 'Invoice #1042', subtitle: 'Meridian HVAC Services', date: 'Mar 12, 2026', amount: '$4,800.00' },
  { id: 'inv-002', category: 'invoice', title: 'Invoice #1039', subtitle: 'Northside Electric', date: 'Mar 8, 2026', amount: '$2,350.00' },
  { id: 'inv-003', category: 'invoice', title: 'Invoice #1036', subtitle: 'Summit Roofing LLC', date: 'Feb 28, 2026', amount: '$11,200.00' },
  { id: 'q-001', category: 'quote', title: 'Quote #Q-214', subtitle: 'Riverside Renovation', date: 'Mar 10, 2026', amount: '$8,500.00' },
  { id: 'q-002', category: 'quote', title: 'Quote #Q-211', subtitle: 'Pacific Landscaping', date: 'Mar 2, 2026', amount: '$3,100.00' },
  { id: 'c-001', category: 'contract', title: 'HVAC Service Agreement', subtitle: 'Meridian HVAC', date: 'Jan 15, 2026', thumbnail: '/templates/HVAC_Proposal_Template_1773625890200.png' },
  { id: 'c-002', category: 'contract', title: 'Roofing Proposal', subtitle: 'Summit Roofing LLC', date: 'Feb 1, 2026', thumbnail: '/templates/Roofing_Proposal_Template_1773625895695.png' },
  { id: 'c-003', category: 'contract', title: 'NDA Agreement', subtitle: 'General Use', date: 'Dec 10, 2025', thumbnail: '/templates/Non_Disclosure_Agreement_Template_1773625901864.png' },
  { id: 'c-004', category: 'contract', title: 'Construction Proposal', subtitle: 'Northside Build Co.', date: 'Nov 20, 2025', thumbnail: '/templates/Construction_Proposal_Template_1773625915308.png' },
  { id: 'c-005', category: 'contract', title: 'Contractor SOW', subtitle: 'Pacific Contractor Group', date: 'Oct 5, 2025', thumbnail: '/templates/Contractor_Scope_of_Work_Template_1773625920697.png' },
  { id: 'w9-001', category: 'w9', title: 'W-9 Form (2024)', subtitle: 'Business Tax ID', date: 'Jan 1, 2025', thumbnail: '/templates/W9_Form_2024_1773625929021.png' },
];

const CATEGORIES: { key: string; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'all', label: 'All', icon: 'grid-outline' },
  { key: 'invoice', label: 'Invoices', icon: 'document-text-outline' },
  { key: 'quote', label: 'Quotes', icon: 'pricetag-outline' },
  { key: 'contract', label: 'Contracts', icon: 'briefcase-outline' },
  { key: 'w9', label: 'Tax Forms', icon: 'shield-checkmark-outline' },
];

function InvoiceThumbnail({ category }: { category: DocumentCategory }) {
  if (Platform.OS !== 'web') return null;
  const isQuote = category === 'quote';
  const accent = isQuote ? '#818CF8' : '#3B82F6';
  const label = isQuote ? 'QUOTE' : 'INVOICE';
  return (
    <div style={{
      width: '100%',
      height: '100%',
      backgroundColor: '#ffffff',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      <div style={{
        height: 40,
        background: `linear-gradient(135deg, ${accent} 0%, ${isQuote ? '#6366F1' : '#2563EB'} 100%)`,
        display: 'flex',
        alignItems: 'center',
        paddingLeft: 12,
        paddingRight: 12,
        justifyContent: 'space-between',
      }}>
        <span style={{ color: '#fff', fontSize: 10, fontWeight: 800, letterSpacing: 1.5 }}>{label}</span>
        <div style={{ width: 24, height: 24, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ color: '#fff', fontSize: 8, fontWeight: 700 }}>A</span>
        </div>
      </div>
      <div style={{ padding: '10px 12px', flex: 1 }}>
        <div style={{ height: 6, width: '80%', backgroundColor: '#E5E7EB', borderRadius: 3, marginBottom: 6 }} />
        <div style={{ height: 4, width: '55%', backgroundColor: '#F3F4F6', borderRadius: 2, marginBottom: 12 }} />
        <div style={{ height: 1, backgroundColor: '#E5E7EB', marginBottom: 8 }} />
        {[1, 2, 3].map(i => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
            <div style={{ height: 4, width: '50%', backgroundColor: '#F3F4F6', borderRadius: 2 }} />
            <div style={{ height: 4, width: '20%', backgroundColor: '#E5E7EB', borderRadius: 2 }} />
          </div>
        ))}
        <div style={{ height: 1, backgroundColor: '#E5E7EB', marginTop: 8, marginBottom: 6 }} />
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ height: 5, width: '30%', backgroundColor: accent, borderRadius: 2, opacity: 0.7 }} />
        </div>
      </div>
    </div>
  );
}

function DocCard({ doc, onOpen }: { doc: DocItem; onOpen?: (doc: DocItem) => void }) {
  const [hovered, setHovered] = useState(false);
  const hasImage = !!doc.thumbnail;
  const categoryColor = doc.category === 'invoice' ? '#3B82F6'
    : doc.category === 'quote' ? '#818CF8'
    : doc.category === 'contract' ? '#10B981'
    : doc.category === 'w9' ? '#F59E0B'
    : '#888';

  if (Platform.OS !== 'web') {
    return (
      <Pressable onPress={() => onOpen?.(doc)}>
        <View style={{ backgroundColor: '#1C1C1E', borderRadius: 12, padding: 16, marginBottom: 12 }}>
          <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>{doc.title}</Text>
          <Text style={{ color: '#888', fontSize: 12, marginTop: 4 }}>{doc.subtitle}</Text>
        </View>
      </Pressable>
    );
  }

  return (
    <div
      onClick={() => onOpen?.(doc)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        borderRadius: 14,
        border: `1px solid ${hovered ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.07)'}`,
        backgroundColor: hovered ? '#1F1F25' : '#161618',
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        transform: hovered ? 'translateY(-2px)' : 'none',
        boxShadow: hovered ? '0 8px 24px rgba(0,0,0,0.35)' : '0 2px 8px rgba(0,0,0,0.2)',
      }}
    >
      <div style={{
        height: 148,
        overflow: 'hidden',
        backgroundColor: '#0A0A0F',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative' as const,
      }}>
        {hasImage ? (
          <img
            src={doc.thumbnail}
            alt={doc.title}
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
        ) : (
          <InvoiceThumbnail category={doc.category} />
        )}
        <div style={{
          position: 'absolute' as const,
          top: 8,
          left: 8,
          padding: '3px 8px',
          borderRadius: 6,
          backgroundColor: `${categoryColor}22`,
          border: `1px solid ${categoryColor}40`,
          fontSize: 9,
          fontWeight: 700,
          color: categoryColor,
          letterSpacing: 0.8,
          textTransform: 'uppercase' as const,
        }}>
          {doc.category === 'w9' ? 'Tax Form' : doc.category}
        </div>
      </div>
      <div style={{ padding: '12px 14px 14px' }}>
        <div style={{
          fontSize: 13,
          fontWeight: 600,
          color: '#ffffff',
          marginBottom: 3,
          whiteSpace: 'nowrap' as const,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>{doc.title}</div>
        <div style={{
          fontSize: 11,
          color: 'rgba(255,255,255,0.38)',
          marginBottom: 8,
          whiteSpace: 'nowrap' as const,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>{doc.subtitle}</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)', fontWeight: 400 }}>{doc.date}</span>
          {doc.amount && (
            <span style={{ fontSize: 12, fontWeight: 700, color: categoryColor }}>{doc.amount}</span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function FinanceMemoryPage() {
  const [view, setView] = useState<ViewMode>('engine');
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const styleId = 'finance-memory-styles';
    if (!document.getElementById(styleId)) {
      const el = document.createElement('style');
      el.id = styleId;
      el.textContent = `
        @keyframes memoryBorderRotate {
          0%   { background-position: 0% 50%; }
          50%  { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .memory-search-wrapper {
          position: relative;
          max-width: 520px;
          width: 100%;
        }
        .memory-search-wrapper::before {
          content: '';
          position: absolute;
          inset: -1.5px;
          border-radius: 9999px;
          padding: 1.5px;
          background: linear-gradient(90deg, #ffaa40, #9c40ff, #ffaa40);
          background-size: 200% 200%;
          animation: memoryBorderRotate 3s linear infinite;
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          pointer-events: none;
        }
        .memory-search-input {
          width: 100%;
          height: 52px;
          background: #111116;
          border: none;
          border-radius: 9999px;
          padding: 0 22px;
          font-size: 15px;
          color: #ffffff;
          outline: none;
          box-sizing: border-box;
          letter-spacing: -0.1px;
        }
        .memory-search-input::placeholder {
          color: rgba(255,255,255,0.3);
        }
        .memory-search-input:focus {
          box-shadow: 0 0 0 1px rgba(156,64,255,0.3);
        }
        .memory-category-pill {
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 6px 14px;
          border-radius: 20px;
          border: 1px solid rgba(255,255,255,0.08);
          background: transparent;
          color: rgba(255,255,255,0.45);
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.18s ease;
          white-space: nowrap;
        }
        .memory-category-pill:hover {
          background: rgba(255,255,255,0.06);
          color: rgba(255,255,255,0.7);
        }
        .memory-category-pill.active {
          background: rgba(255,255,255,0.10);
          border-color: rgba(255,255,255,0.18);
          color: #ffffff;
          font-weight: 600;
        }
        .memory-doc-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
          gap: 14px;
        }
      `;
      document.head.appendChild(el);
    }

    const scriptId = 'finn-anam-convai';
    if (!document.getElementById(scriptId)) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://elevenlabs.io/convai-widget/index.js';
      script.async = true;
      document.body.appendChild(script);
    }

    return () => {
      const el = document.getElementById(styleId);
      if (el) el.remove();
    };
  }, []);

  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      setView('results');
    }
  }, [query]);

  const filteredDocs = SAMPLE_DOCS.filter(doc => {
    const matchCat = activeCategory === 'all' || doc.category === activeCategory;
    const matchQuery = !query.trim() || doc.title.toLowerCase().includes(query.toLowerCase()) || doc.subtitle.toLowerCase().includes(query.toLowerCase());
    return matchCat && matchQuery;
  });

  if (Platform.OS !== 'web') {
    return (
      <FinanceHubShell>
        <View style={{ padding: 20 }}>
          <Text style={{ color: '#fff', fontSize: 22, fontWeight: '800', marginBottom: 8 }}>Finance Memory</Text>
          <Text style={{ color: '#888', fontSize: 14 }}>Search your financial documents</Text>
        </View>
      </FinanceHubShell>
    );
  }

  return (
    <FinanceHubShell>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '0 4px', minHeight: 0 }}>
        {/* ── TOP BAR ── */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: view === 'engine' ? 0 : 20,
          paddingBottom: view === 'engine' ? 0 : 16,
          borderBottom: view === 'results' ? '1px solid rgba(255,255,255,0.06)' : 'none',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {view === 'results' && (
              <button
                onClick={() => { setView('engine'); setQuery(''); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 10,
                  padding: '6px 12px',
                  color: 'rgba(255,255,255,0.6)',
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.09)'; e.currentTarget.style.color = '#fff'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'rgba(255,255,255,0.6)'; }}
              >
                <Ionicons name="arrow-back" size={13} color="currentColor" />
                Back
              </button>
            )}
            <div>
              <span style={{
                fontSize: 22,
                fontWeight: 800,
                color: '#ffffff',
                letterSpacing: '-0.4px',
              }}>Finance Memory</span>
            </div>
          </div>

          {view === 'results' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>
                {filteredDocs.length} document{filteredDocs.length !== 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>

        {/* ── ENGINE VIEW ── */}
        {view === 'engine' && (
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 32,
            paddingTop: 20,
            paddingBottom: 40,
          }}>
            {/* Finn orb video */}
            <div style={{
              width: 160,
              height: 160,
              borderRadius: '50%',
              overflow: 'hidden',
              border: '1px solid rgba(167,139,250,0.25)',
              boxShadow: '0 0 40px rgba(167,139,250,0.15), 0 0 80px rgba(139,92,246,0.08)',
              position: 'relative' as const,
            }}>
              <video
                src="/finn-orb.mp4"
                autoPlay
                loop
                muted
                playsInline
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>

            <div style={{ textAlign: 'center' as const }}>
              <div style={{
                fontSize: 30,
                fontWeight: 800,
                color: '#ffffff',
                letterSpacing: '-0.6px',
                marginBottom: 8,
                lineHeight: 1.1,
              }}>
                What would you like to find?
              </div>
              <div style={{
                fontSize: 14,
                color: 'rgba(255,255,255,0.38)',
                fontWeight: 400,
                lineHeight: 1.5,
              }}>
                Search invoices, contracts, tax forms, and more — Finn remembers everything.
              </div>
            </div>

            {/* Gradient pill search bar */}
            <form
              onSubmit={handleSearch}
              style={{ width: '100%', display: 'flex', justifyContent: 'center' }}
            >
              <div className="memory-search-wrapper">
                <input
                  ref={inputRef}
                  className="memory-search-input"
                  placeholder="Search by name, type, date, amount..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(e); }}
                />
              </div>
            </form>

            {/* Quick category pills */}
            <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 8, justifyContent: 'center', maxWidth: 560 }}>
              {CATEGORIES.map(cat => (
                <button
                  key={cat.key}
                  className={`memory-category-pill${activeCategory === cat.key ? ' active' : ''}`}
                  onClick={() => {
                    setActiveCategory(cat.key);
                    setView('results');
                  }}
                >
                  <Ionicons name={cat.icon} size={12} color="currentColor" />
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Finn Anam floating widget */}
            {/* @ts-ignore */}
            <elevenlabs-convai agent-id="e98e22fb-9c6e-4f83-ae75-09556815a6bf" style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 200 }} />
          </div>
        )}

        {/* ── RESULTS VIEW ── */}
        {view === 'results' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16, minHeight: 0 }}>
            {/* Search bar + category filter row */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              alignItems: 'flex-start',
            }}>
              <form onSubmit={handleSearch} style={{ width: '100%' }}>
                <div className="memory-search-wrapper" style={{ maxWidth: '100%' }}>
                  <input
                    className="memory-search-input"
                    placeholder="Search by name, type, date, amount..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>
              </form>
              <div style={{ display: 'flex', gap: 6, overflowX: 'auto' as const, paddingBottom: 4, width: '100%' }}>
                {CATEGORIES.map(cat => (
                  <button
                    key={cat.key}
                    className={`memory-category-pill${activeCategory === cat.key ? ' active' : ''}`}
                    onClick={() => setActiveCategory(cat.key)}
                  >
                    <Ionicons name={cat.icon} size={11} color="currentColor" />
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Document grid */}
            <div style={{ flex: 1, overflow: 'auto' as const }}>
              {filteredDocs.length === 0 ? (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 12,
                  paddingTop: 60,
                }}>
                  <Ionicons name="search-outline" size={36} color="rgba(255,255,255,0.2)" />
                  <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 15, fontWeight: 600 }}>No documents found</div>
                  <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: 13 }}>Try a different search or category</div>
                </div>
              ) : (
                <div className="memory-doc-grid">
                  {filteredDocs.map(doc => (
                    <DocCard key={doc.id} doc={doc} />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </FinanceHubShell>
  );
}
