import { Route, Routes, BrowserRouter } from "react-router-dom";
import EventTable from "./EventTable.js";
import Game from "./Game.js";

import './App.css';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/tools/events" element={<EventTable/>}/>
        <Route exact path="/" element={<Game/>}/>
        <Route path="*" element={<div className="p-5">Path not found</div>}/>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
