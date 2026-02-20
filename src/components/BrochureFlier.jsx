import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { jsPDF } from 'jspdf';
import { valueCategories } from '../data/valuesData';
import { invasivenessCategories } from '../data/invasivenessData';
import governmentDataRaw from '../data/realGovernmentData.json';
import weedProfiles from '../data/weedProfiles.json';
import scrapedData from '../data/weed_assessments.json';
import vicWeeds from '../data/weeds_victoria.json';

// Normalization helper (matches logic in merge_data.cjs)
const normalize = (str) => {
    if (!str) return '';
    return str.toLowerCase()
        .replace(/['’]/g, '')
        .replace(/\-/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
};

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

// --- Data Preparation (Mirrors BrochureExport.jsx) ---

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
Object.keys(weedProfiles).forEach(key => {
    const profile = weedProfiles[key];
    const normKey = normalize(key);
    profileWeedsMap[normKey] = { ...profile, name: key };

    // Map by Aliases (stripping parens etc)
    const simpleName = key.replace(/\s*\(.*?\)\s*/g, '').trim();
    if (simpleName && simpleName !== key) {
        profileWeedsMap[normalize(simpleName)] = { ...profile, name: key };
    }
});

// 2. Merge scraped data into government data
const governmentData = { ...governmentDataRaw };
Object.keys(scrapedData).forEach(key => {
    const govItem = governmentData[key] || {};
    const assessmentItem = scrapedData[key];

    // Layer 1 & 2: Name-based lookup via vicWeedsMap
    let vicItem = vicWeedsMap[normalize(key)] || vicWeedsMap[normalize(assessmentItem.name)];

    // Layer 3: Use profileUrl slug from weedProfiles
    if (!vicItem) {
        const profile = weedProfiles[key];
        if (profile?.profileUrl) {
            const slug = profile.profileUrl.replace(/\/$/, '').split('/').pop();
            if (slug && vicWeeds[slug]) {
                vicItem = vicWeeds[slug];
            }
        }
    }

    // Layer 4: Fallback to direct weedProfiles data
    if (!vicItem) {
        const profileMatch = profileWeedsMap[normalize(key)];
        if (profileMatch) {
            vicItem = {
                name: profileMatch.name,
                scientificName: profileMatch.scientificName,
                url: profileMatch.profileUrl,
                description: "Description not available in primary database.",
                controlMethods: profileMatch.controlMethods || "Control methods not available in primary database.",
                images: [],
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
        description: vicItem.description || assessmentItem.description || govItem.description ||
            (assessmentItem.comments ? `Assessors notes: ${assessmentItem.comments}` : null) ||
            (assessmentItem.invasiveness ? Object.values(assessmentItem.invasiveness).map(v => v.comments).join('. ') : ''),
        controlMethods: vicItem.controlMethods || assessmentItem.controlMethods || govItem.controlMethods,
        images: vicItem.images && vicItem.images.length > 0 ? vicItem.images : (assessmentItem.images || govItem.images),
        scientificName: vicItem.scientificName || assessmentItem.scientificName || govItem.scientificName,
        origin: vicItem.origin || govItem.origin,
        growthForm: vicItem.growthForm || govItem.growthForm,
        flowerColour: vicItem.flowerColour || govItem.flowerColour,
        quickFacts: vicItem.quickFacts || govItem.quickFacts,
        impact: { ...govItem.impact || {}, ...assessmentItem.impact || {} },
        invasiveness: { ...govItem.invasiveness || {}, ...assessmentItem.invasiveness || {} }
    };
});

// 3. Create a Key Logic Map for Government Data
const govDataKeyMap = {};
Object.keys(governmentData).forEach(key => {
    govDataKeyMap[normalize(key)] = key;

    // Also map by simplified alias
    const simpleName = key.replace(/\s*\(.*?\)\s*/g, '').trim();
    if (simpleName && simpleName !== key) {
        const simpleNorm = normalize(simpleName);
        if (!govDataKeyMap[simpleNorm]) {
            govDataKeyMap[simpleNorm] = key;
        }
    }
});

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
            reader.onerror = () => resolve(null); // skip on error
            reader.readAsDataURL(blob);
        });
    } catch (e) {
        console.warn('Failed to convert image to base64:', url, e);
        return null; // skip this image rather than using cross-origin URL
    }
}

// Fetch up to 15 photos from iNaturalist to allow for replacements
async function fetchINatPhotos(scientificName) {
    try {
        // Extract Genus species (first two words) to improve match rate
        const simplerName = scientificName.split(' ').slice(0, 2).join(' ');
        const res = await fetch(`https://api.inaturalist.org/v1/taxa?q=${encodeURIComponent(simplerName)}&per_page=1`);
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
            if (taxon.id && photos.length < 15) {
                try {
                    const obsRes = await fetch(`https://api.inaturalist.org/v1/observations?taxon_id=${taxon.id}&photos=true&per_page=30&order_by=votes`);
                    const obsData = await obsRes.json();
                    if (obsData.results) {
                        for (const obs of obsData.results) {
                            if (photos.length >= 15) break;
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
            // Convert all photo URLs to base64 data URIs for PDF export compatibility
            const photosWithDataUrls = (await Promise.all(
                photos.map(async (p) => {
                    const dataUrl = await toDataUrl(p.url);
                    return dataUrl ? { ...p, url: dataUrl } : null;
                })
            )).filter(Boolean);
            return photosWithDataUrls.length > 0 ? photosWithDataUrls : null;
        }
    } catch (e) {
        console.warn('Failed to fetch iNaturalist photos for', scientificName, e);
    }
    return null;
}

// Color coding: green → blue → orange → red for increasing scores
const getScoreColor = (score) => {
    if (score === null || score === undefined) return '#94a3b8'; // grey for N/A
    if (score < 25) return '#22c55e';  // green
    if (score < 50) return '#3b82f6';  // blue
    if (score < 75) return '#f59e0b';  // orange
    return '#ef4444';                  // red
};

// Teal palette matching the Halls Gap brochure
const TEAL_BG = '#1a6b6a';
const TEAL_DARK = '#145453';
const TEAL_HEADER = '#0e4847';
const CARD_BG = '#f8fffe';

export default function BrochureFlier({ weeds, selectedValues, groupName }) {
    const navigate = useNavigate();
    const brochureRef = useRef(null);
    const [photos, setPhotos] = useState({});
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);

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
            let scientificName = weed.scientificName || govWeedData.scientificName;

            // Fallback: if not in gov data, look up in vicWeedsMap/profileWeedsMap
            if (!scientificName) {
                const normKey = normalize(weed.name);
                const vicMatch = vicWeedsMap[normKey] || profileWeedsMap[normKey];
                if (vicMatch) scientificName = vicMatch.scientificName;

                // Fallback: extract from quickFacts
                if (!scientificName && vicMatch && vicMatch.quickFacts && vicMatch.quickFacts.length > 0) {
                    const firstFact = vicMatch.quickFacts[0];
                    const match = firstFact.match(/\((.*?)\)/);
                    if (match && match[1]) scientificName = match[1];
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

            return {
                ...weed,
                ...govWeedData, // Merged government data
                scientificName, // Explicitly set resolved scientific name
                name: weed.name,
                finalScore,
                scores: {
                    extent: extentScore,
                    impact: impactResult.hasData ? impactResult.scaled : null,
                    invasiveness: invasivenessResult.hasData ? invasivenessResult.scaled : null,
                    habitat: habitatScore,
                    control: controlScore
                }
            };
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
                // unifiedData is already merged into weed by now
                if (weed.scientificName) {
                    const result = await fetchINatPhotos(weed.scientificName);
                    if (!cancelled && result) photoMap[weed.name] = result;
                }
            }
            if (!cancelled) { setPhotos(photoMap); setLoading(false); }
        }
        loadPhotos();
        return () => { cancelled = true; };
    }, [topWeeds.map(w => w.name).join(',')]);

    const handleRemovePhoto = (weedName, photoUrl) => {
        setPhotos(prev => {
            const weedPhotos = prev[weedName] || [];
            return {
                ...prev,
                [weedName]: weedPhotos.filter(p => p.url !== photoUrl)
            };
        });
    };

    // ── PDF Export: Programmatic jsPDF drawing (no html2canvas) ──
    const handleExportPDF = async () => {
        setGenerating(true);
        try {
            const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
            const W = 210, H = 297; // A4 mm
            const margin = 8;
            const gap = 6;
            const totalPages = page2.length > 0 ? 2 : 1;

            // Helper: parse hex colour to RGB array
            const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

            // Helper: draw a filled rect
            const fillRect = (x, y, w, h, color) => {
                pdf.setFillColor(...hex(color));
                pdf.rect(x, y, w, h, 'F');
            };

            // Helper: draw a rounded rect
            const fillRoundRect = (x, y, w, h, r, color) => {
                pdf.setFillColor(...hex(color));
                pdf.roundedRect(x, y, w, h, r, r, 'F');
            };

            // Helper: load an image into an HTMLImageElement (to get dimensions)
            const loadImg = (src) => new Promise((resolve) => {
                const img = new Image();
                img.onload = () => resolve(img);
                img.onerror = () => resolve(null);
                img.src = src;
            });

            // Helper: add image with cover-crop behavior
            // Pre-crops the image on an offscreen canvas, then adds it to the PDF.
            // This avoids jsPDF clip() which breaks subsequent drawing operations.
            const addImageCover = async (src, slotX, slotY, slotW, slotH) => {
                if (!src) return;
                const img = await loadImg(src);
                if (!img) return;

                // Create offscreen canvas at high resolution for the slot
                const pxPerMm = 4; // resolution multiplier
                const canvasW = Math.round(slotW * pxPerMm);
                const canvasH = Math.round(slotH * pxPerMm);
                const canvas = document.createElement('canvas');
                canvas.width = canvasW;
                canvas.height = canvasH;
                const ctx = canvas.getContext('2d');

                // Calculate cover-crop: fill canvas while maintaining aspect ratio
                const imgRatio = img.naturalWidth / img.naturalHeight;
                const slotRatio = canvasW / canvasH;

                let sx, sy, sw, sh;
                if (imgRatio > slotRatio) {
                    // Image is wider — crop sides
                    sh = img.naturalHeight;
                    sw = sh * slotRatio;
                    sx = (img.naturalWidth - sw) / 2;
                    sy = 0;
                } else {
                    // Image is taller — crop top/bottom
                    sw = img.naturalWidth;
                    sh = sw / slotRatio;
                    sx = 0;
                    sy = (img.naturalHeight - sh) / 2;
                }

                ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvasW, canvasH);
                const croppedDataUrl = canvas.toDataURL('image/jpeg', 0.92);
                pdf.addImage(croppedDataUrl, 'JPEG', slotX, slotY, slotW, slotH);
            };

            const pages = [page1, page2].filter(p => p.length > 0);

            for (let pageIdx = 0; pageIdx < pages.length; pageIdx++) {
                const pageWeeds = pages[pageIdx];
                if (pageIdx > 0) pdf.addPage();

                // ── Page background ──
                fillRect(0, 0, W, H, TEAL_BG);

                // ── Header ──
                let headerH;
                if (pageIdx === 0) {
                    // Page 1: full header
                    headerH = 52;
                    fillRect(0, 0, W, headerH, TEAL_DARK);

                    // Group name
                    pdf.setFont('helvetica', 'normal');
                    pdf.setFontSize(9);
                    pdf.setTextColor(255, 255, 255);
                    pdf.text((groupName || 'Upper Wimmera Landcare').toUpperCase(), margin + 2, 14);

                    // Title
                    pdf.setFont('helvetica', 'bold');
                    pdf.setFontSize(22);
                    pdf.text('Priority Weeds in Our Region', margin + 2, 28);

                    // Subtitle
                    pdf.setFont('helvetica', 'normal');
                    pdf.setFontSize(10);
                    pdf.setTextColor(220, 220, 220);
                    pdf.text('We need your help to track down these invasive plants!', margin + 2, 37);
                    pdf.text('If you spot any of these weeds, please report to your local Landcare group.', margin + 2, 43);

                    // "Top N" badge
                    const badgeW = 32, badgeH = 28;
                    const badgeX = W - margin - badgeW;
                    fillRoundRect(badgeX, 9, badgeW, badgeH, 4, '#1a6b6a');
                    pdf.setFont('helvetica', 'bold');
                    pdf.setFontSize(12);
                    pdf.setTextColor(255, 255, 255);
                    pdf.text(`Top ${topWeeds.length}`, badgeX + badgeW / 2, 21, { align: 'center' });
                    pdf.setFontSize(9);
                    pdf.setFont('helvetica', 'normal');
                    pdf.text('Priority', badgeX + badgeW / 2, 28, { align: 'center' });
                    pdf.text('Weeds', badgeX + badgeW / 2, 34, { align: 'center' });
                } else {
                    // Page 2+: compact header
                    headerH = 28;
                    fillRect(0, 0, W, headerH, TEAL_DARK);
                    pdf.setFont('helvetica', 'normal');
                    pdf.setFontSize(8);
                    pdf.setTextColor(180, 180, 180);
                    pdf.text('PROJECT PLATYPUS', margin + 2, 12);
                    pdf.setFont('helvetica', 'bold');
                    pdf.setFontSize(16);
                    pdf.setTextColor(255, 255, 255);
                    pdf.text('Priority Weeds \u2014 continued', margin + 2, 22);
                    pdf.setFont('helvetica', 'normal');
                    pdf.setFontSize(9);
                    pdf.setTextColor(180, 180, 180);
                    pdf.text(`Page ${pageIdx + 1} of ${totalPages}`, W - margin - 2, 22, { align: 'right' });
                }

                // ── Footer ──
                const footerH = 14;
                const footerY = H - footerH;
                fillRect(0, footerY, W, footerH, TEAL_DARK);
                pdf.setFont('helvetica', 'normal');
                pdf.setFontSize(7);
                pdf.setTextColor(160, 160, 160);
                const dateStr = new Date().toLocaleDateString('en-AU', { month: 'long', year: 'numeric' });
                pdf.text(`Photos: iNaturalist \u00B7 Data: Weeds Australia \u00B7 ${dateStr}`, margin + 2, footerY + 9);
                pdf.text('projectplatypus.org.au', W - margin - 2, footerY + 9, { align: 'right' });

                // ── Card grid: 2 columns × 2 rows ──
                const gridTop = headerH + gap;
                const gridBottom = footerY - gap;
                const gridH = gridBottom - gridTop;
                const colW = (W - margin * 2 - gap) / 2;
                const rowH = (gridH - gap) / 2;
                const nameBarH = 18;
                const photoGap = 1.5;

                for (let ci = 0; ci < pageWeeds.length; ci++) {
                    const weed = pageWeeds[ci];
                    const rank = pageIdx * 4 + ci + 1;
                    const col = ci % 2;
                    const row = Math.floor(ci / 2);
                    const cardX = margin + col * (colW + gap);
                    const cardY = gridTop + row * (rowH + gap);

                    // Card background
                    fillRoundRect(cardX, cardY, colW, rowH, 3, CARD_BG);

                    // ── Name bar ──
                    fillRoundRect(cardX, cardY, colW, nameBarH, 3, TEAL_HEADER);
                    // Square off bottom corners of name bar
                    fillRect(cardX, cardY + nameBarH - 3, colW, 3, TEAL_HEADER);

                    // Weed name text
                    pdf.setFont('helvetica', 'bold');
                    pdf.setFontSize(10);
                    pdf.setTextColor(255, 255, 255);
                    const nameMaxW = colW - 24; // leave room for rank badge
                    const displayName = pdf.splitTextToSize(weed.name, nameMaxW)[0]; // first line only
                    pdf.text(displayName, cardX + 5, cardY + 8);

                    // Scientific name
                    if (weed.scientificName) {
                        pdf.setFont('helvetica', 'italic');
                        pdf.setFontSize(7);
                        pdf.setTextColor(180, 210, 210);
                        const sciDisplay = pdf.splitTextToSize(weed.scientificName, nameMaxW)[0];
                        pdf.text(sciDisplay, cardX + 5, cardY + 14);
                    }

                    // Rank badge
                    const badgeR = 5.5;
                    const badgeCx = cardX + colW - 10;
                    const badgeCy = cardY + nameBarH / 2;
                    const scoreColor = getScoreColor(weed.finalScore);
                    pdf.setFillColor(...hex(scoreColor));
                    pdf.circle(badgeCx, badgeCy, badgeR, 'F');
                    pdf.setFont('helvetica', 'bold');
                    pdf.setFontSize(10);
                    pdf.setTextColor(255, 255, 255);
                    pdf.text(String(rank), badgeCx, badgeCy + 1.2, { align: 'center' });

                    // ── Photo grid: 1 large (left 58%) + 2 stacked small (right 40%) ──
                    const photoTop = cardY + nameBarH + 1;
                    const photoBottom = cardY + rowH - 1;
                    const photoH = photoBottom - photoTop;
                    const photoLeft = cardX + 1;
                    const photoTotalW = colW - 2;
                    const mainW = photoTotalW * 0.58;
                    const sideW = photoTotalW - mainW - photoGap;
                    const sideH = (photoH - photoGap) / 2;

                    const weedPhotos = photos[weed.name] || [];

                    // Main photo (left)
                    if (weedPhotos[0]) {
                        await addImageCover(weedPhotos[0].url, photoLeft, photoTop, mainW, photoH);
                    } else {
                        fillRect(photoLeft, photoTop, mainW, photoH, '#334155');
                    }

                    // Top-right photo
                    const sideX = photoLeft + mainW + photoGap;
                    if (weedPhotos[1]) {
                        await addImageCover(weedPhotos[1].url, sideX, photoTop, sideW, sideH);
                    } else {
                        fillRect(sideX, photoTop, sideW, sideH, '#475569');
                    }

                    // Bottom-right photo
                    const bottomSideY = photoTop + sideH + photoGap;
                    if (weedPhotos[2]) {
                        await addImageCover(weedPhotos[2].url, sideX, bottomSideY, sideW, sideH);
                    } else {
                        fillRect(sideX, bottomSideY, sideW, sideH, '#475569');
                    }
                }
            }

            pdf.save('weed-priority-brochure.pdf');
        } catch (e) {
            console.error('PDF generation failed:', e);
            alert('PDF generation failed: ' + (e.message || e) + '\n\nTry using Print instead.');
        }
        setGenerating(false);
    };

    /* ── Individual weed card ── */
    const WeedCard = ({ weed, rank, generating, onRemovePhoto }) => {
        const weedPhotos = photos[weed.name] || [];

        // Data is already merged into the weed object by scoredWeeds logic
        const scientificName = weed.scientificName || '';
        const growthForm = weed.growthForm || '—';
        const flowerColour = weed.flowerColour || '—';
        const size = weed.size || '—';

        const overallColor = getScoreColor(weed.finalScore);

        const scoreItems = [
            { label: 'Ext', value: weed.scores.extent },
            { label: 'Imp', value: weed.scores.impact },
            { label: 'Inv', value: weed.scores.invasiveness },
            { label: 'Hab', value: weed.scores.habitat },
            { label: 'Ctrl', value: weed.scores.control }
        ];

        return (
            <div style={{
                background: CARD_BG,
                borderRadius: '6px',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                height: '100%'
            }}>
                {/* Name header with rank badge and overall score */}
                <div style={{
                    background: TEAL_HEADER,
                    padding: '6px 10px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                }}>

                    {/* Names */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                            fontSize: '15px', fontWeight: 800, color: 'white',
                            lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                        }}>{weed.name}</div>
                        {scientificName && (
                            <div style={{
                                fontSize: '11px', fontStyle: 'italic', color: 'rgba(255,255,255,0.6)',
                                lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                            }}>{scientificName}</div>
                        )}
                    </div>
                    {/* Overall score pill replaced with Rank */}
                    <div style={{
                        background: overallColor, color: 'white',
                        borderRadius: '12px', padding: '2px 10px',
                        fontSize: '14px', fontWeight: 800, flexShrink: 0,
                        letterSpacing: '0.5px'
                    }}>{rank}</div>
                </div>

                {/* Photo grid — 1 large + 2 smaller */}
                {/* Using background-image instead of <img> because html2canvas
                    does NOT support object-fit:cover on <img> elements */}
                <div style={{
                    display: 'flex', gap: '2px', padding: '2px',
                    background: TEAL_HEADER, flex: '1 1 55%', overflow: 'hidden', minHeight: 0
                }}>
                    {/* Main photo */}
                    <div className="group" style={{ flex: '1 1 58%', minHeight: 0, position: 'relative' }}>
                        {weedPhotos[0] ? (
                            <>
                                <div
                                    role="img"
                                    aria-label={weed.name}
                                    style={{
                                        width: '100%', height: '100%',
                                        backgroundImage: `url(${weedPhotos[0].url})`,
                                        backgroundSize: 'cover',
                                        backgroundPosition: 'center',
                                        borderRadius: '2px'
                                    }}
                                />
                                {!generating && (
                                    <button
                                        onClick={() => onRemovePhoto(weed.name, weedPhotos[0].url)}
                                        className="absolute top-1 right-1 bg-black/50 hover:bg-red-500 text-white w-6 h-6 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs font-bold"
                                        title="Remove photo"
                                    >
                                        ✕
                                    </button>
                                )}
                            </>
                        ) : (
                            <div style={{
                                width: '100%', height: '100%', background: '#334155',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: '#64748b', fontSize: '13px', borderRadius: '2px'
                            }}>No photo</div>
                        )}
                    </div>
                    {/* Two stacked smaller photos */}
                    <div style={{ flex: '0 0 40%', display: 'flex', flexDirection: 'column', gap: '2px', minHeight: 0 }}>
                        {[1, 2].map(i => (
                            <div key={i} className="group" style={{ flex: 1, minHeight: 0, position: 'relative' }}>
                                {weedPhotos[i] ? (
                                    <>
                                        <div
                                            role="img"
                                            aria-label={`${weed.name} ${i + 1}`}
                                            style={{
                                                width: '100%', height: '100%',
                                                backgroundImage: `url(${weedPhotos[i].url})`,
                                                backgroundSize: 'cover',
                                                backgroundPosition: 'center',
                                                borderRadius: '2px',
                                                position: 'absolute', top: 0, left: 0
                                            }}
                                        />
                                        {!generating && (
                                            <button
                                                onClick={() => onRemovePhoto(weed.name, weedPhotos[i].url)}
                                                className="absolute top-1 right-1 bg-black/50 hover:bg-red-500 text-white w-5 h-5 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-[10px] font-bold"
                                                title="Remove photo"
                                            >
                                                ✕
                                            </button>
                                        )}
                                    </>
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


            </div>
        );
    };

    /* ── Page layout ── */
    const PageContent = ({ weedsList, pageNum, totalPages }) => {
        const startRank = (pageNum - 1) * 4;
        return (
            <div data-page={pageNum} style={{
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
                                    Project Platypus — {groupName || 'Upper Wimmera Landcare'}
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
                )
                }

                {/* ── 2×2 card grid ── */}
                <div style={{
                    flex: 1,
                    padding: '12px 16px',
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gridTemplateRows: '1fr 1fr',
                    gap: '10px'
                }}>
                    {weedsList.map((weed, i) => (
                        <WeedCard
                            key={weed.id}
                            weed={weed}
                            rank={startRank + i + 1}
                            generating={generating}
                            onRemovePhoto={handleRemovePhoto}
                        />
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
            </div >
        );
    };

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
