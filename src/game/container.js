export function containerItemCount(container) {
  return Object.keys(container.amounts).reduce((result, k) =>
    result += container.amounts[k], 0);
}

export function containerHasSpace(container, amount = 1) {
  return containerItemCount(container) + amount <= container.capacity;
}
