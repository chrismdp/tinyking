export function containerItemCount(container) {
  return Object.keys(container.amounts).reduce((result, k) =>
    result += container.amounts[k], 0);
}

export function containerHasSpace(container) {
  return containerItemCount(container) < container.capacity;
}
