import selectn from "selectn";

export default function handleEvent(event, payload) {
  for (const key in event) {
    if (key === "conditions") {
      continue;
    }
    let handled = false;
    if (event[key].die) {
      payload.personable.dead = true;
      handled = true;
    }
    if (event[key].add) {
      const a = selectn(key, payload);
      if (!a.includes(event[key].add)) {
        a.push(event[key].add);
      }
      handled = true;
    }
    if (event[key].remove) {
      const a = selectn(key, payload);
      for (let i = a.length - 1; i >= 0; i--) {
        if (event[key].remove === a[i]) {
          a.splice(i, 1);
        }
      }
      handled = true;
    }
    if (event[key].set) {
      for (const k in event[key].set) {
        selectn(key, payload)[k] = event[key].set[k];
      }
      handled = true;
    }
    if (event[key].gain) {
      for (const k in event[key].gain) {
        const thing = selectn(key, payload);
        if (key == "attributes") {
          thing[k] = Math.min(10, (thing[k] || 0) + event[key].gain[k]);
        } else {
          thing[k] = (thing[k] || 0) + event[key].gain[k];
        }
      }
      handled = true;
    }
    if (event[key].lose) {
      for (const k in event[key].lose) {
        const thing = selectn(key, payload);
        thing[k] = Math.max(0, (thing[k] || 0) - event[key].lose[k]);
      }
      handled = true;
    }
    if (!handled) {
      throw "Don't know how to process event: " + JSON.stringify([ key, event[key] ]);
    }
  }
}
