import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import realWeedData from '../data/realGovernmentData.json';

const AVAILABLE_WEEDS = Object.keys(realWeedData).sort();

export default function LocalExpertise({ weeds, setWeeds }) {
    const navigate = useNavigate();
    const [newWeedName, setNewWeedName] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);

    // Filter suggestions based on input
    const updateSuggestions = (value) => {
        if (value.trim() === '') {
            const filtered = AVAILABLE_WEEDS.filter(w => !weeds.some(existing => existing.name === w));
            setSuggestions(filtered);
        } else {
            const filtered = AVAILABLE_WEEDS.filter(w =>
                w.toLowerCase().includes(value.toLowerCase()) &&
                !weeds.some(existing => existing.name === w)
            );
            setSuggestions(filtered);
        }
    };

    const handleInputChange = (e) => {
        const value = e.target.value;
        setNewWeedName(value);
        updateSuggestions(value);
        setShowSuggestions(true);
    };

    const selectWeed = (name) => {
        setNewWeedName(name);
        setSuggestions([]);
        setShowSuggestions(false);
    };

    const addWeed = (e) => {
        e.preventDefault();
        if (!newWeedName.trim()) return;

        // Ensure exact match if possible, or just add what they typed if they insist? 
        // User requested: "click the weed you want and enter it with the exact spelling"
        // We'll trust their selection or input, but autocomplete guides them.

        setWeeds([
            ...weeds,
            {
                id: Date.now(),
                name: newWeedName,
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
                <h2 className="font-amatic text-4xl text-teal-800 font-bold mb-4">Step 2: Local Expertise</h2>
                <p className="text-slate-600 mb-4 max-w-3xl">
                    Search for weeds (e.g. "Gorse") to add them to your priority list.
                    Then, assign a "Gut Feel" rank (1 = highest priority), and score the Extent and Habitat impact.
                </p>
            </div>

            {/* Add Weed Form */}
            <form onSubmit={addWeed} className="mb-10 bg-white p-6 rounded-lg shadow-sm border border-slate-200 relative">
                <label className="block text-sm font-medium text-slate-700 mb-2">Search & Add Weed</label>
                <div className="flex gap-4 relative">
                    <div className="relative flex-grow">
                        <input
                            type="text"
                            value={newWeedName}
                            onChange={handleInputChange}
                            onFocus={() => {
                                updateSuggestions(newWeedName);
                                setShowSuggestions(true);
                            }}
                            placeholder="Start typing or click to see all options..."
                            className="w-full rounded-md border-gray-300 shadow-sm focus:border-teal-500 focus:ring-teal-500 sm:text-sm p-3 border"
                            autoComplete="off"
                        />
                        {/* Autocomplete Dropdown */}
                        {showSuggestions && suggestions.length > 0 && (
                            <ul className="absolute z-10 w-full bg-white border border-gray-300 rounded-md mt-1 max-h-60 overflow-y-auto shadow-lg">
                                {suggestions.map((weed) => (
                                    <li
                                        key={weed}
                                        onClick={() => selectWeed(weed)}
                                        className="px-4 py-2 hover:bg-teal-50 cursor-pointer text-sm text-slate-700 hover:text-teal-800"
                                    >
                                        {weed}
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
                                            {weed.name}
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
                                                value={weed.extent}
                                                onChange={(e) => updateWeed(weed.id, 'extent', e.target.value)}
                                                className="rounded-md border-gray-300 shadow-sm focus:border-teal-500 focus:ring-teal-500 sm:text-sm p-1 border"
                                            >
                                                <option value="1">1 - Large pop, stable</option>
                                                <option value="2">2 - Large pop, expanding</option>
                                                <option value="3">3 - Small pop, slow spread</option>
                                                <option value="4">4 - Small pop, quick spread</option>
                                                <option value="5">5 - Not yet here</option>
                                            </select>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center">
                                            <select
                                                value={weed.habitat}
                                                onChange={(e) => updateWeed(weed.id, 'habitat', e.target.value)}
                                                className="rounded-md border-gray-300 shadow-sm focus:border-teal-500 focus:ring-teal-500 sm:text-sm p-1 border"
                                            >
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
