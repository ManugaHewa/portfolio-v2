/**
 * Smaller public repositories that are not projects in their own right. They
 * share the Other work list with the projects that did not earn a case study:
 * two kinds of row at one visual weight, since a second heading for two links
 * was more structure than the content justified.
 *
 * Two entries left when the project list took them over: portfolio-v2 is a
 * project of its own now, and AI-Product-Recommendation is the repository
 * behind ShopSense. Listing either twice would read as padding.
 */
export interface Repository {
  name: string;
  note: string;
  year: number;
  url: string;
}

export const ALSO_ON_GITHUB: Repository[] = [
  {
    name: "Portfolio",
    note: "The previous portfolio, in vanilla HTML, CSS and JavaScript.",
    year: 2025,
    url: "https://github.com/ManugaHewa/Portfolio",
  },
  {
    name: "Calculators",
    note: "Three successive refactors of one Python program.",
    year: 2024,
    url: "https://github.com/ManugaHewa/Calculators",
  },
  // Newest first. Sorted here rather than trusted to the order above, so
  // adding an entry in the wrong place cannot quietly break the sequence.
].sort((a, b) => b.year - a.year);
