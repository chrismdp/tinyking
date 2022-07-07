import { useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useTranslate } from 'react-polyglot';

import { animated, useSpring, config } from '@react-spring/web';
import { addTile } from "../map/mapSlice.js";
import { showEvent } from "./uiSlice.js";

import Tags from "./Tags.js"
import Button from "./Button.js"

import TERRAINS from "../../data/terrains.json"
import EVENTS from "../../data/events.json"

const actionFor = (terrain, hex, prompt) => prompt.event ?
  showEvent({ ...hex, terrain, event: prompt.event }) :
  addTile({ ...hex, type: prompt.tile })

export default function EventPanel({ visible }) {
  const dispatch = useDispatch();

  const { event, hex, terrain } = useSelector(state => state.ui.panel);
  const { heading, text, prompts, conditions } = EVENTS[event] || {};

  const image = terrain && TERRAINS[terrain].image;

  const styles = useSpring({
    to: { transform: `translateY(${visible ? 0 : 300 }px)` },
    config: config.stiff
  });

  const t = useTranslate();

  let classes = "z-top absolute bg-neutral-800 p-4 inset-x-0 bottom-0 md:bottom-10 md:inset-x-10";

  const tags = useMemo(() => Object.keys(conditions || {}).flatMap(k1 =>
    Object.keys(conditions[k1]).map(k2 =>
      t([ "conditions", k1, k2 ].join("."), { value: conditions[k1][k2] })
    )
  ), [conditions, t]);

  return (
    <animated.div style={styles} className={classes}>
      <div className="relative">
        { image && <img className="absolute pointer-events-none object-bottom object-cover -right-24 hidden sm:block -top-56 w-80" src={`/images/${image}.png`} alt={terrain}/> }
        <h1 className="font-title text-2xl">{heading}</h1>
        <p className="pt-2 mr-20">{text}</p>

        {tags && <div className="mt-2">
          <Tags tags={tags}/>
        </div>}
        { prompts &&
          <div className="py-2">
            { prompts.map((prompt, idx) =>
              <Button key={idx} onClick={() => dispatch(actionFor(terrain, hex, prompt))}>{prompt.label}</Button>)
            }
          </div>
        }
      </div>
    </animated.div>
  );
}
