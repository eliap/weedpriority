import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import html2pdf from 'html2pdf.js';
import { valueCategories } from '../data/valuesData';
import { invasivenessCategories } from '../data/invasivenessData';
import governmentData from '../data/realGovernmentData.json';
import weedProfiles from '../data/weedProfiles.json';

const RATING_VALUES = { "L": 1, "ML": 2, "M": 3, "MH": 4, "H": 5 };
const CONFIDENCE_VALUES = { "L": 0.2, "ML": 0.4, "M": 0.6, "MH": 0.8, "H": 1.0 };

const calculateCategoryScore = (items, userReviews, govReviews, selectedIds = null) => {
    let totalScore = 0, maxPossibleScore = 0, itemsWithData = 0;
    items.forEach(item => {
        if (selectedIds && !selectedIds[item.id]) return;
        const govItem = govReviews[item.id] || {};
        const userItem = userReviews[item.id] || {};
        const finalRatingStr = userItem.rating || govItem.rating;
        const finalConfStr = userItem.confidence || govItem.confidence;
        if (finalRatingStr) {
            const ratingVal = RATING_VALUES[finalRatingStr] || 0;
            const confVal = CONFIDENCE_VALUES[finalConfStr] || 0.5;
            totalScore += (ratingVal * confVal);
            maxPossibleScore += 5;
            itemsWithData++;
        }
    });
    return {
        scaled: maxPossibleScore > 0 ? (totalScore / maxPossibleScore) * 100 : 0,
        hasData: itemsWithData > 0
    };
};

// Fetch up to 3 photos from iNaturalist
async function fetchINatPhotos(scientificName) {
    try {
        const res = await fetch(`https://api.inaturalist.org/v1/taxa?q=${encodeURIComponent(scientificName)}&per_page=1`);
        const data = await res.json();
        if (data.results && data.results.length > 0) {
            const taxon = data.results[0];
            const photos = [];
            const seenUrls = new Set();
            if (taxon.default_photo) {
                const url = taxon.default_photo.medium_url || taxon.default_photo.url;
                photos.push({ url, attribution: taxon.default_photo.attribution || 'iNaturalist' });
                seenUrls.add(url);
            }
            if (taxon.id && photos.length < 3) {
                try {
                    const obsRes = await fetch(`https://api.inaturalist.org/v1/observations?taxon_id=${taxon.id}&photos=true&per_page=10&order_by=votes`);
                    const obsData = await obsRes.json();
                    if (obsData.results) {
                        for (const obs of obsData.results) {
                            if (photos.length >= 3) break;
                            if (obs.photos && obs.photos.length > 0) {
                                const p = obs.photos[0];
                                const url = p.url?.replace('square', 'medium');
                                if (url && !seenUrls.has(url)) {
                                    photos.push({ url, attribution: p.attribution || 'iNaturalist' });
                                    seenUrls.add(url);
                                }
                            }
                        }
                    }
                } catch (e) { /* extra photos optional */ }
            }
            return photos.length > 0 ? photos : null;
        }
    } catch (e) {
        console.warn('Failed to fetch iNaturalist photos for', scientificName, e);
    }
    return null;
}

// Teal palette matching the Halls Gap brochure
const TEAL_BG = '#1a6b6a';
const TEAL_DARK = '#145453';
const TEAL_HEADER = '#0e4847';
const CARD_BG = '#f8fffe';

export default function BrochureFlier({ weeds, selectedValues }) {
    const navigate = useNavigate();
    const brochureRef = useRef(null);
    const [photos, setPhotos] = useState({});
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);

    const scoredWeeds = useMemo(() => {
        const weights = { extent: 20, impact: 20, invasiveness: 20, habitat: 20, control: 20 };
        return weeds.map(weed => {
            const govWeedData = governmentData[weed.name] || { impact: {}, invasiveness: {} };
            const userReview = weed.scientificReview?.detailed || { impact: {}, invasiveness: {} };
            const allImpactItems = valueCategories.flatMap(cat => cat.items);
            const impactResult = calculateCategoryScore(allImpactItems, userReview.impact || {}, govWeedData.impact || {}, selectedValues);
            const allInvItems = invasivenessCategories.flatMap(cat => cat.items);
            const invasivenessResult = calculateCategoryScore(allInvItems, userReview.invasiveness || {}, govWeedData.invasiveness || {});
            const extentScore = (Number(weed.extent) || 1) * 20;
            const habitatScore = (Number(weed.habitat) || 1) === 2 ? 100 : 50;
            const controlScore = (weed.controlLevel || 2) * 25;
            const criteria = [
                { key: 'extent', score: extentScore, hasData: true },
                { key: 'impact', score: impactResult.scaled, hasData: impactResult.hasData },
                { key: 'invasiveness', score: invasivenessResult.scaled, hasData: invasivenessResult.hasData },
                { key: 'habitat', score: habitatScore, hasData: true },
                { key: 'control', score: controlScore, hasData: true }
            ];
            const active = criteria.filter(c => c.hasData);
            const activeWeight = active.reduce((s, c) => s + weights[c.key], 0);
            const norm = activeWeight > 0 ? activeWeight / 100 : 1;
            const finalScore = active.reduce((s, c) => s + (c.score * weights[c.key] / 100), 0) / norm;
            return { ...weed, finalScore };
        }).sort((a, b) => b.finalScore - a.finalScore);
    }, [weeds, selectedValues]);

    const topWeeds = scoredWeeds.slice(0, 8);
    const page1 = topWeeds.slice(0, 4);
    const page2 = topWeeds.slice(4, 8);

    useEffect(() => {
        let cancelled = false;
        async function loadPhotos() {
            setLoading(true);
            const photoMap = {};
            for (const weed of topWeeds) {
                const profile = weedProfiles[weed.name];
                if (profile?.scientificName) {
                    const result = await fetchINatPhotos(profile.scientificName);
                    if (!cancelled && result) photoMap[weed.name] = result;
                }
            }
            if (!cancelled) { setPhotos(photoMap); setLoading(false); }
        }
        loadPhotos();
        return () => { cancelled = true; };
    }, [topWeeds.map(w => w.name).join(',')]);

    const handleExportPDF = async () => {
        setGenerating(true);
        const opt = {
            margin: 0,
            filename: 'weed-priority-brochure.pdf',
            image: { type: 'jpeg', quality: 0.95 },
            html2canvas: { scale: 2, useCORS: true, allowTaint: true },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
            pagebreak: { mode: ['css', 'legacy'] }
        };
        try {
            await html2pdf().set(opt).from(brochureRef.current).save();
        } catch (e) {
            console.error('PDF generation failed:', e);
            alert('PDF generation failed. Try using Print instead.');
        }
        setGenerating(false);
    };

    /* ── Individual weed card ── */
    const WeedCard = ({ weed }) => {
        const profile = weedProfiles[weed.name] || {};
        const weedPhotos = photos[weed.name] || [];



        return (
            <div style={{
                background: CARD_BG,
                borderRadius: '6px',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                height: '100%'
            }}>
                {/* Name header bar */}
                <div style={{
                    background: TEAL_HEADER,
                    padding: '8px 12px',
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: '6px'
                }}>
                    <span style={{
                        fontSize: '22px', fontWeight: 800, color: 'white', lineHeight: 1.2
                    }}>{weed.name}</span>
                    {profile.scientificName && (
                        <span style={{
                            fontSize: '16px', fontStyle: 'italic', color: 'rgba(255,255,255,0.7)'
                        }}>({profile.scientificName})</span>
                    )}
                </div>

                {/* Photo grid — 1 large + 2 smaller, takes 2/3 of height */}
                <div style={{
                    display: 'flex', gap: '2px', padding: '2px',
                    background: TEAL_HEADER, flex: 2, overflow: 'hidden'
                }}>
                    {/* Main photo */}
                    <div style={{ flex: '1 1 58%', position: 'relative' }}>
                        {weedPhotos[0] ? (
                            <img
                                src={weedPhotos[0].url}
                                alt={weed.name}
                                crossOrigin="anonymous"
                                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', borderRadius: '2px' }}
                            />
                        ) : (
                            <div style={{
                                width: '100%', height: '100%', background: '#334155',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: '#64748b', fontSize: '13px', borderRadius: '2px'
                            }}>No photo</div>
                        )}
                    </div>
                    {/* Two stacked smaller photos */}
                    <div style={{ flex: '0 0 40%', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        {[1, 2].map(i => (
                            <div key={i} style={{ flex: 1, position: 'relative' }}>
                                {weedPhotos[i] ? (
                                    <img
                                        src={weedPhotos[i].url}
                                        alt={`${weed.name} ${i + 1}`}
                                        crossOrigin="anonymous"
                                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', borderRadius: '2px', position: 'absolute', top: 0, left: 0 }}
                                    />
                                ) : (
                                    <div style={{
                                        width: '100%', height: '100%', background: '#475569',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        color: '#64748b', fontSize: '16px', borderRadius: '2px'
                                    }}>🌿</div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Description text — fills remaining space */}
                <div style={{
                    padding: '8px 12px 6px',
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between'
                }}>
                    {/* Structured details grid */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'max-content 1fr',
                        columnGap: '10px',
                        rowGap: '2px',
                        fontSize: '13px',
                        lineHeight: '1.35',
                        color: '#334155'
                    }}>
                        {/* Row 1: Form */}
                        <div style={{ fontWeight: 700, color: '#0f766e', textAlign: 'right' }}>Form:</div>
                        <div>{profile.growthForm || '—'}</div>

                        {/* Row 2: Size */}
                        <div style={{ fontWeight: 700, color: '#0f766e', textAlign: 'right' }}>Size:</div>
                        <div>{profile.size || '—'}</div>

                        {/* Row 2: Origin */}
                        <div style={{ fontWeight: 700, color: '#0f766e', textAlign: 'right' }}>Origin:</div>
                        <div>{profile.origin || '—'}</div>

                        {/* Row 3: Flowers */}
                        <div style={{ fontWeight: 700, color: '#0f766e', textAlign: 'right' }}>Flowers:</div>
                        <div>{profile.flowerColour || '—'}</div>

                        {/* Row 4: Control */}
                        <div style={{ fontWeight: 700, color: '#b91c1c', textAlign: 'right' }}>Control:</div>
                        <div style={{ fontWeight: 500 }}>{profile.controlMethods || 'Contact Landcare'}</div>

                        {/* Row 5: Season */}
                        <div style={{ fontWeight: 700, color: '#b91c1c', textAlign: 'right' }}>Season:</div>
                        <div style={{ fontWeight: 500 }}>{profile.bestControlSeason || '—'}</div>
                    </div>
                </div>
            </div>
        );
    };

    /* ── Page layout ── */
    const PageContent = ({ weedsList, pageNum, totalPages }) => (
        <div style={{
            width: '210mm',
            height: '297mm',
            boxSizing: 'border-box',
            background: TEAL_BG,
            fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
            pageBreakAfter: pageNum < totalPages ? 'always' : 'auto',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            padding: 0
        }}>
            {/* ── Page header ── */}
            {pageNum === 1 ? (
                /* Front page: bigger header with title & call to action */
                <div style={{
                    padding: '20px 24px 16px',
                    background: TEAL_DARK,
                    flexShrink: 0
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ flex: 1 }}>
                            <div style={{
                                fontSize: '14px', letterSpacing: '3px', textTransform: 'uppercase',
                                color: 'rgba(255,255,255,0.5)', marginBottom: '4px', fontWeight: 600
                            }}>
                                Project Platypus — Upper Wimmera Landcare
                            </div>
                            <h1 style={{
                                fontSize: '28px', fontWeight: 800, color: 'white',
                                margin: '0 0 6px', lineHeight: 1.15
                            }}>
                                Priority Weeds in Our Region
                            </h1>
                            <p style={{
                                fontSize: '16px', color: 'rgba(255,255,255,0.8)',
                                margin: 0, lineHeight: 1.6, maxWidth: '480px'
                            }}>
                                We need your help to track down these invasive plants!
                                If you spot any of these weeds, please report to your local Landcare group.
                            </p>
                        </div>
                        <div style={{
                            background: 'rgba(255,255,255,0.12)', borderRadius: '8px',
                            padding: '8px 14px', textAlign: 'center', flexShrink: 0,
                            border: '1px solid rgba(255,255,255,0.15)'
                        }}>
                            <div style={{ fontSize: '16px', color: 'rgba(255,255,255,0.6)', fontWeight: 600, marginBottom: '2px' }}>
                                Top {topWeeds.length}
                            </div>
                            <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)' }}>
                                Priority<br />Weeds
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                /* Back page: compact header */
                <div style={{
                    padding: '12px 24px',
                    background: TEAL_DARK,
                    flexShrink: 0,
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                    <div>
                        <div style={{ fontSize: '12px', letterSpacing: '2px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>
                            Project Platypus
                        </div>
                        <div style={{ fontSize: '20px', fontWeight: 800, color: 'white' }}>
                            Priority Weeds — continued
                        </div>
                    </div>
                    <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.4)' }}>
                        Page {pageNum} of {totalPages}
                    </div>
                </div>
            )}

            {/* ── 2×2 card grid ── */}
            <div style={{
                flex: 1,
                padding: '12px 16px',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gridTemplateRows: '1fr 1fr',
                gap: '10px'
            }}>
                {weedsList.map(weed => (
                    <WeedCard key={weed.id} weed={weed} />
                ))}
            </div>

            {/* ── Footer ── */}
            <div style={{
                padding: '8px 20px 10px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                fontSize: '12px', color: 'rgba(255,255,255,0.45)',
                background: TEAL_DARK, flexShrink: 0
            }}>
                <div>
                    Photos: iNaturalist · Data: Weeds Australia
                    {pageNum === 1 && ` · ${new Date().toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })}`}
                </div>
                <div>projectplatypus.org.au</div>
            </div>
        </div>
    );

    const totalPages = page2.length > 0 ? 2 : 1;

    return (
        <div className="max-w-7xl mx-auto p-6">
            {/* Controls */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-8">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800">📋 Export Brochure</h2>
                        <p className="text-slate-500 mt-1">
                            A printable double-sided A4 identification guide for the top {topWeeds.length} priority weeds.
                        </p>
                    </div>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={handleExportPDF}
                        disabled={loading || generating}
                        className="px-6 py-3 bg-teal-700 text-white font-bold rounded-lg shadow-md hover:bg-teal-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {generating ? (
                            <><span className="animate-spin">⏳</span> Generating PDF...</>
                        ) : (
                            <>📥 Export as PDF</>
                        )}
                    </button>
                    <button
                        onClick={() => window.print()}
                        className="px-6 py-3 border border-slate-300 text-slate-600 hover:bg-slate-50 font-medium rounded-lg transition-colors flex items-center gap-2"
                    >
                        🖨 Print
                    </button>
                    <button
                        onClick={() => navigate('/step-5')}
                        className="px-6 py-3 border border-slate-300 text-slate-600 hover:bg-slate-50 font-medium rounded-lg transition-colors"
                    >
                        ← Back to Results
                    </button>
                </div>
                {loading && (
                    <div className="mt-4 flex items-center gap-2 text-sm text-amber-600">
                        <span className="animate-spin">🔄</span> Loading photos from iNaturalist...
                    </div>
                )}
            </div>

            {/* Brochure Preview */}
            <div ref={brochureRef} style={{ background: 'white' }}>
                <PageContent weedsList={page1} pageNum={1} totalPages={totalPages} />
                {page2.length > 0 && (
                    <PageContent weedsList={page2} pageNum={2} totalPages={totalPages} />
                )}
            </div>
        </div>
    );
}
