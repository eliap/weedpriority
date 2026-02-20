import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { valueCategories } from '../data/valuesData';
import { invasivenessCategories } from '../data/invasivenessData';
import governmentDataRaw from '../data/realGovernmentData.json';
import weedProfiles from '../data/weedProfiles.json';
import scrapedData from '../data/weed_assessments.json';
import vicWeeds from '../data/weeds_victoria.json';

// Normalize helper
const normalize = (str) => str ? str.toLowerCase().replace(/[^a-z0-9]/g, '') : '';

// 1. Create a lookup map for Victorian weeds
const vicWeedsMap = {};
Object.values(vicWeeds).forEach(weed => {
    if (weed.name) vicWeedsMap[normalize(weed.name)] = weed;
    if (weed.id) vicWeedsMap[normalize(weed.id)] = weed;

    // Map by Aliases
    if (weed.name) {
        const aliases = weed.name.split(/,|;|\/|\(|\)/).map(s => s.trim());
        aliases.forEach(alias => {
            if (alias.length > 2) vicWeedsMap[normalize(alias)] = weed;
        });
    }
});

// 2. Merge scraped data into government data
// Uses a 3-layer lookup to find the matching Victorian entry:
//   Layer 1: Normalized key from weed_assessments → vicWeedsMap
//   Layer 2: Normalized assessment name → vicWeedsMap
//   Layer 3: profileUrl slug from weedProfiles → vicWeeds[slug] (most reliable)
const governmentData = { ...governmentDataRaw };
Object.keys(scrapedData).forEach(key => {
    const govItem = governmentData[key] || {};
    const assessmentItem = scrapedData[key];

    // Layer 1 & 2: Name-based lookup via vicWeedsMap
    let vicItem = vicWeedsMap[normalize(key)] || vicWeedsMap[normalize(assessmentItem.name)];

    // Layer 3: Use profileUrl slug from weedProfiles as a reliable bridge
    // (weeds.org.au slugs match weeds_victoria.json entry IDs)
    if (!vicItem) {
        const profile = weedProfiles[key];
        if (profile?.profileUrl) {
            const slug = profile.profileUrl.replace(/\/$/, '').split('/').pop();
            if (slug && vicWeeds[slug]) {
                vicItem = vicWeeds[slug];
            }
        }
    }

    vicItem = vicItem || {};

    governmentData[key] = {
        ...govItem,
        ...assessmentItem,
        // Content overrides (vic > assessment > gov)
        description: vicItem.description || assessmentItem.description || govItem.description,
        controlMethods: vicItem.controlMethods || assessmentItem.controlMethods || govItem.controlMethods,
        images: vicItem.images && vicItem.images.length > 0 ? vicItem.images : (assessmentItem.images || govItem.images),
        // Score preservation
        impact: { ...govItem.impact || {}, ...assessmentItem.impact || {} },
        invasiveness: { ...govItem.invasiveness || {}, ...assessmentItem.invasiveness || {} },
        // Rich fields from weeds_victoria.json
        quickFacts: vicItem.quickFacts || [],
        similarSpecies: vicItem.similarSpecies || '',
        habitat: vicItem.habitat || '',
        origin: vicItem.origin || assessmentItem.origin || govItem.origin || '',
        growthForm: vicItem.growthForm || assessmentItem.growthForm || govItem.growthForm || '',
        flowerColour: vicItem.flowerColour || assessmentItem.flowerColour || govItem.flowerColour || '',
        scientificName: vicItem.scientificName || assessmentItem.scientificName || govItem.scientificName
    };
});

// Scoring constants (duplicated from ActionPlan for standalone use)
// Create a normalized key map for governmentData to handle case mismatches
const govDataKeyMap = {};
Object.keys(governmentData).forEach(key => {
    govDataKeyMap[normalize(key)] = key;
});

const RATING_VALUES = { "L": 1, "ML": 2, "M": 3, "MH": 4, "H": 5 };
const CONFIDENCE_VALUES = { "L": 0.2, "ML": 0.4, "M": 0.6, "MH": 0.8, "H": 1.0 };

const calculateCategoryScore = (items, userReviews, govReviews, selectedIds = null) => {
    let totalScore = 0, totalScoreMax = 0, maxPossibleScore = 0, maxPossibleScoreMax = 0, itemsWithData = 0;
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
            totalScoreMax += ratingVal;
            maxPossibleScore += 5;
            maxPossibleScoreMax += 5;
            itemsWithData++;
        }
    });
    return {
        scaled: maxPossibleScore > 0 ? (totalScore / maxPossibleScore) * 100 : 0,
        unscaled: maxPossibleScoreMax > 0 ? (totalScoreMax / maxPossibleScoreMax) * 100 : 0,
        hasData: itemsWithData > 0
    };
};

// Convert an image URL to a base64 data URI to avoid cross-origin html2canvas failures
// Routes through Vite dev server proxy to bypass CORS restrictions (dev only)
const isDev = import.meta.env.DEV;

function proxyUrl(url) {
    // Proxy only works with Vite dev server; in production (GitHub Pages) use original URLs
    if (!isDev) return url;
    if (url.includes('inaturalist-open-data.s3.amazonaws.com')) {
        return url.replace('https://inaturalist-open-data.s3.amazonaws.com', '/inat-photos');
    }
    if (url.includes('static.inaturalist.org')) {
        return url.replace('https://static.inaturalist.org', '/inat-static');
    }
    return url;
}

async function toDataUrl(url) {
    try {
        const proxied = proxyUrl(url);
        const response = await fetch(proxied);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const blob = await response.blob();
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(blob);
        });
    } catch (e) {
        console.warn('Failed to convert image to base64:', url, e);
        return null;
    }
}

// Fetch cover image from iNaturalist
async function fetchINatPhoto(scientificName) {
    try {
        const res = await fetch(`https://api.inaturalist.org/v1/taxa?q=${encodeURIComponent(scientificName)}&per_page=1`);
        const data = await res.json();
        if (data.results && data.results.length > 0) {
            const taxon = data.results[0];
            if (taxon.default_photo) {
                const originalUrl = taxon.default_photo.medium_url || taxon.default_photo.url;
                // Try base64 conversion (works in dev via proxy); fall back to direct URL for display
                const dataUrl = await toDataUrl(originalUrl);
                return {
                    url: dataUrl || originalUrl,
                    attribution: taxon.default_photo.attribution || 'iNaturalist'
                };
            }
        }
    } catch (e) {
        console.warn('Failed to fetch iNaturalist photo for', scientificName, e);
    }
    return null;
}

export default function BrochureExport({ weeds, selectedValues, groupName }) {
    const navigate = useNavigate();
    const brochureRef = useRef(null);
    const [photos, setPhotos] = useState({});
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [maxWeeds, setMaxWeeds] = useState(10);

    // Calculate scores (same logic as ActionPlan)
    const scoredWeeds = useMemo(() => {
        const weights = { extent: 20, impact: 20, invasiveness: 20, habitat: 20, control: 20 };
        return weeds.map(weed => {
            // Robust lookup: Try exact match first, then normalized match
            let govWeedData = governmentData[weed.name];
            if (!govWeedData) {
                const normKey = normalize(weed.name);
                const matchedKey = govDataKeyMap[normKey];
                if (matchedKey) {
                    govWeedData = governmentData[matchedKey];
                }
            }
            govWeedData = govWeedData || { impact: {}, invasiveness: {} };
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

            return { ...weed, finalScore, scores: { extent: extentScore, impact: impactResult.hasData ? impactResult.scaled : null, invasiveness: invasivenessResult.hasData ? invasivenessResult.scaled : null, habitat: habitatScore, control: controlScore } };
        }).sort((a, b) => b.finalScore - a.finalScore);
    }, [weeds, selectedValues]);

    const topWeeds = scoredWeeds.slice(0, maxWeeds);

    // Fetch photos from iNaturalist
    useEffect(() => {
        let cancelled = false;
        async function loadPhotos() {
            setLoading(true);
            const photoMap = {};
            for (const weed of topWeeds) {
                const profile = weedProfiles[weed.name];
                if (profile?.scientificName) {
                    const photo = await fetchINatPhoto(profile.scientificName);
                    if (!cancelled && photo) {
                        photoMap[weed.name] = photo;
                    }
                }
            }
            if (!cancelled) {
                setPhotos(photoMap);
                setLoading(false);
            }
        }
        loadPhotos();
        return () => { cancelled = true; };
    }, [topWeeds.map(w => w.name).join(',')]);

    const handleExportPDF = async () => {
        setGenerating(true);
        await new Promise(r => setTimeout(r, 200));

        const element = brochureRef.current;

        try {
            // Check for data-page elements (per-page capture), otherwise capture whole element
            const pageElements = element.querySelectorAll('[data-page]');
            const pdfWidth = 210;
            const pdfHeight = 297;
            const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

            // Recursively strip only leaf-level CSS rules that use oklch()
            // Preserves @layer base (box-sizing:border-box, etc.)
            function stripOklch(ruleList) {
                for (let j = ruleList.length - 1; j >= 0; j--) {
                    const rule = ruleList[j];
                    if (rule.cssRules && rule.cssRules.length > 0) {
                        stripOklch(rule.cssRules);
                    } else if (rule.cssText && rule.cssText.includes('oklch')) {
                        try {
                            const parent = rule.parentStyleSheet || rule.parentRule;
                            if (parent && parent.deleteRule) parent.deleteRule(j);
                        } catch (e) { /* skip */ }
                    }
                }
            }

            function cleanClonedDoc(clonedDoc) {
                for (const sheet of [...clonedDoc.styleSheets]) {
                    try {
                        stripOklch(sheet.cssRules);
                    } catch (e) {
                        if (sheet.ownerNode) sheet.ownerNode.remove();
                    }
                }
                const resetStyle = clonedDoc.createElement('style');
                resetStyle.textContent = `
                    *, *::before, *::after { box-sizing: border-box; }
                    * { margin: 0; }
                    img, svg, video, canvas { display: block; max-width: 100%; }
                `;
                clonedDoc.head.appendChild(resetStyle);
            }

            if (pageElements.length > 0) {
                for (let i = 0; i < pageElements.length; i++) {
                    const pageEl = pageElements[i];
                    const canvas = await html2canvas(pageEl, {
                        scale: 2,
                        useCORS: false,
                        allowTaint: false,
                        width: pageEl.offsetWidth,
                        height: pageEl.offsetHeight,
                        scrollX: 0,
                        scrollY: 0,
                        windowWidth: pageEl.offsetWidth,
                        onclone: cleanClonedDoc
                    });
                    const imgData = canvas.toDataURL('image/jpeg', 0.95);
                    if (i > 0) pdf.addPage();
                    pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
                }
            } else {
                // Fallback: capture whole element as single page
                const canvas = await html2canvas(element, {
                    scale: 2,
                    useCORS: false,
                    allowTaint: false,
                    scrollX: 0,
                    scrollY: 0,
                    onclone: cleanClonedDoc
                });
                const imgData = canvas.toDataURL('image/jpeg', 0.95);
                const imgWidth = pdfWidth;
                const imgHeight = (canvas.height * pdfWidth) / canvas.width;
                pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, imgHeight);
            }

            pdf.save('weed-priority-full-report.pdf');
        } catch (e) {
            console.error('PDF generation failed:', e);
            alert('PDF generation failed: ' + (e.message || e) + '\n\nTry using Print instead.');
        }
        setGenerating(false);
    };

    const getScoreColor = (score) => {
        if (score >= 75) return '#dc2626';
        if (score >= 50) return '#f59e0b';
        if (score >= 25) return '#3b82f6';
        return '#22c55e';
    };

    const getScoreLabel = (score) => {
        if (score >= 75) return 'Critical';
        if (score >= 50) return 'High';
        if (score >= 25) return 'Moderate';
        return 'Low';
    };

    return (
        <div className="max-w-7xl mx-auto p-6">
            {/* Controls */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-8">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800">📄 Full Report Export</h2>
                        <p className="text-slate-500 mt-1">Generate a comprehensive report of your top prioritised weeds with photos, key facts, and detailed scoring.</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <label className="text-sm text-slate-600 font-medium">
                            Show top
                            <select
                                value={maxWeeds}
                                onChange={(e) => setMaxWeeds(Number(e.target.value))}
                                className="ml-2 rounded-md border-gray-300 shadow-sm focus:border-teal-500 focus:ring-teal-500 text-sm p-1.5 border"
                            >
                                <option value={5}>5</option>
                                <option value={10}>10</option>
                                <option value={15}>15</option>
                                <option value={20}>20</option>
                            </select>
                        </label>
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
            <div ref={brochureRef} className="brochure-content">
                {/* Cover Page */}
                <div style={{
                    background: 'linear-gradient(135deg, #0f766e 0%, #134e4a 50%, #1e3a3a 100%)',
                    color: 'white',
                    padding: '60px 50px',
                    minHeight: '297mm',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    textAlign: 'center',
                    pageBreakAfter: 'always'
                }}>
                    <div style={{ fontSize: '18px', letterSpacing: '8px', textTransform: 'uppercase', opacity: 0.7, marginBottom: '20px' }}>
                        {groupName || 'Project Platypus'}
                    </div>
                    <h1 style={{ fontSize: '42px', fontWeight: 800, lineHeight: 1.2, marginBottom: '16px' }}>
                        Weed Priority<br />Assessment
                    </h1>
                    <div style={{ width: '80px', height: '4px', background: '#2dd4bf', borderRadius: '2px', margin: '24px auto' }} />
                    <p style={{ fontSize: '18px', opacity: 0.8, maxWidth: '500px', lineHeight: 1.6 }}>
                        Top {topWeeds.length} priority weed species identified through community assessment and scientific review.
                    </p>
                    <div style={{ marginTop: '60px', fontSize: '14px', opacity: 0.5 }}>
                        Generated {new Date().toLocaleDateString('en-AU', { year: 'numeric', month: 'long', day: 'numeric' })}
                    </div>
                </div>

                {/* Summary Table Page */}
                <div style={{ padding: '40px 40px', pageBreakAfter: 'always' }}>
                    <h2 style={{ fontSize: '24px', fontWeight: 700, color: '#0f4c47', marginBottom: '8px' }}>Priority Rankings</h2>
                    <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '24px' }}>Species ranked by weighted assessment score across five criteria.</p>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                        <thead>
                            <tr style={{ background: '#f1f5f9' }}>
                                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, borderBottom: '2px solid #cbd5e1', color: '#334155' }}>Rank</th>
                                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, borderBottom: '2px solid #cbd5e1', color: '#334155' }}>Species</th>
                                <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, borderBottom: '2px solid #cbd5e1', color: '#334155' }}>Score</th>
                                <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, borderBottom: '2px solid #cbd5e1', color: '#334155' }}>Priority</th>
                                <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, borderBottom: '2px solid #cbd5e1', color: '#334155' }}>Extent</th>
                                <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, borderBottom: '2px solid #cbd5e1', color: '#334155' }}>Impact</th>
                                <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, borderBottom: '2px solid #cbd5e1', color: '#334155' }}>Invasive</th>
                                <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, borderBottom: '2px solid #cbd5e1', color: '#334155' }}>Habitat</th>
                                <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, borderBottom: '2px solid #cbd5e1', color: '#334155' }}>Control</th>
                            </tr>
                        </thead>
                        <tbody>
                            {topWeeds.map((weed, i) => (
                                <tr key={weed.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                    <td style={{ padding: '10px 12px', fontWeight: 700, color: '#0f766e' }}>{i + 1}</td>
                                    <td style={{ padding: '10px 12px' }}>
                                        <div style={{ fontWeight: 600, color: '#1e293b' }}>{weed.name}</div>
                                        <div style={{ fontSize: '11px', color: '#94a3b8', fontStyle: 'italic' }}>
                                            {weedProfiles[weed.name]?.scientificName || ''}
                                        </div>
                                    </td>
                                    <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, color: getScoreColor(weed.finalScore) }}>
                                        {Math.round(weed.finalScore)}
                                    </td>
                                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                                        <span style={{
                                            display: 'inline-block',
                                            padding: '2px 10px',
                                            borderRadius: '12px',
                                            fontSize: '11px',
                                            fontWeight: 700,
                                            color: 'white',
                                            background: getScoreColor(weed.finalScore)
                                        }}>
                                            {getScoreLabel(weed.finalScore)}
                                        </span>
                                    </td>
                                    <td style={{ padding: '10px 12px', textAlign: 'center', color: '#64748b' }}>{Math.round(weed.scores.extent)}</td>
                                    <td style={{ padding: '10px 12px', textAlign: 'center', color: '#64748b' }}>{weed.scores.impact !== null ? Math.round(weed.scores.impact) : '—'}</td>
                                    <td style={{ padding: '10px 12px', textAlign: 'center', color: '#64748b' }}>{weed.scores.invasiveness !== null ? Math.round(weed.scores.invasiveness) : '—'}</td>
                                    <td style={{ padding: '10px 12px', textAlign: 'center', color: '#64748b' }}>{Math.round(weed.scores.habitat)}</td>
                                    <td style={{ padding: '10px 12px', textAlign: 'center', color: '#64748b' }}>{Math.round(weed.scores.control)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Individual Weed Cards */}
                {topWeeds.map((weed, index) => {
                    const profile = weedProfiles[weed.name] || {};
                    const photo = photos[weed.name];
                    const scoreColor = getScoreColor(weed.finalScore);

                    // Robust lookup into the merged governmentData for Quick Facts, origin, etc.
                    let govData = governmentData[weed.name];
                    if (!govData) {
                        const normKey = normalize(weed.name);
                        const matchedKey = govDataKeyMap[normKey];
                        if (matchedKey) govData = governmentData[matchedKey];
                    }
                    // Fallback: look up vic data directly via profileUrl slug
                    if (!govData || (!govData.quickFacts || govData.quickFacts.length === 0)) {
                        if (profile.profileUrl) {
                            const slug = profile.profileUrl.replace(/\/$/, '').split('/').pop();
                            if (slug && vicWeeds[slug]) {
                                const vicDirect = vicWeeds[slug];
                                govData = {
                                    ...govData, ...vicDirect,
                                    // Preserve scores from govData
                                    impact: govData?.impact || {},
                                    invasiveness: govData?.invasiveness || {}
                                };
                            }
                        }
                    }
                    govData = govData || {};

                    // Prefer govData (merged from weeds_victoria.json) over weedProfiles
                    const quickFacts = govData.quickFacts || profile.quickFacts || [];
                    const origin = govData.origin || profile.origin || '—';
                    const growthForm = govData.growthForm || profile.growthForm || '—';
                    const flowerColour = govData.flowerColour || profile.flowerColour || '—';
                    const scientificName = govData.scientificName || profile.scientificName || '';
                    const commonNames = govData.commonName
                        ? govData.commonName.split(/,|;/).map(s => s.trim()).slice(0, 3).join(', ')
                        : (profile.commonNames ? profile.commonNames.slice(0, 3).join(', ') : '—');
                    const profileUrl = govData.url || profile.profileUrl || '';

                    return (
                        <div key={weed.id} className="weed-card" style={{ pageBreakBefore: 'always', padding: '0', minHeight: '297mm' }}>
                            {/* Header bar */}
                            <div style={{
                                background: `linear-gradient(135deg, ${scoreColor}dd, ${scoreColor}99)`,
                                color: 'white',
                                padding: '24px 40px',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                            }}>
                                <div>
                                    <div style={{ fontSize: '12px', letterSpacing: '3px', textTransform: 'uppercase', opacity: 0.8 }}>
                                        Priority #{index + 1}
                                    </div>
                                    <h2 style={{ fontSize: '28px', fontWeight: 800, margin: '4px 0' }}>{weed.name}</h2>
                                    <div style={{ fontSize: '16px', fontStyle: 'italic', opacity: 0.9 }}>
                                        {scientificName}
                                    </div>
                                </div>
                                <div style={{
                                    width: '80px',
                                    height: '80px',
                                    borderRadius: '50%',
                                    background: 'rgba(255,255,255,0.25)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    border: '3px solid rgba(255,255,255,0.5)'
                                }}>
                                    <div style={{ fontSize: '28px', fontWeight: 800 }}>{Math.round(weed.finalScore)}</div>
                                    <div style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px' }}>Score</div>
                                </div>
                            </div>

                            <div style={{ padding: '30px 40px' }}>
                                {/* Photo + Scores row */}
                                <div style={{ display: 'flex', gap: '30px', marginBottom: '30px' }}>
                                    {/* Photo */}
                                    <div style={{ flex: '0 0 260px' }}>
                                        {photo ? (
                                            <div>
                                                <img
                                                    src={photo.url}
                                                    alt={weed.name}
                                                    crossOrigin={undefined}
                                                    style={{
                                                        width: '260px',
                                                        height: '200px',
                                                        objectFit: 'cover',
                                                        borderRadius: '8px',
                                                        boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                                                    }}
                                                />
                                                <div style={{ fontSize: '9px', color: '#94a3b8', marginTop: '6px', lineHeight: 1.3 }}>
                                                    📷 {photo.attribution}
                                                </div>
                                            </div>
                                        ) : (
                                            <div style={{
                                                width: '260px',
                                                height: '200px',
                                                borderRadius: '8px',
                                                background: '#f1f5f9',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                color: '#94a3b8',
                                                fontSize: '14px'
                                            }}>
                                                No photo available
                                            </div>
                                        )}
                                    </div>

                                    {/* Score breakdown */}
                                    <div style={{ flex: 1 }}>
                                        <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#334155', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                                            Assessment Scores
                                        </h3>
                                        {[
                                            { label: 'Extent', value: weed.scores.extent },
                                            { label: 'Impact', value: weed.scores.impact },
                                            { label: 'Invasiveness', value: weed.scores.invasiveness },
                                            { label: 'Habitat Value', value: weed.scores.habitat },
                                            { label: 'Ease of Control', value: weed.scores.control }
                                        ].map(({ label, value }) => (
                                            <div key={label} style={{ marginBottom: '10px' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                                                    <span style={{ color: '#475569', fontWeight: 600 }}>{label}</span>
                                                    <span style={{ fontWeight: 700, color: value !== null ? '#1e293b' : '#94a3b8' }}>
                                                        {value !== null ? `${Math.round(value)}/100` : 'N/A'}
                                                    </span>
                                                </div>
                                                <div style={{ height: '8px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                                                    <div style={{
                                                        height: '100%',
                                                        width: value !== null ? `${value}%` : '0%',
                                                        background: value !== null
                                                            ? `linear-gradient(90deg, ${getScoreColor(value)}, ${getScoreColor(value)}cc)`
                                                            : '#e2e8f0',
                                                        borderRadius: '4px',
                                                        transition: 'width 0.3s ease'
                                                    }} />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Quick Facts */}
                                {quickFacts.length > 0 && (
                                    <div style={{ marginBottom: '24px' }}>
                                        <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#334155', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                                            Quick Facts
                                        </h3>
                                        <div style={{ columns: '2', columnGap: '24px', fontSize: '12px', lineHeight: 1.7, color: '#475569' }}>
                                            {quickFacts.map((fact, fi) => (
                                                <div key={fi} style={{ breakInside: 'avoid', marginBottom: '10px', paddingLeft: '16px', position: 'relative' }}>
                                                    <span style={{ position: 'absolute', left: '0', color: scoreColor, fontWeight: 700 }}>•</span>
                                                    {fact}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Species Info Bar */}
                                <div style={{
                                    display: 'flex',
                                    gap: '0',
                                    background: '#f8fafc',
                                    borderRadius: '8px',
                                    overflow: 'hidden',
                                    border: '1px solid #e2e8f0',
                                    fontSize: '12px'
                                }}>
                                    {[
                                        { label: 'Origin', value: origin },
                                        { label: 'Growth Form', value: growthForm },
                                        { label: 'Flower Colour', value: flowerColour },
                                        { label: 'Common Names', value: commonNames }
                                    ].map(({ label, value }, i) => (
                                        <div key={label} style={{ flex: 1, padding: '12px 16px', borderRight: i < 3 ? '1px solid #e2e8f0' : 'none' }}>
                                            <div style={{ fontWeight: 700, color: '#64748b', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>{label}</div>
                                            <div style={{ color: '#334155', fontWeight: 500 }}>{value}</div>
                                        </div>
                                    ))}
                                </div>

                                {/* Source attribution */}
                                {profileUrl && (
                                    <div style={{ marginTop: '16px', fontSize: '10px', color: '#94a3b8' }}>
                                        Source: Weeds Australia — <span style={{ textDecoration: 'underline' }}>{profileUrl}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
