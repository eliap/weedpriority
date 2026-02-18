import { Link } from 'react-router-dom';

export default function Home() {
    return (
        <>
            {/* Hero Section */}
            <div className="relative bg-teal-900 h-[60vh] flex items-center justify-center overflow-hidden">
                <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1544979590-37e9b47cd705?q=80&w=2574&auto=format&fit=crop')] bg-cover bg-center opacity-40"></div>
                <div className="relative z-10 text-center px-4 max-w-4xl mx-auto">
                    <h1 className="font-amatic text-6xl md:text-8xl text-white font-bold drop-shadow-lg mb-6 tracking-wide">
                        Preserving land, Protecting wildlife
                    </h1>
                    <p className="text-xl md:text-2xl text-white/90 font-light max-w-2xl mx-auto leading-relaxed">
                        Empowering the community to create a healthy, productive environment in the Upper Wimmera Catchment
                    </p>
                </div>
            </div>

            {/* Main Content - Workshop Sessions */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
                <div className="text-center mb-16">
                    <h2 className="font-amatic text-5xl md:text-6xl text-teal-900 font-bold mb-4">Weed Prioritization Workshop</h2>
                    <p className="text-slate-600 text-lg max-w-2xl mx-auto">
                        Join us in a collaborative effort to identify and manage local invasive species throughout the season.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {/* Step 1 Card */}
                    <div className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow border border-slate-100 overflow-hidden group flex flex-col">
                        <div className="h-3 bg-teal-600"></div>
                        <div className="p-6 flex-grow flex flex-col">
                            <div className="mb-4 inline-flex items-center justify-center w-12 h-12 rounded-full bg-teal-50 text-teal-700 font-bold text-xl">1</div>
                            <h3 className="text-2xl font-bold text-slate-800 mb-3 group-hover:text-teal-700 transition-colors">Define Values</h3>
                            <p className="text-slate-600 mb-6 leading-relaxed flex-grow">
                                Establish consensus on what matters to the local group: Social, Environmental, and Agricultural values.
                            </p>
                            <Link to="/step-1" className="block w-full py-3 px-4 bg-teal-50 text-teal-700 text-center font-semibold rounded-lg hover:bg-teal-100 transition-colors text-sm uppercase tracking-wide">
                                Start Step 1
                            </Link>
                        </div>
                    </div>

                    {/* Step 2 Card */}
                    <div className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow border border-slate-100 overflow-hidden group flex flex-col">
                        <div className="h-3 bg-slate-300"></div>
                        <div className="p-6 flex-grow flex flex-col">
                            <div className="mb-4 inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-100 text-slate-500 font-bold text-xl">2</div>
                            <h3 className="text-2xl font-bold text-slate-800 mb-3 group-hover:text-teal-700 transition-colors">Local Expertise</h3>
                            <p className="text-slate-600 mb-6 leading-relaxed flex-grow">
                                Build the preliminary weed list and capture local "gut feel" rankings on extent and habitat value.
                            </p>
                            <button className="w-full py-3 px-4 border border-slate-200 text-slate-400 text-center font-semibold rounded-lg cursor-not-allowed text-sm uppercase tracking-wide">
                                Locked
                            </button>
                        </div>
                    </div>

                    {/* Step 3 Card */}
                    <div className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow border border-slate-100 overflow-hidden group flex flex-col">
                        <div className="h-3 bg-slate-300"></div>
                        <div className="p-6 flex-grow flex flex-col">
                            <div className="mb-4 inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-100 text-slate-500 font-bold text-xl">3</div>
                            <h3 className="text-2xl font-bold text-slate-800 mb-3 group-hover:text-teal-700 transition-colors">Scientific Review</h3>
                            <p className="text-slate-600 mb-6 leading-relaxed flex-grow">
                                Review VRO data and incorporate scientific rankings. Compare with local feedback to finalize priorities.
                            </p>
                            <button className="w-full py-3 px-4 border border-slate-200 text-slate-400 text-center font-semibold rounded-lg cursor-not-allowed text-sm uppercase tracking-wide">
                                Locked
                            </button>
                        </div>
                    </div>

                    {/* Step 4 Card */}
                    <div className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow border border-slate-100 overflow-hidden group flex flex-col">
                        <div className="h-3 bg-slate-300"></div>
                        <div className="p-6 flex-grow flex flex-col">
                            <div className="mb-4 inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-100 text-slate-500 font-bold text-xl">4</div>
                            <h3 className="text-2xl font-bold text-slate-800 mb-3 group-hover:text-teal-700 transition-colors">Action Strategy</h3>
                            <p className="text-slate-600 mb-6 leading-relaxed flex-grow">
                                Develop a seasonal work plan and long-term management strategy based on the finalized list.
                            </p>
                            <button className="w-full py-3 px-4 border border-slate-200 text-slate-400 text-center font-semibold rounded-lg cursor-not-allowed text-sm uppercase tracking-wide">
                                Locked
                            </button>
                        </div>
                    </div>

                </div>
            </main>
        </>
    );
}
