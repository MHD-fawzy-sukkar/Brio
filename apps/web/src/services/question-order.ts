/** Move relative to a hovered card; all IDs must remain present exactly once. */
export function moveQuestion(
  ids: readonly string[],
  dragged: string,
  target: string,
  after = false,
): string[] {
  if (dragged === target || !ids.includes(dragged) || !ids.includes(target)) return [...ids];
  const next = ids.filter((id) => id !== dragged);
  const index = next.indexOf(target) + (after ? 1 : 0);
  next.splice(index, 0, dragged);
  return next;
}
