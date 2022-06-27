import { useSelector, useDispatch } from 'react-redux';

import { animated, useSpring, config } from '@react-spring/web';
import { addTile } from "../map/mapSlice.js";
import { showEvent } from "./uiSlice.js";

import TERRAINS from "../../data/terrains.json"
import EVENTS from "../../data/events.json"

const actionFor = (terrain, hex, prompt) => prompt.event ?
  showEvent({ ...hex, terrain, event: prompt.event }) :
  addTile({ ...hex, type: prompt.tile })

export default function EventPanel({ visible }) {
  const dispatch = useDispatch();

  const { event, hex, terrain } = useSelector(state => state.ui.panel);
  const { heading, text, prompts } = EVENTS[event] || {};

  const image = terrain && TERRAINS[terrain].image;

  const styles = useSpring({
    to: { transform: `translateY(${visible ? 0 : 300 }px)` },
    config: config.stiff
  });

  let classes = "z-top absolute bg-neutral-800 p-4 inset-x-0 bottom-0 md:bottom-10 md:inset-x-10";

  return (
    <animated.div style={styles} className={classes}>
      <div className="relative">
        { image && <img className="absolute pointer-events-none object-bottom shadow-lg object-cover -right-24 bottom-16 w-80" src={`/images/${image}.png`} alt={terrain}/> }
        <h1 className="font-title text-2xl">{heading}</h1>
        <p className="pt-2 mr-20">{text}</p>
        { prompts &&
          <div className="py-4">
            { prompts.map((prompt, idx) =>
              <button className="px-4 py-2 hover:bg-blue-800 bg-blue-900 mr-2 rounded-lg" key={idx} onClick={() => dispatch(actionFor(terrain, hex, prompt))}>{prompt.label}</button>)
            }
          </div>
        }
      </div>
    </animated.div>
  );
}
