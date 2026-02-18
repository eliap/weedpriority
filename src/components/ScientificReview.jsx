import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import governmentDataRaw from '../data/realGovernmentData.json';
import { valueCategories } from '../data/valuesData';
import { invasivenessCategories } from '../data/invasivenessData';
import scrapedData from '../data/weed_assessments.json';


// Merge scraped data into government data, prioritizing scraped data
const governmentData = { ...governmentDataRaw };
Object.keys(scrapedData).forEach(key => {
    if (governmentData[key]) {
        governmentData[key] = {
            ...governmentData[key],
            impact: { ...governmentData[key].impact, ...scrapedData[key].impact },
            invasiveness: { ...governmentData[key].invasiveness, ...scrapedData[key].invasiveness }
        };
    } else {
        governmentData[key] = scrapedData[key];
    }
});

const GRADES = ["L", "ML", "M", "MH", "H"];

// Simple Info Icon Component with Tooltip behavior using Portal to avoid clipping
const InfoIcon = ({ comment }) => {
    const [show, setShow] = useState(false);
    const [coords, setCoords] = useState({ top: 0, left: 0, isTop: false });
    const buttonRef = useRef(null);

    if (!comment) return null;

    const updatePosition = (e) => {
        // Use cursor coordinates if available, otherwise fallback to element rect
        if (e && e.clientX !== undefined) {
            const x = e.clientX;
            const y = e.clientY;
            const viewportHeight = window.innerHeight;
            const viewportWidth = window.innerWidth;

            let top = y + 20; // Default below cursor
            let left = x;
            let isTop = false;

            // If getting close to bottom, lose some clearance
            if (top + 100 > viewportHeight) {
                top = y - 10;
                isTop = true;
            }

            // Clamp left/right to keep in viewport (assuming approx 256px width)
            if (left + 128 > viewportWidth) left = viewportWidth - 140;
            if (left - 128 < 0) left = 140;

            setCoords({ top, left, isTop });
        } else if (buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            setCoords({
                top: rect.bottom + 8 + window.scrollY,
                left: rect.left + window.scrollX,
                isTop: false
            });
        }
    };

    const handleMouseEnter = (e) => {
        updatePosition(e);
        setShow(true);
    };

    const handleMouseMove = (e) => {
        if (show) updatePosition(e);
    };

    return (
        <div className="relative inline-block ml-1">
            <button
                ref={buttonRef}
                type="button"
                className="text-teal-600 hover:text-teal-800 focus:outline-none align-middle"
                onClick={(e) => { e.stopPropagation(); setShow(!show); if (!show) updatePosition(e); }}
                onMouseEnter={handleMouseEnter}
                onMouseMove={handleMouseMove}
                onMouseLeave={() => setShow(false)}
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="16" x2="12" y2="12"></line>
                    <line x1="12" y1="8" x2="12.01" y2="8"></line>
                </svg>
            </button>
            {show && createPortal(
                <div
                    className="fixed z-[9999] w-64 bg-slate-800 text-white text-xs rounded p-3 shadow-xl pointer-events-none"
                    style={{
                        top: coords.top,
                        left: coords.left,
                        transform: `translate(-50%, ${coords.isTop ? '-100%' : '0'})`
                    }}
                >
                    {comment}
                </div>,
                document.body
            )}
        </div>
    );
};

export default function ScientificReview({ weeds, setWeeds, selectedValues }) {
    const navigate = useNavigate();
    const [expandedWeed, setExpandedWeed] = useState(null);

    // Initialize review data structure if missing
    useEffect(() => {
        let hasChanges = false;
        const updatedWeeds = weeds.map(weed => {
            if (weed.scientificReview?.detailed) return weed;

            hasChanges = true;
            const govInfo = governmentData[weed.name] || { impact: {}, invasiveness: {}, notes: "" };

            return {
                ...weed,
                scientificReview: {
                    detailed: {
                        impact: {},       // Will hold { rating: "", confidence: "", reason: "" } keyed by category ID
                        invasiveness: {}  // Same structure
                    },
                    govData: govInfo
                }
            };
        });

        if (hasChanges) {
            setWeeds(updatedWeeds);
        }
    }, [weeds, setWeeds]);

    const toggleExpand = (id) => {
        setExpandedWeed(expandedWeed === id ? null : id);
    };

    const handleDetailedChange = (weedId, type, itemId, field, value) => {
        setWeeds(weeds.map(weed => {
            if (weed.id !== weedId) return weed;

            const currentDetail = weed.scientificReview.detailed[type][itemId] || { rating: "", confidence: "", reason: "" };

            return {
                ...weed,
                scientificReview: {
                    ...weed.scientificReview,
                    detailed: {
                        ...weed.scientificReview.detailed,
                        [type]: {
                            ...weed.scientificReview.detailed[type],
                            [itemId]: { ...currentDetail, [field]: value }
                        }
                    }
                }
            };
        }));
    };

    // Helper to render a grade dropdown
    const GradeSelect = ({ value, onChange, placeholder = "-" }) => (
        <select
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
            className={`w-20 rounded-md border-gray-300 shadow-sm focus:border-teal-500 focus:ring-teal-500 sm:text-xs p-1 ${value ? 'font-bold bg-white' : 'text-gray-400 bg-slate-50'}`}
        >
            <option value="">{placeholder}</option>
            {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
    );

    return (
        <div className="max-w-7xl mx-auto p-6">
            <div className="mb-8">
                <h2 className="font-amatic text-4xl text-teal-800 font-bold mb-4">Step 3: Scientific Review</h2>
                <p className="text-slate-600 mb-4 max-w-3xl">
                    Review the detailed government breakdown for <strong>Impact</strong> and <strong>Invasiveness</strong> using the
                    <strong> L (Low) to H (High)</strong> grading scale. You can also assign a confidence level to each rating.
                    Items filtered out in Step 1 are hidden.
                </p>
            </div>

            <div className="space-y-4">
                {weeds.map((weed) => {
                    const isExpanded = expandedWeed === weed.id;
                    const govData = weed.scientificReview?.govData || { impact: {}, invasiveness: {} };
                    const userReview = weed.scientificReview?.detailed || { impact: {}, invasiveness: {} };

                    return (
                        <div key={weed.id} className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden transition-all">
                            <div
                                onClick={() => toggleExpand(weed.id)}
                                className={`px-6 py-4 flex justify-between items-center cursor-pointer hover:bg-slate-50 ${isExpanded ? 'bg-teal-50 border-b border-teal-100' : ''}`}
                            >
                                <h3 className="text-lg font-bold text-teal-900">{weed.name}</h3>
                                <span className="text-slate-500 text-sm">{isExpanded ? 'Hide Details' : 'Show Details'}</span>
                            </div>

                            {isExpanded && (
                                <div className="p-6 bg-slate-50/50">

                                    {/* IMPACT SECTION */}
                                    <h4 className="font-amatic text-2xl text-teal-800 font-bold mb-4 border-b pb-2">Criteria 1: Impact</h4>
                                    <div className="overflow-x-auto mb-8">
                                        <table className="min-w-full divide-y divide-gray-200">
                                            <thead className="bg-white">
                                                <tr>
                                                    <th className="px-4 py-2 text-left text-xs font-bold text-slate-500 uppercase w-1/3">Impact Criteria</th>
                                                    <th className="px-4 py-2 text-center text-xs font-bold text-slate-500 uppercase bg-slate-100/50">Gov Rating / Conf</th>
                                                    <th className="px-4 py-2 text-center text-xs font-bold text-teal-700 uppercase bg-teal-50/50">Local Rating</th>
                                                    <th className="px-4 py-2 text-center text-xs font-bold text-teal-700 uppercase bg-teal-50/50">Local Conf</th>
                                                    <th className="px-4 py-2 text-left text-xs font-bold text-slate-500 uppercase w-1/4">Reason (if diff)</th>
                                                </tr>
                                            </thead>
                                            <tbody className="bg-white divide-y divide-gray-200">
                                                {valueCategories.map(cat =>
                                                    cat.items.filter(item => selectedValues[item.id]).map(item => {
                                                        const govItem = govData.impact[item.id] || {};
                                                        const userItem = userReview.impact[item.id] || {};
                                                        return (
                                                            <tr key={item.id}>
                                                                <td className="px-4 py-3 text-sm text-slate-700">
                                                                    <span className="text-xs font-bold text-slate-400 block mb-0.5">{cat.title}</span>
                                                                    {item.label}
                                                                </td>
                                                                <td className="px-4 py-3 text-center bg-slate-50/30">
                                                                    <div className="flex justify-center items-center gap-1 relative">
                                                                        <span className={`px-2 py-1 rounded text-xs font-bold ${govItem.rating ? 'bg-slate-200 text-slate-700' : 'text-slate-300'}`}>{govItem.rating || '-'}</span>
                                                                        <span className="text-slate-300">/</span>
                                                                        <span className={`px-2 py-1 rounded text-xs font-medium ${govItem.confidence ? 'bg-slate-100 text-slate-600' : 'text-slate-300'}`}>{govItem.confidence || '-'}</span>
                                                                        <InfoIcon comment={govItem.comments} />
                                                                    </div>
                                                                </td>
                                                                <td className="px-4 py-3 text-center bg-teal-50/10">
                                                                    <div className="flex justify-center">
                                                                        <GradeSelect
                                                                            value={userItem.rating}
                                                                            onChange={(val) => handleDetailedChange(weed.id, 'impact', item.id, 'rating', val)}
                                                                        />
                                                                    </div>
                                                                </td>
                                                                <td className="px-4 py-3 text-center bg-teal-50/10">
                                                                    <div className="flex justify-center">
                                                                        <GradeSelect
                                                                            value={userItem.confidence}
                                                                            onChange={(val) => handleDetailedChange(weed.id, 'impact', item.id, 'confidence', val)}
                                                                            placeholder="Conf"
                                                                        />
                                                                    </div>
                                                                </td>
                                                                <td className="px-4 py-3">
                                                                    <input
                                                                        type="text"
                                                                        placeholder={userItem.rating && userItem.rating !== govItem.rating ? "Why?" : ""}
                                                                        value={userItem.reason || ""}
                                                                        onChange={(e) => handleDetailedChange(weed.id, 'impact', item.id, 'reason', e.target.value)}
                                                                        className="w-full text-xs border-slate-200 rounded focus:border-teal-500 focus:ring-teal-500"
                                                                    />
                                                                </td>
                                                            </tr>
                                                        );
                                                    })
                                                )}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* INVASIVENESS SECTION */}
                                    <h4 className="font-amatic text-2xl text-teal-800 font-bold mb-4 border-b pb-2">Criteria 3: Invasiveness</h4>
                                    <div className="overflow-x-auto">
                                        <table className="min-w-full divide-y divide-gray-200">
                                            <thead className="bg-white">
                                                <tr>
                                                    <th className="px-4 py-2 text-left text-xs font-bold text-slate-500 uppercase w-1/3">Invasiveness Criteria</th>
                                                    <th className="px-4 py-2 text-center text-xs font-bold text-slate-500 uppercase bg-slate-100/50">Gov Rating / Conf</th>
                                                    <th className="px-4 py-2 text-center text-xs font-bold text-teal-700 uppercase bg-teal-50/50">Local Rating</th>
                                                    <th className="px-4 py-2 text-center text-xs font-bold text-teal-700 uppercase bg-teal-50/50">Local Conf</th>
                                                    <th className="px-4 py-2 text-left text-xs font-bold text-slate-500 uppercase w-1/4">Reason (if diff)</th>
                                                </tr>
                                            </thead>
                                            <tbody className="bg-white divide-y divide-gray-200">
                                                {invasivenessCategories.map(cat =>
                                                    cat.items.map(item => {
                                                        const govItem = govData.invasiveness[item.id] || {};
                                                        const userItem = userReview.invasiveness[item.id] || {};
                                                        return (
                                                            <tr key={item.id}>
                                                                <td className="px-4 py-3 text-sm text-slate-700">
                                                                    <span className="text-xs font-bold text-slate-400 block mb-0.5">{cat.title}</span>
                                                                    {item.label}
                                                                </td>
                                                                <td className="px-4 py-3 text-center bg-slate-50/30">
                                                                    <div className="flex justify-center items-center gap-1 relative">
                                                                        <span className={`px-2 py-1 rounded text-xs font-bold ${govItem.rating ? 'bg-slate-200 text-slate-700' : 'text-slate-300'}`}>{govItem.rating || '-'}</span>
                                                                        <span className="text-slate-300">/</span>
                                                                        <span className={`px-2 py-1 rounded text-xs font-medium ${govItem.confidence ? 'bg-slate-100 text-slate-600' : 'text-slate-300'}`}>{govItem.confidence || '-'}</span>
                                                                        <InfoIcon comment={govItem.comments} />
                                                                    </div>
                                                                </td>
                                                                <td className="px-4 py-3 text-center bg-teal-50/10">
                                                                    <div className="flex justify-center">
                                                                        <GradeSelect
                                                                            value={userItem.rating}
                                                                            onChange={(val) => handleDetailedChange(weed.id, 'invasiveness', item.id, 'rating', val)}
                                                                        />
                                                                    </div>
                                                                </td>
                                                                <td className="px-4 py-3 text-center bg-teal-50/10">
                                                                    <div className="flex justify-center">
                                                                        <GradeSelect
                                                                            value={userItem.confidence}
                                                                            onChange={(val) => handleDetailedChange(weed.id, 'invasiveness', item.id, 'confidence', val)}
                                                                            placeholder="Conf"
                                                                        />
                                                                    </div>
                                                                </td>
                                                                <td className="px-4 py-3">
                                                                    <input
                                                                        type="text"
                                                                        placeholder={userItem.rating && userItem.rating !== govItem.rating ? "Why?" : ""}
                                                                        value={userItem.reason || ""}
                                                                        onChange={(e) => handleDetailedChange(weed.id, 'invasiveness', item.id, 'reason', e.target.value)}
                                                                        className="w-full text-xs border-slate-200 rounded focus:border-teal-500 focus:ring-teal-500"
                                                                    />
                                                                </td>
                                                            </tr>
                                                        );
                                                    })
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            <div className="mt-10 flex justify-between">
                <button
                    onClick={() => navigate('/step-2')}
                    className="px-6 py-3 border border-slate-300 text-slate-600 hover:bg-slate-50 font-medium rounded-lg transition-colors"
                >
                    &larr; Back to Step 2
                </button>
                <button
                    onClick={() => navigate('/step-4')}
                    className="px-8 py-3 bg-teal-600 text-white font-bold rounded-lg shadow-md hover:bg-teal-700 hover:shadow-lg transition-all transform hover:-translate-y-0.5"
                >
                    View Final Results (Step 4)
                </button>
            </div>
        </div>
    );
}
