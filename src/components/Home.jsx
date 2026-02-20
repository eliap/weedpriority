import { Link } from 'react-router-dom';

export default function Home() {
    return (
        <>

            {/* Main Content - Workshop Sessions */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
                <div className="text-center mb-16">
                    <h2 className="font-amatic text-5xl md:text-6xl text-teal-900 font-bold mb-4">Weed Prioritization Tool</h2>
                    <p className="text-teal-700 text-sm md:text-base font-semibold mb-6">
                        funded by Agriculture Victoria's Partnerships Against Pests Program
                    </p>
                    <p className="text-slate-600 text-lg max-w-2xl mx-auto">
                        This tool guides the community to identify and assess local weeds, helping us prioritize the most important species for effective management in our region.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                    {/* Step 1 Card */}
                    <div className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow border border-slate-100 overflow-hidden group flex flex-col">
                        <div className="h-3 bg-teal-600"></div>
                        <div className="p-6 flex-grow flex flex-col">
                            <div className="mb-4 inline-flex items-center justify-center w-10 h-10 rounded-full bg-teal-50 text-teal-700 font-bold text-lg">1</div>
                            <h3 className="text-xl font-bold text-slate-800 mb-2 group-hover:text-teal-700 transition-colors">Define Values</h3>
                            <p className="text-slate-600 mb-4 text-sm leading-relaxed flex-grow">
                                Establish consensus on what matters: Social, Environmental, and Agricultural values.
                            </p>
                            <Link to="/step-1" className="block w-full py-2 px-3 bg-teal-50 text-teal-700 text-center font-semibold rounded-lg hover:bg-teal-100 transition-colors text-xs uppercase tracking-wide">
                                Start Step 1
                            </Link>
                        </div>
                    </div>

                    {/* Step 2 Card */}
                    <div className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow border border-slate-100 overflow-hidden group flex flex-col">
                        <div className="h-3 bg-slate-300"></div>
                        <div className="p-6 flex-grow flex flex-col">
                            <div className="mb-4 inline-flex items-center justify-center w-10 h-10 rounded-full bg-slate-100 text-slate-500 font-bold text-lg">2</div>
                            <h3 className="text-xl font-bold text-slate-800 mb-2 group-hover:text-teal-700 transition-colors">Local Expertise</h3>
                            <p className="text-slate-600 mb-4 text-sm leading-relaxed flex-grow">
                                Build the weed list and capture "gut feel" rankings on extent and habitat value.
                            </p>
                            <button className="w-full py-2 px-3 border border-slate-200 text-slate-400 text-center font-semibold rounded-lg cursor-not-allowed text-xs uppercase tracking-wide">
                                Locked
                            </button>
                        </div>
                    </div>

                    {/* Step 3 Card */}
                    <div className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow border border-slate-100 overflow-hidden group flex flex-col">
                        <div className="h-3 bg-slate-300"></div>
                        <div className="p-6 flex-grow flex flex-col">
                            <div className="mb-4 inline-flex items-center justify-center w-10 h-10 rounded-full bg-slate-100 text-slate-500 font-bold text-lg">3</div>
                            <h3 className="text-xl font-bold text-slate-800 mb-2 group-hover:text-teal-700 transition-colors">Scientific Review</h3>
                            <p className="text-slate-600 mb-4 text-sm leading-relaxed flex-grow">
                                Apply scientific rankings of impact and invasiveness to refine priorities.
                            </p>
                            <button className="w-full py-2 px-3 border border-slate-200 text-slate-400 text-center font-semibold rounded-lg cursor-not-allowed text-xs uppercase tracking-wide">
                                Locked
                            </button>
                        </div>
                    </div>

                    {/* Step 4 Card */}
                    <div className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow border border-slate-100 overflow-hidden group flex flex-col">
                        <div className="h-3 bg-slate-300"></div>
                        <div className="p-6 flex-grow flex flex-col">
                            <div className="mb-4 inline-flex items-center justify-center w-10 h-10 rounded-full bg-slate-100 text-slate-500 font-bold text-lg">4</div>
                            <h3 className="text-xl font-bold text-slate-800 mb-2 group-hover:text-teal-700 transition-colors">Ease of Control</h3>
                            <p className="text-slate-600 mb-4 text-sm leading-relaxed flex-grow">
                                Reflect on the difficulty and feasibility of controlling each species.
                            </p>
                            <button className="w-full py-2 px-3 border border-slate-200 text-slate-400 text-center font-semibold rounded-lg cursor-not-allowed text-xs uppercase tracking-wide">
                                Locked
                            </button>
                        </div>
                    </div>

                    {/* Step 5 Card */}
                    <div className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow border border-slate-100 overflow-hidden group flex flex-col">
                        <div className="h-3 bg-slate-300"></div>
                        <div className="p-6 flex-grow flex flex-col">
                            <div className="mb-4 inline-flex items-center justify-center w-10 h-10 rounded-full bg-slate-100 text-slate-500 font-bold text-lg">5</div>
                            <h3 className="text-xl font-bold text-slate-800 mb-2 group-hover:text-teal-700 transition-colors">Priority List</h3>
                            <p className="text-slate-600 mb-4 text-sm leading-relaxed flex-grow">
                                Explore your final prioritised list to guide on-ground work.
                            </p>
                            <button className="w-full py-2 px-3 border border-slate-200 text-slate-400 text-center font-semibold rounded-lg cursor-not-allowed text-xs uppercase tracking-wide">
                                Locked
                            </button>
                        </div>
                    </div>
                </div>
            </main>
        </>
    );
}
