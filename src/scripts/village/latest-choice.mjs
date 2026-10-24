export function createLatestChoice() {
  let ticket = 0;
  return {
    begin: () => ++ticket,
    isLatest: (candidate) => candidate === ticket,
  };
}
