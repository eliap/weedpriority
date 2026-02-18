import React from 'react';
import { Link } from 'react-router-dom';

const About = () => {
    return (
        <div className="max-w-4xl mx-auto px-4 py-8">
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8">
                <h1 className="text-3xl font-bold text-teal-800 mb-6 font-serif">About Project Platypus Weed Prioritization</h1>

                <section className="mb-8">
                    <h2 className="text-xl font-semibold text-teal-700 mb-4 border-b border-gray-100 pb-2">Our Goal</h2>
                    <p className="text-slate-700 leading-relaxed mb-4">
                        The primary goal of this project is to prioritize weeds for control based on a comprehensive assessment of values, extent, invasiveness, impact, and difficulty of control. This ensures that our efforts are directed where they will have the most significant positive impact on the environment and community.
                    </p>
                </section>

                <section className="mb-8">
                    <h2 className="text-xl font-semibold text-teal-700 mb-4 border-b border-gray-100 pb-2">The Process</h2>
                    <div className="space-y-6">
                        <div className="flex gap-4">
                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center font-bold text-sm">1</div>
                            <div>
                                <h3 className="font-semibold text-slate-800 mb-1">Session 1: Initial Assessment</h3>
                                <p className="text-slate-600 text-sm">Identify values, list local weeds, perform an initial "gut feel" ranking, and discuss the extent and difficulty of control for each species.</p>
                            </div>
                        </div>
                        <div className="flex gap-4">
                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center font-bold text-sm">2</div>
                            <div>
                                <h3 className="font-semibold text-slate-800 mb-1">Session 2: Scientific Review & Refinement</h3>
                                <p className="text-slate-600 text-sm">Review scientific rankings (VRO), fill knowledge gaps with local expertise, compare initial rankings to numerical scores, and finalize the priority list.</p>
                            </div>
                        </div>
                        <div className="flex gap-4">
                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center font-bold text-sm">3</div>
                            <div>
                                <h3 className="font-semibold text-slate-800 mb-1">Session 3: Action Planning</h3>
                                <p className="text-slate-600 text-sm">Create a targeted action strategy and seasonal work plan based on the finalized prioritized list.</p>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="mb-8">
                    <h2 className="text-xl font-semibold text-teal-700 mb-4 border-b border-gray-100 pb-2">Key Assessment Criteria</h2>
                    <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {[
                            "Current Extent of Infestation",
                            "Invasiveness Potential",
                            "Environmental & Economic Impacts",
                            "Value of Habitat at Risk",
                            "Difficulty of Control"
                        ].map((item, index) => (
                            <li key={index} className="flex items-center gap-2 text-slate-700">
                                <span className="w-1.5 h-1.5 bg-teal-500 rounded-full"></span>
                                {item}
                            </li>
                        ))}
                    </ul>
                </section>

                <div className="mt-8 pt-8 border-t border-slate-200">
                    <Link to="/" className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500">
                        Start Prioritization Process
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default About;
