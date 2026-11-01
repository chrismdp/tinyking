// History may yield between seasons while retaining its private indexes. Keep
// synchronous callers synchronous and release the scope on either kind of exit.
export function finishTransition(transition, cleanup) {
  let result;
  try { result = transition(); }
  catch (error) { cleanup(); throw error; }
  if (result?.then) return result.finally(cleanup);
  cleanup();
  return result;
}
