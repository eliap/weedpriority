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

// 1.5 Create a secondary lookup map for weedProfiles (fallback)
const profileWeedsMap = {};
Object.values(weedProfiles).forEach(profile => {
    // Map primarily by scientific name if possible, or key if it matches a name format?
    // Actually, weedProfiles is keyed by common name (or similar), so we iterate keys
});
Object.keys(weedProfiles).forEach(key => {
    const profile = weedProfiles[key];
    const normKey = normalize(key);
    profileWeedsMap[normKey] = { ...profile, name: key };

    // Map by Aliases (stripping parens etc)
    // beneficial for "Gazania (linearis)" -> "gazania"
    const simpleName = key.replace(/\s*\(.*?\)\s*/g, '').trim();
    if (simpleName && simpleName !== key) {
        profileWeedsMap[normalize(simpleName)] = { ...profile, name: key };
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

    // Layer 4: Fallback to direct weedProfiles data if no Victoriam ID found
    if (!vicItem) {
        // Try looking up in our profile map
        const profileMatch = profileWeedsMap[normalize(key)];
        if (profileMatch) {
            // Construct a pseudo-vicItem from the profile data
            vicItem = {
                name: profileMatch.name,
                scientificName: profileMatch.scientificName,
                url: profileMatch.profileUrl,
                // Use profile content or placeholders
                description: "Description not available in primary database.",
                controlMethods: profileMatch.controlMethods || "Control methods not available in primary database.",
                images: [], // Profiles might not have images in the same format
                // Add other fields as needed
                origin: profileMatch.origin || '',
                growthForm: profileMatch.growthForm || '',
                flowerColour: profileMatch.flowerColour || ''
            };
        }
    }

    vicItem = vicItem || {};

    governmentData[key] = {
        ...govItem,
        ...assessmentItem,
        // Content overrides (vic > assessment > gov)
        // Content overrides (vic > assessment > gov)
        description: vicItem.description || assessmentItem.description || govItem.description ||
            (assessmentItem.comments ? `Assessors notes: ${assessmentItem.comments}` : null) ||
            (assessmentItem.invasiveness ? Object.values(assessmentItem.invasiveness).map(v => v.comments).join('. ') : ''),
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

    // Also map by simplified alias (stripping content in parens)
    // e.g. "Gazania (linearis)" -> "gazania"
    const simpleName = key.replace(/\s*\(.*?\)\s*/g, '').trim();
    if (simpleName && simpleName !== key) {
        const simpleNorm = normalize(simpleName);
        // Only map if not already taken, or if this key is "better" (length logic? arbitrary?)
        // For now, first come first served, or overwrite. 
        // If we have Gazania (linearis) and Gazania (rigens), both map to 'gazania'.
        // We probably want the one that appears first or is more significant.
        // Let's just map it.
        if (!govDataKeyMap[simpleNorm]) {
            govDataKeyMap[simpleNorm] = key;
        }
    }
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

            // Extract scientific name for photo fetching
            // Prioritize existing scientificName (state) for custom weeds
            let scientificName = weed.scientificName || govWeedData.scientificName;

            // Fallback: if not in gov data (e.g. pure vicWeeds entry not in gov dataset yet), look up in vicWeedsMap
            if (!scientificName) {
                const normKey = normalize(weed.name);
                const vicMatch = vicWeedsMap[normKey];
                if (vicMatch) scientificName = vicMatch.scientificName;
                // Fallback: if still no scientificName, try to extract from quickFacts
                if (!scientificName && vicMatch && vicMatch.quickFacts && vicMatch.quickFacts.length > 0) {
                    const firstFact = vicMatch.quickFacts[0];
                    const match = firstFact.match(/\((.*?)\)/);
                    if (match && match[1]) {
                        scientificName = match[1];
                    }
                }
            }

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

            return { ...weed, finalScore, scientificName, scores: { extent: extentScore, impact: impactResult.hasData ? impactResult.scaled : null, invasiveness: invasivenessResult.hasData ? invasivenessResult.scaled : null, habitat: habitatScore, control: controlScore } };
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
                // Use the resolved scientific name from the weed data
                if (weed.scientificName) {
                    const photo = await fetchINatPhoto(weed.scientificName);
                    if (!cancelled && photo) {
                        photoMap[weed.name] = photo;
                    }
                } else {
                    // Fallback to old lookup if scientificName missing (unlikely now)
                    const profile = weedProfiles[weed.name];
                    if (profile?.scientificName) {
                        const photo = await fetchINatPhoto(profile.scientificName);
                        if (!cancelled && photo) {
                            photoMap[weed.name] = photo;
                        }
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
                {/* Cover Page */}
                <div style={{
                    position: 'relative',
                    width: '210mm',
                    height: '297mm',
                    background: 'radial-gradient(circle at 50% 30%, #115e59 0%, #0f172a 100%)',
                    color: 'white',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    textAlign: 'center',
                    pageBreakAfter: 'always',
                    overflow: 'hidden',
                    fontFamily: "'Inter', sans-serif"
                }}>
                    {/* Decorative Background Elements */}
                    <div style={{
                        position: 'absolute',
                        top: 0, left: 0, right: 0, bottom: 0,
                        backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
                        backgroundSize: '20mm 20mm',
                        pointerEvents: 'none'
                    }} />

                    <div style={{ position: 'relative', zIndex: 1, padding: '0 40px' }}>
                        {/* Group Name Badge */}
                        <div style={{
                            display: 'inline-block',
                            padding: '8px 16px',
                            background: 'rgba(255,255,255,0.1)',
                            backdropFilter: 'blur(4px)',
                            borderRadius: '4px',
                            border: '1px solid rgba(255,255,255,0.2)',
                            marginBottom: '40px',
                            fontSize: '12px',
                            letterSpacing: '2px',
                            textTransform: 'uppercase',
                            fontWeight: 600
                        }}>
                            Prepared for {groupName || 'Project Platypus'}
                        </div>

                        <h1 style={{
                            fontSize: '56px',
                            fontWeight: 800,
                            lineHeight: 1.1,
                            marginBottom: '24px',
                            textShadow: '0 4px 12px rgba(0,0,0,0.3)',
                            background: 'linear-gradient(to bottom right, #ffffff, #ccfbf1)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent'
                        }}>
                            Weed Priority<br />Assessment
                        </h1>

                        <div style={{
                            width: '60px',
                            height: '6px',
                            background: '#2dd4bf',
                            borderRadius: '3px',
                            margin: '32px auto'
                        }} />

                        <div style={{
                            fontSize: '20px',
                            fontWeight: 300,
                            color: '#ccfbf1',
                            maxWidth: '500px',
                            lineHeight: 1.6,
                            margin: '0 auto'
                        }}>
                            A strategic report identifying the <strong style={{ color: 'white', fontWeight: 600 }}>Top {topWeeds.length}</strong> priority weed species for targeted management action.
                        </div>
                    </div>

                    {/* Footer / Date */}
                    <div style={{
                        position: 'absolute',
                        bottom: '60px',
                        left: 0,
                        right: 0,
                        textAlign: 'center',
                        fontSize: '14px',
                        color: 'rgba(255,255,255,0.4)',
                        letterSpacing: '1px'
                    }}>
                        GENERATED {new Date().toLocaleDateString('en-AU', { year: 'numeric', month: 'long', day: 'numeric' }).toUpperCase()}
                    </div>
                </div>

                {/* Summary Table Page */}
                <div style={{ padding: '40px 50px', pageBreakAfter: 'always', fontFamily: "'Inter', sans-serif" }}>
                    <h2 style={{
                        fontSize: '32px',
                        fontWeight: 800,
                        color: '#0f172a',
                        marginBottom: '10px',
                        letterSpacing: '-0.5px'
                    }}>
                        Priority Rankings
                    </h2>
                    <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '32px', maxWidth: '600px' }}>
                        Species are ranked based on a weighted assessment score across five key criteria: Extent, Impact, Invasiveness, Habitat Value, and Ease of Control.
                    </p>

                    <div style={{ borderRadius: '8px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                            <thead>
                                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                                    <th style={{ padding: '16px 20px', textAlign: 'left', fontWeight: 700, color: '#475569', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px' }}>Rank</th>
                                    <th style={{ padding: '16px 20px', textAlign: 'left', fontWeight: 700, color: '#475569', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px' }}>Species</th>
                                    <th style={{ padding: '16px 20px', textAlign: 'center', fontWeight: 700, color: '#475569', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px' }}>Score</th>
                                    <th style={{ padding: '16px 20px', textAlign: 'center', fontWeight: 700, color: '#475569', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px' }}>Priority</th>
                                    <th style={{ padding: '16px 12px', textAlign: 'center', fontWeight: 600, color: '#94a3b8', fontSize: '10px', textTransform: 'uppercase' }}>Extent</th>
                                    <th style={{ padding: '16px 12px', textAlign: 'center', fontWeight: 600, color: '#94a3b8', fontSize: '10px', textTransform: 'uppercase' }}>Impact</th>
                                    <th style={{ padding: '16px 12px', textAlign: 'center', fontWeight: 600, color: '#94a3b8', fontSize: '10px', textTransform: 'uppercase' }}>Inv.</th>
                                    <th style={{ padding: '16px 12px', textAlign: 'center', fontWeight: 600, color: '#94a3b8', fontSize: '10px', textTransform: 'uppercase' }}>Hab.</th>
                                    <th style={{ padding: '16px 12px', textAlign: 'center', fontWeight: 600, color: '#94a3b8', fontSize: '10px', textTransform: 'uppercase' }}>Ctrl.</th>
                                </tr>
                            </thead>
                            <tbody>
                                {topWeeds.map((weed, i) => (
                                    <tr key={weed.id} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? 'white' : '#fcfcfc' }}>
                                        <td style={{ padding: '16px 20px', fontWeight: 700, color: '#0f766e', fontSize: '16px' }}>{i + 1}</td>
                                        <td style={{ padding: '16px 20px' }}>
                                            <div style={{ fontWeight: 700, color: '#1e293b', fontSize: '14px', marginBottom: '2px' }}>{weed.name}</div>
                                            <div style={{ fontSize: '12px', color: '#64748b', fontStyle: 'italic' }}>
                                                {weed.scientificName || ''}
                                            </div>
                                        </td>
                                        <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                                            <div style={{
                                                fontWeight: 800,
                                                fontSize: '15px',
                                                color: getScoreColor(weed.finalScore)
                                            }}>
                                                {Math.round(weed.finalScore)}
                                            </div>
                                        </td>
                                        <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                                            <span style={{
                                                display: 'inline-block',
                                                padding: '4px 12px',
                                                borderRadius: '16px',
                                                fontSize: '11px',
                                                fontWeight: 700,
                                                color: 'white',
                                                background: getScoreColor(weed.finalScore),
                                                boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                                            }}>
                                                {getScoreLabel(weed.finalScore)}
                                            </span>
                                        </td>
                                        <td style={{ padding: '16px 12px', textAlign: 'center', color: '#64748b', fontFamily: 'monospace' }}>{Math.round(weed.scores.extent)}</td>
                                        <td style={{ padding: '16px 12px', textAlign: 'center', color: '#64748b', fontFamily: 'monospace' }}>{weed.scores.impact !== null ? Math.round(weed.scores.impact) : '—'}</td>
                                        <td style={{ padding: '16px 12px', textAlign: 'center', color: '#64748b', fontFamily: 'monospace' }}>{weed.scores.invasiveness !== null ? Math.round(weed.scores.invasiveness) : '—'}</td>
                                        <td style={{ padding: '16px 12px', textAlign: 'center', color: '#64748b', fontFamily: 'monospace' }}>{Math.round(weed.scores.habitat)}</td>
                                        <td style={{ padding: '16px 12px', textAlign: 'center', color: '#64748b', fontFamily: 'monospace' }}>{Math.round(weed.scores.control)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Individual Weed Cards */}
                {topWeeds.map((weed, index) => {
                    const profile = weedProfiles[weed.name] || {};
                    const weedPhotos = photos[weed.name] || [];
                    const mainPhoto = weedPhotos.length > 0 ? weedPhotos[0] : null; // Use object with url/attribution
                    const secondaryPhotos = weedPhotos.slice(1, 4); // Up to 3 secondary photos
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
                    const scientificName = govData.scientificName || profile.scientificName || weed.scientificName || '';
                    const commonNames = govData.commonName
                        ? govData.commonName.split(/,|;/).map(s => s.trim()).slice(0, 3).join(', ')
                        : (profile.commonNames ? profile.commonNames.slice(0, 3).join(', ') : '—');
                    const profileUrl = govData.url || profile.profileUrl || '';

                    return (
                        <div key={weed.id} style={{
                            padding: '40px 50px',
                            pageBreakAfter: 'always',
                            fontFamily: "'Inter', sans-serif",
                            minHeight: '297mm',
                            display: 'flex',
                            flexDirection: 'column'
                        }}>
                            {/* Header Section */}
                            <div style={{
                                borderBottom: '4px solid #0f766e',
                                paddingBottom: '20px',
                                marginBottom: '30px',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'flex-end'
                            }}>
                                <div>
                                    <div style={{
                                        fontSize: '11px',
                                        fontWeight: 700,
                                        textTransform: 'uppercase',
                                        color: '#64748b',
                                        letterSpacing: '1px',
                                        marginBottom: '4px'
                                    }}>
                                        Priority Species Profile
                                    </div>
                                    <h2 style={{
                                        fontSize: '36px',
                                        fontWeight: 800,
                                        color: '#0f172a',
                                        margin: 0,
                                        lineHeight: 1.1
                                    }}>
                                        {weed.name}
                                    </h2>
                                    <div style={{
                                        fontSize: '16px',
                                        color: '#0f766e',
                                        fontStyle: 'italic',
                                        marginTop: '4px',
                                        fontWeight: 500
                                    }}>
                                        {scientificName}
                                    </div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Overall Score</div>
                                    <div style={{
                                        fontSize: '48px',
                                        fontWeight: 900,
                                        color: getScoreColor(weed.finalScore),
                                        lineHeight: 1
                                    }}>
                                        {Math.round(weed.finalScore)}
                                    </div>
                                </div>
                            </div>

                            {/* Main Content Grid */}
                            <div style={{ display: 'flex', gap: '40px', flex: 1 }}>

                                {/* Left Column: Description & Control */}
                                <div style={{ flex: '1 1 60%' }}>
                                    {/* Description */}
                                    <div style={{ marginBottom: '30px' }}>
                                        <h3 style={{
                                            fontSize: '14px',
                                            fontWeight: 700,
                                            color: '#334155',
                                            borderLeft: '3px solid #0d9488',
                                            paddingLeft: '10px',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.5px',
                                            marginBottom: '12px'
                                        }}>
                                            Description & Impact
                                        </h3>
                                        <p style={{ fontSize: '14px', lineHeight: 1.7, color: '#334155' }}>
                                            {weed.description ||
                                                (weed.impact && Object.values(weed.impact).map(v => v.comments).join(' ')) ||
                                                'No detailed description available.'}
                                        </p>
                                    </div>

                                    {/* Control Methods */}
                                    <div>
                                        <h3 style={{
                                            fontSize: '14px',
                                            fontWeight: 700,
                                            color: '#334155',
                                            borderLeft: '3px solid #f59e0b',
                                            paddingLeft: '10px',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.5px',
                                            marginBottom: '12px'
                                        }}>
                                            Management Strategy
                                        </h3>
                                        <p style={{ fontSize: '13px', lineHeight: 1.6, color: '#475569', background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                            {weed.controlMethods || 'No specific control methods listed. Please refer to local guidelines.'}
                                        </p>
                                    </div>

                                    {/* Score Breakdown (Visual Bars) */}
                                    <div style={{ marginTop: '40px' }}>
                                        <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#334155', marginBottom: '16px' }}>Assessment Breakdown</h3>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                            {[
                                                { l: 'Extent', v: weed.scores.extent, c: '#94a3b8' },
                                                { l: 'Impact', v: weed.scores.impact, c: '#ef4444' },
                                                { l: 'Invasiveness', v: weed.scores.invasiveness, c: '#f97316' },
                                                { l: 'Habitat', v: weed.scores.habitat, c: '#22c55e' },
                                                { l: 'Control Difficulty', v: weed.scores.control, c: '#3b82f6' }
                                            ].map((item, idx) => (
                                                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '12px' }}>
                                                    <div style={{ width: '100px', fontWeight: 600, color: '#475569' }}>{item.l}</div>
                                                    <div style={{ flex: 1, height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                                                        <div style={{
                                                            width: `${item.v || 0}%`,
                                                            height: '100%',
                                                            background: item.c,
                                                            borderRadius: '4px'
                                                        }} />
                                                    </div>
                                                    <div style={{ width: '30px', textAlign: 'right', fontWeight: 700, color: '#64748b' }}>
                                                        {item.v ? Math.round(item.v) : '-'}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Right Column: Photos & Quick Facts */}
                                <div style={{ flex: '0 0 35%', display: 'flex', flexDirection: 'column', gap: '20px' }}>

                                    {/* Main Photo */}
                                    <div style={{
                                        aspectRatio: '4/3',
                                        background: '#f1f5f9',
                                        borderRadius: '8px',
                                        overflow: 'hidden',
                                        border: '1px solid #e2e8f0',
                                        position: 'relative'
                                    }}>
                                        {mainPhoto ? (
                                            <>
                                                <div style={{ width: '100%', height: '100%', backgroundImage: `url(${mainPhoto.url})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
                                                <div style={{ position: 'absolute', bottom: 0, right: 0, background: 'rgba(0,0,0,0.6)', color: 'white', fontSize: '9px', padding: '2px 6px', borderTopLeftRadius: '4px' }}>
                                                    © {mainPhoto.attribution}
                                                </div>
                                            </>
                                        ) : (
                                            /* Species Info Bar - Fallback */
                                            <div style={{
                                                display: 'flex',
                                                flexDirection: 'column',
                                                height: '100%',
                                                background: '#f8fafc',
                                                fontSize: '12px'
                                            }}>
                                                {[
                                                    { label: 'Origin', value: origin },
                                                    { label: 'Growth Form', value: growthForm },
                                                    { label: 'Flower Colour', value: flowerColour },
                                                    { label: 'Common Names', value: commonNames }
                                                ].map(({ label, value }, i) => (
                                                    <div key={label} style={{ flex: 1, padding: '8px 16px', borderBottom: i < 3 ? '1px solid #e2e8f0' : 'none', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                                        <div style={{ fontWeight: 700, color: '#64748b', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>{label}</div>
                                                        <div style={{ color: '#334155', fontWeight: 500, fontSize: '11px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Secondary Photos */}
                                    {secondaryPhotos.length > 0 && (
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                            {secondaryPhotos.map((p, idx) => (
                                                <div key={idx} style={{
                                                    aspectRatio: '1/1',
                                                    background: '#f1f5f9',
                                                    borderRadius: '6px',
                                                    overflow: 'hidden',
                                                    border: '1px solid #e2e8f0',
                                                    position: 'relative'
                                                }}>
                                                    <div style={{ width: '100%', height: '100%', backgroundImage: `url(${p.url})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Quick Info Box */}
                                    <div style={{ background: '#f0fdfa', padding: '20px', borderRadius: '8px', border: '1px solid #ccfbf1' }}>
                                        <h4 style={{ fontSize: '12px', fontWeight: 700, color: '#0f766e', textTransform: 'uppercase', marginBottom: '12px' }}>Quick Facts</h4>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            {[
                                                { label: 'Origin', val: origin },
                                                { label: 'Growth Form', val: growthForm },
                                                { label: 'Flower Colour', val: flowerColour }
                                            ].map((fact, i) => (
                                                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', borderBottom: i < 2 ? '1px dashed #cbd5e1' : 'none', paddingBottom: i < 2 ? '8px' : '0' }}>
                                                    <span style={{ color: '#64748b' }}>{fact.label}</span>
                                                    <span style={{ fontWeight: 600, color: '#334155' }}>{fact.val}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Source Link */}
                                    {profileUrl && (
                                        <div style={{ fontSize: '10px', color: '#94a3b8', textAlign: 'center' }}>
                                            Source: <span style={{ textDecoration: 'underline' }}>Weeds Australia</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
