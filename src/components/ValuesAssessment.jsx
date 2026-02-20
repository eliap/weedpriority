import { useState } from 'react';
import { valueCategories } from '../data/valuesData';
import { useNavigate } from 'react-router-dom';

export default function ValuesAssessment({ selectedValues, setSelectedValues, groupName, setGroupName }) {
    const navigate = useNavigate();
    // selectedValues is now passed as a prop

    const handleToggle = (id) => {
        setSelectedValues(prev => ({
            ...prev,
            [id]: !prev[id]
        }));
    };

    return (
        <div className="max-w-4xl mx-auto p-6">
            <div className="mb-8">
                <h2 className="font-amatic text-4xl text-teal-800 font-bold mb-4">Step 1: Define Community Values</h2>

                {/* Group Name Input */}
                <div className="mb-6 bg-teal-50 p-4 rounded-lg border border-teal-100">
                    <label className="block text-sm font-bold text-teal-800 mb-2">
                        Group / Organization Name
                    </label>
                    <input
                        type="text"
                        value={groupName || ''}
                        onChange={(e) => setGroupName(e.target.value)}
                        placeholder="e.g. Upper Wimmera Landcare"
                        className="w-full max-w-md rounded-md border-gray-300 shadow-sm focus:border-teal-500 focus:ring-teal-500 sm:text-sm p-2 border"
                    />
                    <p className="text-xs text-teal-600 mt-1">
                        This will appear on your generated reports and brochures.
                    </p>
                </div>

                <p className="text-slate-600 mb-4">
                    Select the impact categories that are relevant to your site and community.
                    Unchecked items will be excluded from the final prioritization calculations.
                </p>
                <p className="text-slate-600 mb-4 italic font-medium">
                    Read the following options as "does it matter to you if a weed is known to..."
                </p>
            </div>

            <div className="space-y-8">
                {valueCategories.map((category) => (
                    <div key={category.title} className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                        <div className="bg-teal-50 px-6 py-3 border-b border-teal-100 flex justify-between items-center">
                            <h3 className="font-bold text-teal-900 text-lg">{category.title}</h3>
                            <div className="space-x-4 text-sm">
                                <button
                                    onClick={() => {
                                        const updates = {};
                                        category.items.forEach(item => updates[item.id] = true);
                                        setSelectedValues(prev => ({ ...prev, ...updates }));
                                    }}
                                    className="text-teal-700 hover:text-teal-900 font-medium underline decoration-teal-300 hover:decoration-teal-600 underline-offset-2 transition-all"
                                >
                                    Select All
                                </button>
                                <button
                                    onClick={() => {
                                        const updates = {};
                                        category.items.forEach(item => updates[item.id] = false);
                                        setSelectedValues(prev => ({ ...prev, ...updates }));
                                    }}
                                    className="text-slate-500 hover:text-slate-700 font-medium underline decoration-slate-300 hover:decoration-slate-500 underline-offset-2 transition-all"
                                >
                                    Deselect All
                                </button>
                            </div>
                        </div>
                        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                            {category.items.map((item) => (
                                <label key={item.id} className="flex items-start space-x-3 cursor-pointer group">
                                    <div className="relative flex items-center">
                                        <input
                                            type="checkbox"
                                            className="peer h-5 w-5 text-teal-600 focus:ring-teal-500 border-gray-300 rounded cursor-pointer transition-all"
                                            checked={!!selectedValues[item.id]}
                                            onChange={() => handleToggle(item.id)}
                                        />
                                    </div>
                                    <span className="text-slate-700 group-hover:text-teal-800 transition-colors select-none">
                                        {item.label}
                                    </span>
                                </label>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            <div className="mt-10 flex justify-end">
                <button
                    onClick={() => navigate('/')}
                    className="mr-4 px-6 py-3 text-slate-600 hover:text-slate-800 font-medium transition-colors"
                >
                    Cancel
                </button>
                <button
                    onClick={() => {
                        console.log('Saved values:', selectedValues);
                        navigate('/step-2');
                    }}
                    className="px-8 py-3 bg-teal-600 text-white font-bold rounded-lg shadow-md hover:bg-teal-700 hover:shadow-lg transition-all transform hover:-translate-y-0.5"
                >
                    Save & Continue to Step 2
                </button>
            </div>
        </div>
    );
}
