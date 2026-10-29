import React from "react";
import PropTypes from "prop-types";
import { GameState } from "components/contexts";
import { name } from "game/name";
import { RINGS, GOODWILL_STEPS, feelingHint, knownFamilyTree, siblingsOf, trusts, patienceLeft, giftOptions, TALK_TIRED, SOCIAL_REQUIRED } from "game/people";
import { topController } from "game/playable";

const titleCase = text => text.charAt(0).toUpperCase() + text.slice(1);
const displayName = (state, id) => state.ecs.nameable[id] ? name(state.ecs.nameable[id]) : "?";
const number = value => Number(value.toFixed(1));
const SYMBOLS = { public: "○", social: "◆", personal: "■", intimate: "♥" };

function Ring({ ring }) {
  return <span className={"ring " + ring}><b>{SYMBOLS[ring]}</b>{titleCase(ring)}</span>;
}
Ring.propTypes = { ring: PropTypes.string.isRequired };

function Sheet({ children, label, onClose, className }) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    const before = document.activeElement;
    ref.current?.focus();
    return () => { if (before?.isConnected) before.focus(); };
  }, []);
  return <section ref={ref} tabIndex={-1} role="dialog" aria-label={label} className={"people-sheet " + className}
    onKeyDown={e => { if (e.key == "Escape") { e.stopPropagation(); onClose(); } }}>
    {children}
  </section>;
}
Sheet.propTypes = { children: PropTypes.node, label: PropTypes.string, onClose: PropTypes.func, className: PropTypes.string };

function relation(state, personId, otherId) {
  const kin = state.ecs.kinship[personId], male = state.ecs.nameable[otherId]?.male;
  if (kin.spouse == otherId) return "Spouse";
  if (kin.parents.includes(otherId)) return male === undefined ? "Parent" : male ? "Father" : "Mother";
  if (kin.children.includes(otherId)) return male === undefined ? "Child" : male ? "Son" : "Daughter";
  if (kin.parents.some(id => state.ecs.kinship[otherId]?.parents.includes(id))) return male === undefined ? "Sibling" : male ? "Brother" : "Sister";
  if (siblingsOf(state, personId).some(id => state.ecs.kinship[id].spouse == otherId) ||
    (kin.spouse && siblingsOf(state, kin.spouse).includes(otherId))) return male === undefined ? "Sibling-in-law" : male ? "Brother-in-law" : "Sister-in-law";
  return "Known to you";
}

function household(state, houseId) {
  const ecs = state.ecs;
  const head = houseId && ecs.controllable[houseId] && topController(ecs, houseId);
  const family = head && ecs.nameable[head] ? displayName(state, head).split(" ").slice(1).join(" ") : "";
  const home = houseId ? displayName(state, houseId) : "No household";
  return { home: home == "Log cabin" && family ? family + " cottage" : home,
    family: family || home.replace(/ cottage$| house$/i, "") };
}

export function PersonPanel({ entityId }) {
  const state = React.useContext(GameState);
  const [treeOpen, setTreeOpen] = React.useState(false);
  const [chooser, setChooser] = React.useState(null);
  const ecs = state.ecs, player = state.ui.playerId;
  const personName = displayName(state, entityId);
  const close = () => state.ui.actions.change_visibility({ selected_person: null });
  const select = id => { setTreeOpen(false); state.ui.actions.select_entity(id, false); };
  if (treeOpen) return <FamilyTree entityId={entityId} onClose={() => setTreeOpen(false)} onSelect={select}/>;
  const trusted = trusts(state, entityId, player);
  const feeling = feelingHint(state, entityId, player);
  const ring = feeling.ring || "public", rank = RINGS.indexOf(ring);
  const bond = ecs.relationships[entityId].known[player];
  const goodwill = bond?.goodwill || 0, next = GOODWILL_STEPS[rank + 1];
  const nextRing = RINGS[rank + 1];
  const learned = state.knowledge?.[player]?.people || {};
  const traits = ecs.personality[entityId].traits;
  const visibleTraits = new Set([...(learned[entityId]?.traits || []), ...(trusted ? traits.slice(0, 2) : [])]);
  const tree = knownFamilyTree(state, player, entityId);
  const knownCount = Object.values(tree.nodes).filter(n => !n.unknown).length;
  const theirPeople = Object.entries(ecs.relationships[entityId].known).filter(([id]) => id != player &&
    (!!ecs.relationships[player].known[id] || !!learned[id] || (tree.nodes[id] && !tree.nodes[id].unknown)))
    .sort((a, b) => RINGS.indexOf(b[1].ring) - RINGS.indexOf(a[1].ring) || b[1].goodwill - a[1].goodwill).slice(0, 3);
  const pronoun = ecs.nameable[entityId]?.male === undefined ? "They" : ecs.nameable[entityId].male ? "He" : "She";
  const possessive = pronoun == "She" ? "her" : pronoun == "He" ? "his" : "their";
  const subject = pronoun == "They" ? "They seem" : pronoun + " seems";
  const village = state.villages[ecs.village[entityId].villageId]?.name || "Stranger";
  const houseId = ecs.household[entityId]?.houseId;
  const home = household(state, houseId);
  const left = patienceLeft(state, player, entityId);
  const dead = ecs.personable[entityId].dead;
  const queue = (key, metadata = {}) => {
    state.ui.actions.talk_to(entityId, key, metadata);
    setChooser(null);
  };
  const gossip = state.knowledge?.[player]?.feelings[entityId] || {};
  const gifts = giftOptions(state, player);
  return <Sheet label={personName + "'s panel"} onClose={close} className="person-window">
    <header className="people-header"><div><h3>{personName}</h3>
      <p className="person-meta">{ecs.personable[entityId].age} years · {village}<br/>{home.home} · {home.family} household{dead ? " · † Dead" : ""}</p></div>
    <button className="sheet-close" aria-label={"Close " + personName + "'s panel"} onClick={close}>×</button></header>
    <div className="person-body"><p className="label">Traits you know</p>
      <div className="known-traits">{traits.map((trait, i) => <span key={i} className={"trait" + (visibleTraits.has(trait) ? "" : " unknown")} title={visibleTraits.has(trait) ? undefined : "Unknown trait"}>{visibleTraits.has(trait) ? titleCase(trait) : "?"}</span>)}</div>
      <div className="relationship"><div className="feeling-line"><strong>{feeling.hint ? subject + " " + feeling.hint : pronoun == "They" ? "They trust you" : pronoun + " trusts you"}</strong><Ring ring={ring}/></div>
        <p>{trusted ? `You are in ${possessive} ${titleCase(ring)} ring. ${pronoun} ${pronoun == "They" ? "share" : "shares"} ${possessive} family tree and gossip.` : `An impression. You do not yet know what ${pronoun.toLowerCase()} ${pronoun == "They" ? "think" : "thinks"} of you.`}</p>
        <div className="goodwill"><span>Goodwill with {personName.split(" ")[0]}</span><span>{number(goodwill)}{next ? " / " + next : ""}</span></div>
        <div className={"meter " + ring + "-meter"} role="progressbar" aria-label={"Goodwill with " + personName} aria-valuenow={number(goodwill)} aria-valuemin={0} aria-valuemax={next || GOODWILL_STEPS[3]}><span style={{ width: Math.max(0, Math.min(100, goodwill / (next || GOODWILL_STEPS[3]) * 100)) + "%" }}/></div>
        <small>{next ? `${number(Math.max(0, next - goodwill))} more towards ${titleCase(nextRing)} · space matters too.` : "Your closest ring · space matters too."}</small>
      </div>
      <div className="people-list"><p className="label">{trusted ? titleCase(possessive) + " closest people" : "People seen with " + (pronoun == "They" ? "them" : pronoun == "He" ? "him" : "her")}</p>
        <ul>{theirPeople.map(([id]) => <li key={id}><button onClick={() => select(id)}>{displayName(state, id)}</button><span className="kin">{trusted ? relation(state, entityId, id) : "Known to you"}</span></li>)}
          {!theirPeople.length && <li><span>?</span><span className="kin">Others not yet known</span></li>}</ul></div>
      {!dead && <div className="talk-actions" aria-label="Talking"><button disabled={!left} onClick={() => queue("chat")}>Chat</button><button disabled={!trusted || !left} onClick={() => setChooser(chooser == "ask" ? null : "ask")}>Ask about someone</button><button onClick={() => setChooser(chooser == "gift" ? null : "gift")}>Give a gift</button></div>}
      {!dead && (!left || !trusted) && <p className="talk-note">{!left ? TALK_TIRED : SOCIAL_REQUIRED}</p>}
      {chooser && <div className="talk-chooser"><div className="chooser-heading"><strong>{chooser == "gift" ? "Choose a gift" : "Ask about someone"}</strong><button aria-label="Close chooser" onClick={() => setChooser(null)}>×</button></div>
        {chooser == "gift" ? <><p>One item from your stores. You carry it to them.</p>{gifts.length ? gifts.map(g => <button key={g.sourceId + g.type} onClick={() => queue("give_gift", { gift: g })}>{titleCase(g.type)} <small>{g.amount} in store</small></button>) : <p>You have no goods to give.</p>}</> :
          Object.keys(ecs.relationships[entityId].known).filter(id => id != player && ecs.personable[id]).map(id => <button key={id} onClick={() => queue("ask_about", { aboutId: id })}>{displayName(state, id)}</button>)}</div>}
      {Object.keys(gossip).length > 0 && <div className="gossip"><p className="label">What they told you</p>{Object.entries(gossip).map(([id, ring]) => <p key={id}>{displayName(state, id)} <Ring ring={ring}/></p>)}</div>}
      {state.ui.talkResult?.personId == entityId && <p className="talk-note" role="status">{state.ui.talkResult.message}</p>}
    </div>
    <footer className="person-footer"><button onClick={() => setTreeOpen(true)}>Open family tree »</button><small>{knownCount == Object.keys(tree.nodes).length ? titleCase(possessive) + " whole family tree is known." : `${knownCount} ${knownCount == 1 ? "name" : "names"} known · the rest show as ?`}</small></footer>
  </Sheet>;
}
PersonPanel.propTypes = { entityId: PropTypes.string.isRequired };

// Each generation gets an unbounded row; spouses stay adjacent. The viewport
// scrolls rather than squeezing larger families into illegible cards.
export function layoutFamily({ rootId, nodes }) {
  const generations = { [rootId]: 0 }, queue = [rootId];
  for (let i = 0; i < queue.length; i++) {
    const id = queue[i], node = nodes[id], generation = generations[id];
    const edges = [...node.parents.map(id => [id, -1]), ...node.children.map(id => [id, 1]),
      ...node.siblings.map(id => [id, 0]), ...(node.spouse ? [[node.spouse, 0]] : [])];
    for (const [other, offset] of edges) if (generations[other] == null) {
      generations[other] = generation + offset;
      queue.push(other);
    }
  }
  const rows = {};
  for (const id of queue) (rows[generations[id]] ||= []).push(id);
  const width = Math.max(1000, ...Object.values(rows).map(row => row.length * 184 + 40));
  const first = Math.min(...Object.keys(rows).map(Number));
  const positions = {};
  for (const [generation, row] of Object.entries(rows)) {
    const ordered = [];
    for (const id of row) if (!ordered.includes(id)) {
      ordered.push(id);
      if (row.includes(nodes[id].spouse) && !ordered.includes(nodes[id].spouse)) ordered.push(nodes[id].spouse);
    }
    ordered.forEach((id, i) => { positions[id] = { x: (width - ordered.length * 184) / 2 + i * 184 + 10, y: (Number(generation) - first) * 136 + 36, generation: Number(generation) }; });
  }
  return { positions, width, height: (Math.max(...Object.keys(rows).map(Number)) - first + 1) * 136 + 24 };
}

function heirOf(state, id) {
  const ecs = state.ecs;
  for (const house of new Set(Object.values(ecs.household).map(h => h.houseId))) {
    if (!ecs.controllable[house]) continue;
    const head = topController(ecs, house), kin = ecs.kinship[head];
    if (!kin) continue;
    const eldest = kin.children.filter(child => !ecs.personable[child].dead)
      .sort((a, b) => ecs.personable[b].age - ecs.personable[a].age || a.localeCompare(b))[0];
    const heir = eldest || (kin.spouse && !ecs.personable[kin.spouse].dead ? kin.spouse : null);
    if (heir == id) return household(state, house).home;
  }
  return null;
}

export function FamilyTree({ entityId, onClose, onSelect }) {
  const state = React.useContext(GameState);
  const scroll = React.useRef(null);
  const tree = knownFamilyTree(state, state.ui.playerId, entityId);
  const { positions, width, height } = layoutFamily(tree);
  React.useEffect(() => {
    if (scroll.current) {
      const at = positions[entityId];
      scroll.current.scrollLeft = at.x - scroll.current.clientWidth / 2 + 82;
      scroll.current.scrollTop = at.y - scroll.current.clientHeight / 2 + 41;
    }
  // Centre the subject on opening; retain the player's scroll position afterwards.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityId]);
  const close = onClose || (() => state.ui.actions.change_visibility({ selected_person: null }));
  const select = onSelect || (id => state.ui.actions.select_entity(id, false));
  const nodes = Object.values(tree.nodes), personName = displayName(state, entityId);
  const unions = new Map();
  for (const node of nodes) if (node.parents.length) {
    const parents = [...node.parents].sort(), key = parents.join(":");
    if (!unions.has(key)) unions.set(key, { parents, children: [] });
    unions.get(key).children.push(node.id);
  }
  return <Sheet label={"The family of " + personName} onClose={close} className="tree-window">
    <header className="people-header"><h3>The family of {personName}</h3><span className="count">{nodes.filter(n => !n.unknown).length} of {nodes.length} names known</span><button className="sheet-close" aria-label="Close family tree" onClick={close}>×</button></header>
    <div className="tree-toolbar"><strong>Two generations above · two below</strong><span>Ancestors · siblings &amp; spouses · descendants</span></div>
    <div className="tree-scroll" ref={scroll} tabIndex={0} aria-label="Scroll family tree"><svg className="family-tree" width={width} height={height} role="group" aria-label={"The family of " + personName}>
      <g className="kinline">{nodes.filter(n => n.spouse && n.id < n.spouse).map(n => {
        const a = positions[n.id], b = positions[n.spouse];
        return <path className="marriage" key={n.id} d={`M${a.x + 82},${a.y + 41}H${b.x + 82}`}/>;
      })}{[...unions].map(([key, union]) => {
        const parents = union.parents.map(id => positions[id]);
        const x = parents.reduce((n, p) => n + p.x + 82, 0) / parents.length;
        const y = Math.max(...parents.map(p => p.y)) + 41;
        return <g key={key}><circle className="union" cx={x} cy={y} r={4}/>{union.children.map(id => {
          const child = positions[id];
          return <path key={id} d={`M${x},${y}V${child.y - 20}H${child.x + 82}V${child.y}`}/>;
        })}</g>;
      })}</g>
      {[...new Set(Object.values(positions).map(p => p.generation))].map(generation => {
        const at = Object.values(positions).find(p => p.generation == generation);
        return <text key={generation} className="gen-label" x={16} y={at.y - 12}>{({ "-2": "GRANDPARENTS", "-1": "PARENTS", 0: "SELECTED PERSON & SIBLINGS", 1: "CHILDREN", 2: "GRANDCHILDREN" })[generation]}</text>;
      })}
      {nodes.map(node => {
        const { x, y } = positions[node.id];
        const person = !node.unknown && state.ecs.personable[node.id];
        const dead = person?.dead, heir = person && heirOf(state, node.id);
        const label = node.unknown ? "?" : (dead ? "† " : "") + displayName(state, node.id);
        const meta = node.unknown ? "Not yet known" : dead ? "Died aged " + node.age : node.age + " · " + (node.age >= 18 && !node.spouse ? "Unmarried adult" : node.age < 18 ? "Child" : "Living");
        const houseId = person && state.ecs.household[node.id]?.houseId;
        const householder = !dead && houseId && state.ecs.controllable[houseId]?.controllerId == node.id;
        const tag = heir ? "◇ Heir · " + heir : node.id == entityId ? "Selected person" : householder ? "Householder" : "";
        return <g key={node.id} className={"node" + (node.unknown ? " unknown" : "") + (dead ? " dead" : "") + (node.id == entityId ? " selected" : "")}
          transform={`translate(${x} ${y})`} role={node.unknown ? "img" : "button"} tabIndex={node.unknown ? undefined : 0}
          aria-label={node.unknown ? "Unknown relative" : "Select " + label + ", " + meta + (tag ? ", " + tag : "")}
          onClick={node.unknown ? undefined : () => select(node.id)} onKeyDown={node.unknown ? undefined : e => { if (e.key == "Enter" || e.key == " ") { e.preventDefault(); select(node.id); } }}>
          <title>{label + ". " + meta}</title><rect className="card" width={164} height={82} rx={4}/>
          {node.unknown ? <><text className="question" x={82} y={30} textAnchor="middle">?</text><text className="node-meta" x={82} y={53} textAnchor="middle">Not yet known</text></> :
            <><text className="node-name" x={10} y={25}>{label.length > 21 ? label.slice(0, 20) + "…" : label}</text><text className="node-meta" x={10} y={46}>{meta}</text><text className="node-tag" x={10} y={65}>{tag}</text></>}
        </g>;
      })}
    </svg></div>
    <footer className="tree-legend"><span>━ Marriage · ● Children from the join</span><span>† Dead · plain name = living</span><span>◇ Heir of the household</span><span>Unmarried adult = could court</span><span>? A relative you have not learned about</span></footer>
  </Sheet>;
}
FamilyTree.propTypes = { entityId: PropTypes.string.isRequired, onClose: PropTypes.func, onSelect: PropTypes.func };
