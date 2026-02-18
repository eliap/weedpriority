import { useNavigate } from 'react-router-dom';

const CONTROL_LEVELS = [
    {
        value: 4,
        label: "Level 4 — Easy to control",
        description: "Species likely to be controlled or eliminated with available technology and resources and which desirable native species will replace with little further input.",
        color: "bg-green-50 border-green-300 text-green-800",
        badgeColor: "bg-green-600"
    },
    {
        value: 3,
        label: "Level 3 — Controllable with restoration",
        description: "Species likely be controlled but will not be replaced by desirable natives without an active restoration program requiring substantial resources.",
        color: "bg-yellow-50 border-yellow-300 text-yellow-800",
        badgeColor: "bg-yellow-500"
    },
    {
        value: 2,
        label: "Level 2 — Difficult to control",
        description: "Species difficult to control with available technology and resources and/or whose control will likely result in substantial damage to other, desirable species.",
        color: "bg-orange-50 border-orange-300 text-orange-800",
        badgeColor: "bg-orange-500"
    },
    {
        value: 1,
        label: "Level 1 — Unlikely to control",
        description: "Species unlikely to be controlled with available technology and resources.",
        color: "bg-red-50 border-red-300 text-red-800",
        badgeColor: "bg-red-600"
    }
];

export default function DifficultyOfControl({ weeds, setWeeds }) {
    const navigate = useNavigate();

    const updateControlLevel = (weedId, level) => {
        setWeeds(prev => prev.map(w =>
            w.id === weedId ? { ...w, controlLevel: level } : w
        ));
    };

    return (
        <div className="max-w-6xl mx-auto p-6">
            <div className="mb-8">
                <h2 className="font-amatic text-4xl text-teal-800 font-bold mb-4">Step 4: Difficulty of Control</h2>
                <p className="text-slate-600 mb-4 max-w-3xl">
                    For each weed in your list, select the level that best describes how difficult it is to control.
                    This factors into the final priority score — species that are easier to control may be higher priority
                    because you'll get more impact for your effort.
                </p>
            </div>

            {/* Control Level Key */}
            <div className="mb-8 bg-white p-5 rounded-lg shadow-sm border border-slate-200">
                <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-3">Control Level Descriptions</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {CONTROL_LEVELS.map(level => (
                        <div key={level.value} className={`p-3 rounded-lg border ${level.color}`}>
                            <div className="flex items-start gap-2">
                                <span className={`${level.badgeColor} text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5`}>
                                    {level.value}
                                </span>
                                <div>
                                    <p className="font-bold text-sm">{level.label}</p>
                                    <p className="text-xs mt-1 opacity-80">{level.description}</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Weed Control Table */}
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-teal-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-bold text-teal-900 uppercase tracking-wider">
                                Weed Name
                            </th>
                            <th className="px-6 py-3 text-center text-xs font-bold text-teal-900 uppercase tracking-wider">
                                Control Level
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {weeds.length === 0 ? (
                            <tr>
                                <td colSpan="2" className="px-6 py-12 text-center text-gray-500 italic">
                                    No weeds in your list. Complete Steps 1-3 first.
                                </td>
                            </tr>
                        ) : (
                            weeds.map(weed => {
                                const currentLevel = CONTROL_LEVELS.find(l => l.value === weed.controlLevel);
                                return (
                                    <tr key={weed.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4 text-sm font-medium text-slate-900">
                                            {weed.name}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center justify-center gap-3">
                                                <select
                                                    value={weed.controlLevel || ''}
                                                    onChange={(e) => updateControlLevel(weed.id, Number(e.target.value))}
                                                    className="rounded-md border-gray-300 shadow-sm focus:border-teal-500 focus:ring-teal-500 text-sm p-2 border w-64"
                                                >
                                                    <option value="">— Select level —</option>
                                                    {CONTROL_LEVELS.map(level => (
                                                        <option key={level.value} value={level.value}>
                                                            {level.label}
                                                        </option>
                                                    ))}
                                                </select>
                                                {currentLevel && (
                                                    <span className={`${currentLevel.badgeColor} text-white text-xs font-bold w-7 h-7 rounded-full flex items-center justify-center`}>
                                                        {currentLevel.value}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            <div className="mt-10 flex justify-between">
                <button
                    onClick={() => navigate('/step-3')}
                    className="px-6 py-3 border border-slate-300 text-slate-600 hover:bg-slate-50 font-medium rounded-lg transition-colors"
                >
                    &larr; Back to Step 3
                </button>
                <button
                    onClick={() => navigate('/step-5')}
                    className="px-8 py-3 bg-teal-600 text-white font-bold rounded-lg shadow-md hover:bg-teal-700 hover:shadow-lg transition-all transform hover:-translate-y-0.5"
                >
                    View Final Results (Step 5)
                </button>
            </div>
        </div>
    );
}
