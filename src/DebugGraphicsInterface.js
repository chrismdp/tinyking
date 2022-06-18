import { Counter } from './features/counter/Counter';

const LUTS = [
  "Arabica 12",
  "Ava 614",
  "Azrael 93",
  "Bourbon 64",
  "Byers 11",
  "Chemical 168",
  "Clayton 33",
  "Clouseau 54",
  "Cobi 3",
  "Contrail 35",
  "Cubicle 99",
  "Django 25",
  "Domingo 145",
  "Faded 47",
  "Folger 50",
  "Fusion 88",
  "Hyla 68",
  "Korben 214",
  "Lenox 340",
  "Lucky 64",
  "McKinnon 75",
  "Milo 5",
  "Neon 770",
  "Paladin 1875",
  "Pasadena 21",
  "Pitaya 15",
  "Reeve 38",
  "Remy 24",
  "Sprocket 231",
  "Teigen 28",
  "Trent 18",
  "Tweed 71",
  "Vireo 37",
  "Zed 32",
  "Zeke 39",
]


export default function DebugGraphicsInterface({ lut, setLut }) {
  return (
    <div className="absolute top-5">
      Temp UI
      <header className="App-header">
        <Counter />
      </header>
      <select onChange={e => setLut(e.target.value)} value={lut}>
        <option/>
        { LUTS.map(option => (<option key={option}>{option}</option>)) }
      </select>
    </div>
  );
}
