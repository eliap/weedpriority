import { Routes, Route, Link } from 'react-router-dom';
import { useState } from 'react';
import Home from './components/Home';
import ValuesAssessment from './components/ValuesAssessment';
import LocalExpertise from './components/LocalExpertise';
import ScientificReview from './components/ScientificReview';
import DifficultyOfControl from './components/DifficultyOfControl';
import ActionPlan from './components/ActionPlan';
import BrochureExport from './components/BrochureExport';
import BrochureFlier from './components/BrochureFlier';
import About from './components/About';
import './App.css';

import realWeedData from './data/realGovernmentData.json';

function App() {
  // Initialize weeds from the real data source
  const [weeds, setWeeds] = useState([]);
  const [selectedValues, setSelectedValues] = useState({});
  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 flex flex-col">
      {/* Navigation / Header */}
      <nav className="bg-white/90 backdrop-blur-sm sticky top-0 z-50 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex-shrink-0 flex items-center gap-3">
              <Link to="/" className="flex flex-col items-center hover:opacity-80 transition-opacity">
                <h1 className="text-2xl font-bold text-teal-800 uppercase tracking-[0.2em] leading-none">Project</h1>
                <h1 className="text-2xl font-bold text-teal-800 uppercase tracking-[0.2em] leading-none">Platypus</h1>
              </Link>
            </div>

            {/* Desktop Nav */}
            <div className="hidden md:flex items-center space-x-6">
              <div className="flex items-center gap-2 mr-4 border-r border-slate-200 pr-6">
                <button
                  onClick={() => {
                    const data = JSON.stringify({ weeds, selectedValues }, null, 2);
                    const blob = new Blob([data], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = 'platypus-data.json';
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }}
                  className="text-sm font-medium text-teal-700 hover:text-teal-900 flex items-center gap-1"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                  Save Progress
                </button>

                <label className="text-sm font-medium text-teal-700 hover:text-teal-900 flex items-center gap-1 cursor-pointer">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                  Load Progress
                  <input
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        try {
                          const json = JSON.parse(event.target.result);
                          if (json.weeds && Array.isArray(json.weeds)) {
                            setWeeds(json.weeds);
                          }
                          if (json.selectedValues) {
                            setSelectedValues(json.selectedValues);
                          }
                          alert('Progress loaded successfully!');
                        } catch (err) {
                          console.error(err);
                          alert('Failed to load file. Invalid format.');
                        }
                      };
                      reader.readAsText(file);
                    }}
                  />
                </label>
              </div>

              <Link to="/" className="text-slate-600 hover:text-teal-700 font-medium transition-colors">Home</Link>
              <Link to="/about" className="text-slate-600 hover:text-teal-700 font-medium transition-colors">About</Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Routes */}
      <div className="flex-grow">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="/step-1" element={<ValuesAssessment selectedValues={selectedValues} setSelectedValues={setSelectedValues} />} />
          <Route path="/step-2" element={<LocalExpertise weeds={weeds} setWeeds={setWeeds} />} />
          <Route path="/step-3" element={<ScientificReview weeds={weeds} setWeeds={setWeeds} selectedValues={selectedValues} />} />
          <Route path="/step-4" element={<DifficultyOfControl weeds={weeds} setWeeds={setWeeds} />} />
          <Route path="/step-5" element={<ActionPlan weeds={weeds} setWeeds={setWeeds} selectedValues={selectedValues} />} />
          <Route path="/brochure" element={<BrochureFlier weeds={weeds} selectedValues={selectedValues} />} />
          <Route path="/full-report" element={<BrochureExport weeds={weeds} selectedValues={selectedValues} />} />
        </Routes>
      </div>

      {/* Footer */}
      <footer className="bg-slate-100 border-t border-slate-200 py-12">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-slate-500 font-amatic text-2xl">Project Platypus - Upper Wimmera Landcare</p>
          <p className="text-slate-400 text-sm mt-2">&copy; 2026 Project Platypus. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

export default App;
