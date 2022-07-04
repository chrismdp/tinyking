import { Route, Routes, BrowserRouter } from "react-router-dom";
import EventTable from "./EventTable.js";
import Game from "./Game.js";

import TRANSLATIONS from "./data/strings.en.json";

import './App.css';
import { I18n } from "react-polyglot";

const locale = window.locale || "en";

function App() {
  return (
    <I18n locale={locale} messages={TRANSLATIONS}>
      <BrowserRouter>
        <Routes>
          <Route path="/tools/events" element={<EventTable/>}/>
          <Route exact path="/" element={<Game/>}/>
          <Route path="*" element={<div className="p-5">Path not found</div>}/>
        </Routes>
      </BrowserRouter>
    </I18n>
  );
}

export default App;
