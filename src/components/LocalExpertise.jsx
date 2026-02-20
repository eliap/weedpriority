import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import realWeedData from '../data/realGovernmentData.json';
import scrapedData from '../data/weed_assessments.json';
import weedProfiles from '../data/weedProfiles.json';

const AVAILABLE_WEEDS = Array.from(new Set([
    ...Object.keys(realWeedData),
    ...Object.keys(scrapedData)
])).sort();

export default function LocalExpertise({ weeds, setWeeds }) {
    const navigate = useNavigate();
    const [newWeedName, setNewWeedName] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [useScientificNames, setUseScientificNames] = useState(false);

    // Filter suggestions based on input and current toggle state
    const getFilteredSuggestions = (inputValue) => {
        let filtered;

        if (inputValue.trim() === '') {
            filtered = AVAILABLE_WEEDS.filter(w => !weeds.some(existing => existing.name === w));
        } else {
            const lowerValue = inputValue.toLowerCase();
            filtered = AVAILABLE_WEEDS.filter(w => {
                // Check if weed is already added
                if (weeds.some(existing => existing.name === w)) return false;

                if (useScientificNames) {
                    // Match against scientific name
                    const sciName = weedProfiles[w]?.scientificName || '';
                    return sciName.toLowerCase().includes(lowerValue);
                } else {
                    // Match against common name
                    return w.toLowerCase().includes(lowerValue);
                }
            });
        }

        // Sort by Scientific Name if toggle is active
        if (useScientificNames) {
            filtered.sort((a, b) => {
                const sciA = (weedProfiles[a]?.scientificName || '').toLowerCase();
                const sciB = (weedProfiles[b]?.scientificName || '').toLowerCase();
                return sciA.localeCompare(sciB);
            });
        }

        return filtered;
    };

    // Update suggestions when toggle changes, input changes, or list changes
    useEffect(() => {
        const filtered = getFilteredSuggestions(newWeedName);
        setSuggestions(filtered);
    }, [newWeedName, useScientificNames, weeds]);

    const handleInputChange = (e) => {
        setNewWeedName(e.target.value);
        setShowSuggestions(true);
    };

    const getDisplayName = (commonName) => {
        if (useScientificNames) {
            return weedProfiles[commonName]?.scientificName || commonName;
        }
        return commonName;
    };

    const selectWeed = (commonName) => {
        setNewWeedName(getDisplayName(commonName));
        // We keep suggestions empty after selection until user types again, 
        // OR we could leave them? Usually standard to close.
        setShowSuggestions(false);
    };

    // Helper to resolve the input text back to a Common Name Key
    const resolveCommonName = (input) => {
        // 1. Try exact match on Common Name
        if (AVAILABLE_WEEDS.includes(input)) return input;

        // 2. Try exact match on Scientific Name
        const found = AVAILABLE_WEEDS.find(w => {
            const sci = weedProfiles[w]?.scientificName;
            return sci && sci.toLowerCase() === input.toLowerCase();
        });
        if (found) return found;

        return null;
    };

    const addWeed = (e) => {
        e.preventDefault();
        if (!newWeedName.trim()) return;

        const resolvedCommonName = resolveCommonName(newWeedName);

        if (!resolvedCommonName) {
            alert("Please select a valid weed from the list.");
            return;
        }

        // Check duplicates again just in case
        if (weeds.some(w => w.name === resolvedCommonName)) {
            alert("This weed is already in your list.");
            setNewWeedName('');
            return;
        }

        setWeeds([
            ...weeds,
            {
                id: Date.now(),
                name: resolvedCommonName, // ALWAYS store the common name key
                rank: weeds.length + 1,
                extent: 1,
                habitat: 1
            }
        ]);
        setNewWeedName('');
        setShowSuggestions(false);
    };

    const removeWeed = (id) => {
        setWeeds(weeds.filter(w => w.id !== id));
    };

    const updateWeed = (id, field, value) => {
        setWeeds(weeds.map(w =>
            w.id === id ? { ...w, [field]: Number(value) } : w
        ));
    };

    return (
        <div className="max-w-6xl mx-auto p-6">
            <div className="mb-8">
                <div className="flex justify-between items-start">
                    <div>
                        <h2 className="font-amatic text-4xl text-teal-800 font-bold mb-4">Step 2: Local Expertise</h2>
                        <p className="text-slate-600 mb-4 max-w-3xl">
                            Search for weeds (e.g. "Gorse") to add them to your priority list.
                            Then, assign a "Gut Feel" rank (1 = highest priority), and score the Extent and Habitat impact.
                        </p>
                    </div>
                    {/* Toggle Switch */}
                    <div className="flex items-center gap-3 bg-white p-2 rounded-lg border border-slate-200 shadow-sm">
                        <span className={`text-sm font-bold ${!useScientificNames ? 'text-teal-700' : 'text-slate-400'}`}>Common Names</span>
                        <button
                            onClick={() => {
                                setUseScientificNames(!useScientificNames);
                                // No longer clearing input/suggestions here
                            }}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500 ${useScientificNames ? 'bg-teal-600' : 'bg-slate-300'}`}
                        >
                            <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${useScientificNames ? 'translate-x-6' : 'translate-x-1'}`}
                            />
                        </button>
                        <span className={`text-sm font-bold ${useScientificNames ? 'text-teal-700' : 'text-slate-400'}`}>Scientific Names</span>
                    </div>
                </div>
            </div>

            {/* Add Weed Form */}
            <form onSubmit={addWeed} className="mb-10 bg-white p-6 rounded-lg shadow-sm border border-slate-200 relative">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                    Search & Add Weed ({useScientificNames ? 'Scientific Name' : 'Common Name'})
                </label>
                <div className="flex gap-4 relative">
                    <div className="relative flex-grow">
                        <input
                            type="text"
                            value={newWeedName}
                            onChange={handleInputChange}
                            onFocus={() => {
                                setShowSuggestions(true);
                            }}
                            placeholder={useScientificNames ? "e.g. Ulex europaeus..." : "e.g. Gorse..."}
                            className="w-full rounded-md border-gray-300 shadow-sm focus:border-teal-500 focus:ring-teal-500 sm:text-sm p-3 border"
                            autoComplete="off"
                            onBlur={() => {
                                // Small delay to allow click event on dropdown items to fire first
                                setTimeout(() => setShowSuggestions(false), 200);
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Escape') {
                                    setShowSuggestions(false);
                                    e.currentTarget.blur();
                                }
                            }}
                        />
                        {/* Autocomplete Dropdown */}
                        {showSuggestions && suggestions.length > 0 && (
                            <ul className="absolute z-10 w-full bg-white border border-gray-300 rounded-md mt-1 max-h-60 overflow-y-auto shadow-lg">
                                {suggestions.map((commonNameKey) => (
                                    <li
                                        key={commonNameKey}
                                        onClick={() => selectWeed(commonNameKey)}
                                        className="px-4 py-2 hover:bg-teal-50 cursor-pointer text-sm text-slate-700 hover:text-teal-800 flex justify-between items-center"
                                    >
                                        <span className="font-medium">{getDisplayName(commonNameKey)}</span>
                                        <span className="text-xs text-slate-400 italic">
                                            {useScientificNames ? commonNameKey : (weedProfiles[commonNameKey]?.scientificName || '')}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    <button
                        type="submit"
                        disabled={!newWeedName.trim()}
                        className="px-6 py-3 bg-teal-600 text-white font-bold rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Add
                    </button>
                </div>
            </form>

            {/* Scoring Key Info Box */}
            <div className="mb-8 bg-teal-50 border border-teal-100 rounded-lg p-5 text-sm text-slate-700">
                <h3 className="font-bold text-teal-800 text-base mb-3 border-b border-teal-200 pb-2">Scoring Key</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                        <h4 className="font-bold text-teal-700 mb-2">Extent Score (1 - 5)</h4>
                        <ul className="space-y-3">
                            <li className="flex gap-3">
                                <span className="font-bold text-teal-600 min-w-[1.5rem]">5:</span>
                                <span>Species not yet here but present nearby</span>
                            </li>
                            <li className="flex gap-3">
                                <span className="font-bold text-teal-600 min-w-[1.5rem]">4:</span>
                                <div>
                                    <p className="font-medium">Species present as small populations that are:</p>
                                    <ul className="list-disc ml-4 text-xs text-slate-600 my-1">
                                        <li>Small new populations</li>
                                        <li>Small outliers of larger populations, OR</li>
                                        <li>Small populations remaining after existing control programs</li>
                                    </ul>
                                    <p className="font-medium text-teal-600">AND species is appearing to spread quickly</p>
                                </div>
                            </li>
                            <li className="flex gap-3">
                                <span className="font-bold text-teal-600 min-w-[1.5rem]">3:</span>
                                <div>
                                    <p className="font-medium">Species present as small populations that are:</p>
                                    <ul className="list-disc ml-4 text-xs text-slate-600 my-1">
                                        <li>Small new populations</li>
                                        <li>Small outliers of larger populations, OR</li>
                                        <li>Small populations remaining after existing control programs</li>
                                    </ul>
                                    <p className="font-medium text-teal-600">AND species is appearing to spread slowly</p>
                                </div>
                            </li>
                            <li className="flex gap-3">
                                <span className="font-bold text-teal-600 min-w-[1.5rem]">2:</span>
                                <span>Species present in large populations that continue to expand (or would continue to expand if we ceased current control programs)</span>
                            </li>
                            <li className="flex gap-3">
                                <span className="font-bold text-teal-600 min-w-[1.5rem]">1:</span>
                                <span>Species present in large populations that are not expanding</span>
                            </li>
                        </ul>
                    </div>
                    <div>
                        <h4 className="font-bold text-teal-700 mb-2">Habitat Value Score (1 or 2)</h4>
                        <ul className="space-y-3">
                            <li className="flex gap-3">
                                <span className="font-bold text-teal-600 min-w-[1.5rem]">1:</span>
                                <span>Low value habitat (e.g. roadsides, degraded land)</span>
                            </li>
                            <li className="flex gap-3">
                                <span className="font-bold text-teal-600 min-w-[1.5rem]">2:</span>
                                <span>High value habitat (e.g. native bushland, waterways, threatened species habitat)</span>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>

            {/* Weed List Table */}
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-teal-50">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-teal-900 uppercase tracking-wider">
                                    Weed Name
                                </th>
                                <th scope="col" className="px-6 py-3 text-center text-xs font-bold text-teal-900 uppercase tracking-wider">
                                    Gut Feel Rank
                                    <span className="block text-[10px] font-normal text-teal-700 normal-case">(1 = Top Priority)</span>
                                </th>
                                <th scope="col" className="px-6 py-3 text-center text-xs font-bold text-teal-900 uppercase tracking-wider">
                                    Extent Score
                                    <span className="block text-[10px] font-normal text-teal-700 normal-case">(1-5 Scale)</span>
                                </th>
                                <th scope="col" className="px-6 py-3 text-center text-xs font-bold text-teal-900 uppercase tracking-wider">
                                    Habitat Value Score
                                    <span className="block text-[10px] font-normal text-teal-700 normal-case">(1-5 Scale)</span>
                                </th>
                                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {weeds.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-12 text-center text-gray-500 italic">
                                        No weeds selected. Search above to build your list.
                                    </td>
                                </tr>
                            ) : (
                                weeds.sort((a, b) => a.rank - b.rank).map((weed) => (
                                    <tr key={weed.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                                            {getDisplayName(weed.name)}
                                            {useScientificNames && (
                                                <span className="block text-xs text-slate-400 font-normal italic">
                                                    {weed.name}
                                                </span>
                                            )}
                                            {!useScientificNames && weedProfiles[weed.name]?.scientificName && (
                                                <span className="block text-xs text-slate-400 font-normal italic">
                                                    {weedProfiles[weed.name].scientificName}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center">
                                            <input
                                                type="number"
                                                min="1"
                                                value={weed.rank}
                                                onChange={(e) => updateWeed(weed.id, 'rank', e.target.value)}
                                                className="w-20 text-center rounded-md border-gray-300 shadow-sm focus:border-teal-500 focus:ring-teal-500 sm:text-sm p-1 border"
                                            />
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center">
                                            <select
                                                value={weed.extent || ''}
                                                onChange={(e) => updateWeed(weed.id, 'extent', e.target.value === '' ? null : e.target.value)}
                                                className="rounded-md border-gray-300 shadow-sm focus:border-teal-500 focus:ring-teal-500 sm:text-sm p-1 border"
                                            >
                                                <option value="">Select...</option>
                                                <option value="1">1 - Large pop, stable</option>
                                                <option value="2">2 - Large pop, expanding</option>
                                                <option value="3">3 - Small pop, slow spread</option>
                                                <option value="4">4 - Small pop, quick spread</option>
                                                <option value="5">5 - Not yet here</option>
                                            </select>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center">
                                            <select
                                                value={weed.habitat || ''}
                                                onChange={(e) => updateWeed(weed.id, 'habitat', e.target.value === '' ? null : e.target.value)}
                                                className="rounded-md border-gray-300 shadow-sm focus:border-teal-500 focus:ring-teal-500 sm:text-sm p-1 border"
                                            >
                                                <option value="">Select...</option>
                                                <option value="1">1 - Low value habitat</option>
                                                <option value="2">2 - High value habitat</option>
                                            </select>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                                            <button
                                                onClick={() => removeWeed(weed.id)}
                                                className="text-red-600 hover:text-red-900 font-medium"
                                            >
                                                Remove
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="mt-10 flex justify-between">
                <button
                    onClick={() => navigate('/step-1')}
                    className="px-6 py-3 border border-slate-300 text-slate-600 hover:bg-slate-50 font-medium rounded-lg transition-colors"
                >
                    &larr; Back to Step 1
                </button>
                <button
                    onClick={() => {
                        console.log('Saved weed list:', weeds);
                        navigate('/step-3');
                    }}
                    className="px-8 py-3 bg-teal-600 text-white font-bold rounded-lg shadow-md hover:bg-teal-700 hover:shadow-lg transition-all transform hover:-translate-y-0.5"
                >
                    Save & Continue to Step 3
                </button>
            </div>
        </div>
    );
}
