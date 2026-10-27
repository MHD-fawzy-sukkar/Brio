import part0 from './messages-0';
import extra from './messages-extra';
import part1 from './messages-100';
import part2 from './messages-200';
import part3 from './messages-300';
import part4 from './messages-400';
import part5 from './messages-500';
import part6 from './messages-600';
export const catalog: Record<string, string> = {
  ...extra,
  ...part0,
  ...part1,
  ...part2,
  ...part3,
  ...part4,
  ...part5,
  ...part6,
};
