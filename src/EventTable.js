import { useState, useEffect } from "react";

import EFFECTS from "./data/effects.json";
import TERRAINS from "./data/terrains.json";
import { engine } from "./features/ui/uiSlice.js";


function EventStat({ e1, o1, e2, o2 }) {
  const [ events, setEvents ] = useState({});

  useEffect(() => {
    (async () => {

      const terrains = Object.keys(TERRAINS);
      let result = {};
      for (let idx = 0; idx < terrains.length; idx++) {
        const terrain = terrains[idx];
        result[terrain] = await engine.run({
          terrain,
          [e1]: (EFFECTS[e1][o1] || {}).min || null,
          [e2]: (EFFECTS[e2][o2] || {}).min || null
        });
      }
      setEvents(result);
    })();
  }, [setEvents, e1, o1, e2, o2]);

  return <div className="flex">
    {
      Object.keys(TERRAINS).map(terrain => {
        const options = (events[terrain] || []);
        const COLOUR = { "0": "red-400", "1": "orange-400" };
        return (
          <div key={terrain} className={`flex justify-center items-center rounded mx-1 w-8 h-8 text-white text-sm font-bold bg-${TERRAINS[terrain].colour}`}>
            <div title={options.join(", ")} className={`w-4 h-4 text-xs rounded bg-${COLOUR[options.length] || "auto"}`}>
              { options.length }
            </div>
          </div>
        );
      })
    }
    </div>;
}

export default function EventTable() {
  const effectOptions = Object.keys(EFFECTS).reduce((memo, e) => ({ ...memo, [e]: [ "", ...Object.keys(EFFECTS[e])]}), {});

  const sortedEffectKeys = Object.keys(effectOptions).sort();

  return (
    <div className="p-4">
      <h1 className="font-title text-4xl pb-4">Effect combinations in events</h1>
      <table className="text-left border-separate">
        <thead>
          <tr>
            <th/>
            <th/>
            { sortedEffectKeys.slice(0, -1).map(effect => (
                <th colSpan={effectOptions[effect].length} className="p-2 bg-neutral-200" key={effect}>{effect}</th>
            )) }
          </tr>
          <tr>
            <th/>
            <th/>
            { sortedEffectKeys.slice(0, -1).map(effect => (
              effectOptions[effect].map(option => (
                <th className="p-2 bg-neutral-300" key={option}>{option}</th>
              ))
            )) }
          </tr>
        </thead>
        <tbody>
            { sortedEffectKeys.reverse().slice(0, -1).map(e1 => (
            effectOptions[e1].map((o1, i) => (
              <tr key={`row-${e1}-${o1}`}>
                { i === 0 && <th rowSpan={effectOptions[e1].length} className="p-2 bg-neutral-200" key={e1}>{e1}</th> }
                <th className="p-2 bg-neutral-300" key={o1}>{o1}</th>
                { Object.keys(effectOptions).map(e2 => (
                  effectOptions[e2].map(o2 => e2 < e1 ?
                    <td className="text-center" key={`${e1}-${o1} + ${e2}-${o2}`}>
                      <EventStat e1={e1} o1={o1} e2={e2} o2={o2}/>
                    </td>
                  :
                    <td className="text-center" key={`${e1}-${o1} + ${e2}-${o2}`}></td>
                  )
                )) }
              </tr>
            ))
          )) }
        </tbody>
      </table>
    </div>
  );
};
