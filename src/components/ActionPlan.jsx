import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { valueCategories } from '../data/valuesData';
import { invasivenessCategories } from '../data/invasivenessData';
import governmentDataRaw from '../data/realGovernmentData.json';
import scrapedData from '../data/weed_assessments.json';

// Merge scraped data into government data, prioritizing scraped data
const governmentData = { ...governmentDataRaw };
Object.keys(scrapedData).forEach(key => {
    if (governmentData[key]) {
        governmentData[key] = {
            ...governmentData[key],
            impact: { ...governmentData[key].impact || {}, ...scrapedData[key].impact || {} },
            invasiveness: { ...governmentData[key].invasiveness || {}, ...scrapedData[key].invasiveness || {} }
        };
    } else {
        governmentData[key] = scrapedData[key];
    }
});

// Scoring Constants
const RATING_VALUES = { "L": 1, "ML": 2, "M": 3, "MH": 4, "H": 5 };
const CONFIDENCE_VALUES = { "L": 0.2, "ML": 0.4, "M": 0.6, "MH": 0.8, "H": 1.0 };

const calculateCategoryScore = (items, userReviews, govReviews, selectedIds = null) => {
    let totalScore = 0;
    let totalScoreMax = 0;
    let maxPossibleScore = 0;
    let maxPossibleScoreMax = 0;
    let itemsWithData = 0;
    let totalEligibleItems = 0;

    items.forEach(item => {
        if (selectedIds && !selectedIds[item.id]) return;
        totalEligibleItems++;

        const govItem = govReviews[item.id] || {};
        const userItem = userReviews[item.id] || {};

        const finalRatingStr = userItem.rating || govItem.rating;
        const finalConfStr = userItem.confidence || govItem.confidence;

        if (finalRatingStr) {
            const ratingVal = RATING_VALUES[finalRatingStr] || 0;
            const confVal = CONFIDENCE_VALUES[finalConfStr] || 0.5;

            totalScore += (ratingVal * confVal);
            totalScoreMax += ratingVal;
            maxPossibleScore += (5 * 1.0);
            maxPossibleScoreMax += 5;
            itemsWithData++;
        }
    });

    return {
        scaled: maxPossibleScore > 0 ? (totalScore / maxPossibleScore) * 100 : 0,
        unscaled: maxPossibleScoreMax > 0 ? (totalScoreMax / maxPossibleScoreMax) * 100 : 0,
        hasData: itemsWithData > 0,
        itemsWithData,
        totalEligibleItems
    };
};

// Control level to score: Level 4 (easy) = 100, Level 1 (unlikely) = 25
// Formula: controlLevel × 25

export default function ActionPlan({ weeds, setWeeds, selectedValues }) {
    const navigate = useNavigate();

    // Dynamic weights (default 20% each for 5 criteria)
    const [weights, setWeights] = useState({
        extent: 20,
        impact: 20,
        invasiveness: 20,
        habitat: 20,
        control: 20
    });

    // Sort by weighted or unweighted total
    const [sortBy, setSortBy] = useState('final');

    const updateWeight = (key, value) => {
        setWeights(prev => ({ ...prev, [key]: Number(value) }));
    };

    const totalWeight = weights.extent + weights.impact + weights.invasiveness + weights.habitat + weights.control;

    // Calculate Scores
    const scoredWeeds = useMemo(() => {
        return weeds.map(weed => {
            const govWeedData = governmentData[weed.name] || { impact: {}, invasiveness: {} };
            const userReview = weed.scientificReview?.detailed || { impact: {}, invasiveness: {} };

            // 1. Impact Score (filtered by Step 1)
            const allImpactItems = valueCategories.flatMap(cat => cat.items);
            const impactResult = calculateCategoryScore(
                allImpactItems,
                userReview.impact || {},
                govWeedData.impact || {},
                selectedValues
            );

            // 2. Invasiveness Score
            const allInvItems = invasivenessCategories.flatMap(cat => cat.items);
            const invasivenessResult = calculateCategoryScore(
                allInvItems,
                userReview.invasiveness || {},
                govWeedData.invasiveness || {}
            );

            // 3. Extent Score (1-5 → 20-100)
            const extentVal = Number(weed.extent) || 1;
            const extentScore = extentVal * 20;

            // 4. Habitat Score (1=50, 2=100)
            const habitatVal = Number(weed.habitat) || 1;
            const habitatScore = habitatVal === 2 ? 100 : 50;

            // 5. Control Score (Level 1–4 → 25–100, value × 25)
            const controlScore = (weed.controlLevel || 2) * 25;

            // Build criteria list, tracking which have data
            const criteria = [
                { key: 'extent', score: extentScore, scoreUw: extentScore, hasData: true },
                { key: 'impact', score: impactResult.scaled, scoreUw: impactResult.unscaled, hasData: impactResult.hasData },
                { key: 'invasiveness', score: invasivenessResult.scaled, scoreUw: invasivenessResult.unscaled, hasData: invasivenessResult.hasData },
                { key: 'habitat', score: habitatScore, scoreUw: habitatScore, hasData: true },
                { key: 'control', score: controlScore, scoreUw: controlScore, hasData: true }
            ];

            // Only include criteria that have data in the weighted average
            const activeCriteria = criteria.filter(c => c.hasData);
            const activeWeight = activeCriteria.reduce((sum, c) => sum + weights[c.key], 0);
            const knowledgeGaps = criteria.filter(c => !c.hasData).map(c => c.key);

            // Weighted Total (redistribute weight across active criteria)
            const normActive = activeWeight > 0 ? activeWeight / 100 : 1;
            const finalScore = activeCriteria.reduce((sum, c) =>
                sum + (c.score * weights[c.key] / 100), 0
            ) / normActive;

            const finalScoreUnweighted = activeCriteria.reduce((sum, c) =>
                sum + (c.scoreUw * weights[c.key] / 100), 0
            ) / normActive;

            return {
                ...weed,
                scores: {
                    impact: impactResult.hasData ? impactResult.scaled : null,
                    impactUnweighted: impactResult.hasData ? impactResult.unscaled : null,
                    impactCount: `${impactResult.itemsWithData}/${impactResult.totalEligibleItems}`,
                    impactPartial: impactResult.hasData && impactResult.itemsWithData < impactResult.totalEligibleItems,
                    invasiveness: invasivenessResult.hasData ? invasivenessResult.scaled : null,
                    invasivenessUnweighted: invasivenessResult.hasData ? invasivenessResult.unscaled : null,
                    invasivenessCount: `${invasivenessResult.itemsWithData}/${invasivenessResult.totalEligibleItems}`,
                    invasivenessPartial: invasivenessResult.hasData && invasivenessResult.itemsWithData < invasivenessResult.totalEligibleItems,
                    extent: extentScore,
                    habitat: habitatScore,
                    control: controlScore,
                    final: finalScore,
                    finalUnweighted: finalScoreUnweighted,
                    knowledgeGaps
                }
            };
        }).sort((a, b) => b.scores[sortBy] - a.scores[sortBy]);
    }, [weeds, selectedValues, weights, totalWeight, sortBy]);

    return (
        <div className="max-w-7xl mx-auto p-6">
            <div className="mb-8">
                <h2 className="font-amatic text-4xl text-teal-800 font-bold mb-4">Step 5: Prioritised Weed List</h2>
                <p className="text-slate-600 mb-4 max-w-3xl">
                    Final scores for each weed are calculated from the five criteria below. You can adjust the weighting of each criterion. Higher score = higher priority.
                    You can also sort your weeds by a "weighted total", which scales each impact by the confidence level, or an "unweighted total" which ignores all confidence ratings.
                    Any species which lacked ratings for impact or invasiveness are tagged with a 'gap' icon to remind you the priority list is based on incomplete information.
                </p>
            </div>

            {/* Weighting Controls */}
            <div className="mb-8 bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-4">
                    Score Weightings
                    <span className={`ml-2 text-xs font-normal ${totalWeight === 100 ? 'text-green-600' : 'text-red-600'}`}>
                        (Total: {totalWeight}%{totalWeight !== 100 ? ' — should equal 100%' : ' ✓'})
                    </span>
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
                    {[
                        { key: 'extent', label: 'Extent' },
                        { key: 'impact', label: 'Impact' },
                        { key: 'invasiveness', label: 'Invasiveness' },
                        { key: 'habitat', label: 'Habitat' },
                        { key: 'control', label: 'Control' }
                    ].map(({ key, label }) => (
                        <div key={key} className="flex flex-col items-center">
                            <label className="text-xs font-medium text-slate-600 mb-1">{label}</label>
                            <input
                                type="number"
                                min="0"
                                max="100"
                                value={weights[key]}
                                onChange={(e) => updateWeight(key, e.target.value)}
                                className="w-20 text-center rounded-md border-gray-300 shadow-sm focus:border-teal-500 focus:ring-teal-500 text-sm p-2 border font-bold"
                            />
                            <span className="text-[10px] text-slate-400 mt-1">%</span>
                        </div>
                    ))}
                </div>
                <p className="text-xs text-slate-400 mt-3">
                    Tip: VRO method uses 32% extent, 56% impact, 12% invasiveness. Adjust to your group's priorities.
                </p>
            </div>

            {/* Results Table */}
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead>
                            <tr className="bg-slate-100">
                                <th rowSpan="2" className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider border-b border-r border-slate-200">
                                    Weed Name
                                </th>
                                <th rowSpan="2" className={`px-3 py-3 text-center text-xs font-bold uppercase tracking-wider border-b border-r border-slate-200 cursor-pointer select-none transition-colors ${sortBy === 'final' ? 'text-teal-800 bg-teal-100' : 'text-teal-600 bg-teal-50 hover:bg-teal-100'}`} onClick={() => setSortBy('final')}>
                                    Weighted<br />Total {sortBy === 'final' && '▼'}
                                </th>
                                <th rowSpan="2" className={`px-3 py-3 text-center text-xs font-bold uppercase tracking-wider border-b border-r border-slate-200 cursor-pointer select-none transition-colors ${sortBy === 'finalUnweighted' ? 'text-amber-800 bg-amber-100' : 'text-amber-600 bg-amber-50 hover:bg-amber-100'}`} onClick={() => setSortBy('finalUnweighted')}>
                                    Unweighted<br />Total {sortBy === 'finalUnweighted' && '▼'}
                                </th>
                                <th rowSpan="2" className="px-3 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-r border-slate-200">
                                    Gut Feel
                                </th>
                                <th colSpan="7" className="px-3 py-2 text-center text-xs font-bold text-slate-600 uppercase tracking-wider border-b border-slate-200 bg-slate-50">
                                    Scores by Criteria (Weighted / Unweighted)
                                </th>
                            </tr>
                            <tr className="bg-slate-50">
                                <th className="px-3 py-2 text-center text-[10px] font-bold text-slate-600 uppercase border-b border-r border-slate-200">
                                    Extent<br /><span className="font-normal">({weights.extent}%)</span>
                                </th>
                                <th className="px-3 py-2 text-center text-[10px] font-bold text-slate-600 uppercase border-b border-r border-slate-200">
                                    Impact<br /><span className="font-normal">w ({weights.impact}%)</span>
                                </th>
                                <th className="px-3 py-2 text-center text-[10px] font-bold text-slate-600 uppercase border-b border-r border-slate-200">
                                    Impact<br /><span className="font-normal">uw</span>
                                </th>
                                <th className="px-3 py-2 text-center text-[10px] font-bold text-slate-600 uppercase border-b border-r border-slate-200">
                                    Invasive<br /><span className="font-normal">w ({weights.invasiveness}%)</span>
                                </th>
                                <th className="px-3 py-2 text-center text-[10px] font-bold text-slate-600 uppercase border-b border-r border-slate-200">
                                    Invasive<br /><span className="font-normal">uw</span>
                                </th>
                                <th className="px-3 py-2 text-center text-[10px] font-bold text-slate-600 uppercase border-b border-r border-slate-200">
                                    Habitat<br /><span className="font-normal">({weights.habitat}%)</span>
                                </th>
                                <th className="px-3 py-2 text-center text-[10px] font-bold text-slate-600 uppercase border-b border-slate-200">
                                    Control<br /><span className="font-normal">({weights.control}%)</span>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {scoredWeeds.length === 0 ? (
                                <tr>
                                    <td colSpan="11" className="px-6 py-12 text-center text-gray-500 italic">
                                        No weeds added yet. Complete Steps 1-4 first.
                                    </td>
                                </tr>
                            ) : (
                                scoredWeeds.map((weed) => (
                                    <tr key={weed.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-4 py-3 text-sm font-medium text-slate-900 border-r border-slate-100">
                                            {weed.name}
                                            {weed.scores.knowledgeGaps.length > 0 && (
                                                <span className="ml-2 inline-flex items-center gap-1 text-[10px] text-amber-600 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5" title={`Missing data for: ${weed.scores.knowledgeGaps.join(', ')}`}>
                                                    ⚠ Gap
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-3 py-3 text-center border-r border-slate-100 bg-teal-50">
                                            <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-teal-600 text-white font-bold text-sm shadow-sm">
                                                {Math.round(weed.scores.final)}
                                            </span>
                                        </td>
                                        <td className="px-3 py-3 text-center border-r border-slate-100 bg-amber-50">
                                            <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-amber-500 text-white font-bold text-sm shadow-sm">
                                                {Math.round(weed.scores.finalUnweighted)}
                                            </span>
                                        </td>
                                        <td className="px-3 py-3 text-center text-sm text-slate-500 border-r border-slate-100">
                                            {weed.rank}
                                        </td>
                                        <td className="px-3 py-3 text-center text-sm font-medium text-slate-700 border-r border-slate-100">
                                            {Math.round(weed.scores.extent)}
                                        </td>
                                        <td className="px-3 py-3 text-center text-sm font-medium text-slate-700 border-r border-slate-100">
                                            {weed.scores.impact !== null ? (
                                                <div>
                                                    {Math.round(weed.scores.impact)}
                                                    {weed.scores.impactPartial && <div className="text-[10px] text-amber-500 font-normal">{weed.scores.impactCount}</div>}
                                                </div>
                                            ) : <span className="text-amber-500 italic text-xs">N/A<div className="text-[10px]">{weed.scores.impactCount}</div></span>}
                                        </td>
                                        <td className="px-3 py-3 text-center text-sm font-medium text-slate-400 border-r border-slate-100">
                                            {weed.scores.impactUnweighted !== null ? (
                                                <div>
                                                    {Math.round(weed.scores.impactUnweighted)}
                                                    {weed.scores.impactPartial && <div className="text-[10px] text-amber-500 font-normal">{weed.scores.impactCount}</div>}
                                                </div>
                                            ) : <span className="text-amber-500 italic text-xs">N/A</span>}
                                        </td>
                                        <td className="px-3 py-3 text-center text-sm font-medium text-slate-700 border-r border-slate-100">
                                            {weed.scores.invasiveness !== null ? (
                                                <div>
                                                    {Math.round(weed.scores.invasiveness)}
                                                    {weed.scores.invasivenessPartial && <div className="text-[10px] text-amber-500 font-normal">{weed.scores.invasivenessCount}</div>}
                                                </div>
                                            ) : <span className="text-amber-500 italic text-xs">N/A<div className="text-[10px]">{weed.scores.invasivenessCount}</div></span>}
                                        </td>
                                        <td className="px-3 py-3 text-center text-sm font-medium text-slate-400 border-r border-slate-100">
                                            {weed.scores.invasivenessUnweighted !== null ? (
                                                <div>
                                                    {Math.round(weed.scores.invasivenessUnweighted)}
                                                    {weed.scores.invasivenessPartial && <div className="text-[10px] text-amber-500 font-normal">{weed.scores.invasivenessCount}</div>}
                                                </div>
                                            ) : <span className="text-amber-500 italic text-xs">N/A</span>}
                                        </td>
                                        <td className="px-3 py-3 text-center text-sm font-medium text-slate-700 border-r border-slate-100">
                                            {Math.round(weed.scores.habitat)}
                                        </td>
                                        <td className="px-3 py-3 text-center text-sm font-medium text-slate-700">
                                            {Math.round(weed.scores.control)}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="mt-8 flex justify-between">
                <button
                    onClick={() => navigate('/step-4')}
                    className="px-6 py-3 border border-slate-300 text-slate-600 hover:bg-slate-50 font-medium rounded-lg transition-colors"
                >
                    &larr; Back to Step 4
                </button>
                <div className="flex gap-3">
                    <button
                        onClick={() => navigate('/brochure')}
                        className="px-8 py-3 bg-teal-700 text-white font-bold rounded-lg shadow-md hover:bg-teal-800 transition-all flex items-center gap-2"
                    >
                        📋 Export Brochure
                    </button>
                    <button
                        onClick={() => navigate('/full-report')}
                        className="px-8 py-3 bg-slate-700 text-white font-bold rounded-lg shadow-md hover:bg-slate-800 transition-all flex items-center gap-2"
                    >
                        📄 Export Full Report
                    </button>

                </div>
            </div>
        </div>
    );
}
