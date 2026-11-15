/** Smaller public repositories that are not projects, listed under "Also on GitHub". */
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
  // Newest first, whatever the order above.
].sort((a, b) => b.year - a.year);
