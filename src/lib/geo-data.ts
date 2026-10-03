export interface CityData {
  name: string;
  slug: string;
  descriptionSnippet: string;
}

export interface StateData {
  name: string;
  abbr: string;
  slug: string;
  heroLede: string;
  metaDescription: string;
  heroImageUrl?: string;
  cities: CityData[];
}

export const GEO_STATES: Record<string, StateData> = {
  texas: {
    name: "Texas", abbr: "TX", slug: "texas",
    heroLede: "Spinora is available to players across Texas — Houston, Dallas, San Antonio, Austin, Fort Worth, El Paso and more.",
    metaDescription: "Play Fire Kirin, Juwa, Orion Stars, Game Vault and sweepstakes fish table games online in Texas. 50% welcome bonus.",
    cities: [
      { name: "Houston", slug: "houston", descriptionSnippet: "Houston's most popular sweepstakes fish table platform" },
      { name: "Dallas", slug: "dallas", descriptionSnippet: "Dallas players enjoy Fire Kirin, Juwa and 10 more games" },
      { name: "San Antonio", slug: "san-antonio", descriptionSnippet: "San Antonio sweepstakes gaming — account ready instantly" },
      { name: "Austin", slug: "austin", descriptionSnippet: "Austin players can access all 12 Spinora games" },
      { name: "Fort Worth", slug: "fort-worth", descriptionSnippet: "Fort Worth online fish table games" },
      { name: "El Paso", slug: "el-paso", descriptionSnippet: "El Paso online sweepstakes games" },
      { name: "Arlington", slug: "arlington", descriptionSnippet: "Arlington TX sweepstakes slots" },
      { name: "Corpus Christi", slug: "corpus-christi", descriptionSnippet: "Corpus Christi TX fish tables" },
    ],
  },
  florida: {
    name: "Florida", abbr: "FL", slug: "florida",
    heroLede: "Spinora serves players across Florida — Miami, Orlando, Jacksonville, Tampa, Fort Lauderdale, St Petersburg and beyond.",
    metaDescription: "Play Fire Kirin, Juwa, Orion Stars and sweepstakes games online in Florida. 50% welcome bonus.",
    cities: [
      { name: "Miami", slug: "miami", descriptionSnippet: "Miami players get 50% bonus on their first deposit" },
      { name: "Orlando", slug: "orlando", descriptionSnippet: "Orlando sweepstakes games — Fire Kirin, Juwa and more" },
      { name: "Jacksonville", slug: "jacksonville", descriptionSnippet: "Jacksonville fish table games available 7 days a week" },
      { name: "Tampa", slug: "tampa", descriptionSnippet: "Tampa online fish tables with fast Telegram support" },
      { name: "Fort Lauderdale", slug: "fort-lauderdale", descriptionSnippet: "Fort Lauderdale online games" },
      { name: "Tallahassee", slug: "tallahassee", descriptionSnippet: "Tallahassee FL sweepstakes slots" },
    ],
  },
  california: {
    name: "California", abbr: "CA", slug: "california",
    heroLede: "Spinora serves players across California — Los Angeles, San Diego, San Francisco, Sacramento, San Jose, Fresno.",
    metaDescription: "Play Fire Kirin, Juwa, Orion Stars and sweepstakes games online in California. 50% welcome bonus.",
    cities: [
      { name: "Los Angeles", slug: "los-angeles", descriptionSnippet: "LA players get Fire Kirin, Juwa and 10 more games online" },
      { name: "San Diego", slug: "san-diego", descriptionSnippet: "San Diego sweepstakes gaming with 50% welcome bonus" },
      { name: "San Francisco", slug: "san-francisco", descriptionSnippet: "San Francisco online fish table games" },
      { name: "Sacramento", slug: "sacramento", descriptionSnippet: "Sacramento online fish table games" },
      { name: "San Jose", slug: "san-jose", descriptionSnippet: "San Jose sweepstakes games" },
      { name: "Fresno", slug: "fresno", descriptionSnippet: "Fresno players access all 12 Spinora sweepstakes games" },
    ],
  },
  georgia: {
    name: "Georgia", abbr: "GA", slug: "georgia",
    heroLede: "Spinora is available to players across Georgia including Atlanta, Augusta, Savannah, Columbus, Macon, Athens.",
    metaDescription: "Play Fire Kirin, Juwa, Orion Stars and sweepstakes games online in Georgia. 50% welcome bonus.",
    cities: [
      { name: "Atlanta", slug: "atlanta", descriptionSnippet: "Atlanta's #1 sweepstakes fish table gaming platform" },
      { name: "Augusta", slug: "augusta", descriptionSnippet: "Augusta players access Fire Kirin, Juwa and 10 more games" },
      { name: "Savannah", slug: "savannah", descriptionSnippet: "Savannah online sweepstakes gaming" },
      { name: "Columbus", slug: "columbus-ga", descriptionSnippet: "Columbus GA sweepstakes games" },
      { name: "Macon", slug: "macon", descriptionSnippet: "Macon GA online slots" },
      { name: "Athens", slug: "athens-ga", descriptionSnippet: "Athens GA fish tables" },
    ],
  },
  "north-carolina": {
    name: "North Carolina", abbr: "NC", slug: "north-carolina",
    heroLede: "Spinora is available to players across North Carolina including Charlotte, Raleigh, Greensboro, Durham, Fayetteville.",
    metaDescription: "Play Fire Kirin, Juwa, Orion Stars and sweepstakes games online in North Carolina.",
    cities: [
      { name: "Charlotte", slug: "charlotte", descriptionSnippet: "Charlotte's leading online sweepstakes fish table platform" },
      { name: "Raleigh", slug: "raleigh", descriptionSnippet: "Raleigh players enjoy Fire Kirin, Juwa and 10 more games" },
      { name: "Greensboro", slug: "greensboro", descriptionSnippet: "Greensboro online sweepstakes gaming" },
      { name: "Durham", slug: "durham", descriptionSnippet: "Durham NC slots" },
      { name: "Fayetteville", slug: "fayetteville-nc", descriptionSnippet: "Fayetteville NC fish tables" },
    ],
  },
  ohio: {
    name: "Ohio", abbr: "OH", slug: "ohio",
    heroLede: "Spinora serves players across Ohio — Columbus, Cleveland, Cincinnati, Toledo, Akron, Dayton.",
    metaDescription: "Play Fire Kirin, Juwa, Orion Stars and sweepstakes games online in Ohio.",
    cities: [
      { name: "Columbus", slug: "columbus-oh", descriptionSnippet: "Columbus OH sweepstakes gaming" },
      { name: "Cleveland", slug: "cleveland", descriptionSnippet: "Cleveland online fish table games" },
      { name: "Cincinnati", slug: "cincinnati", descriptionSnippet: "Cincinnati players access all 12 Spinora games online" },
      { name: "Toledo", slug: "toledo", descriptionSnippet: "Toledo OH sweepstakes" },
      { name: "Akron", slug: "akron", descriptionSnippet: "Akron OH slots" },
      { name: "Dayton", slug: "dayton", descriptionSnippet: "Dayton OH games" },
    ],
  },
  "new-york": {
    name: "New York", abbr: "NY", slug: "new-york",
    heroLede: "Play online sweepstakes slots & fish tables across New York — NYC, Buffalo, Rochester, Syracuse, Albany.",
    metaDescription: "Play Fire Kirin, Juwa, Orion Stars in New York. 50% welcome bonus.",
    cities: [
      { name: "New York City", slug: "nyc", descriptionSnippet: "NYC online sweepstakes casino" },
      { name: "Buffalo", slug: "buffalo", descriptionSnippet: "Buffalo NY slots" },
      { name: "Rochester", slug: "rochester", descriptionSnippet: "Rochester NY fish tables" },
      { name: "Syracuse", slug: "syracuse", descriptionSnippet: "Syracuse NY sweepstakes" },
      { name: "Albany", slug: "albany", descriptionSnippet: "Albany NY games" },
    ],
  },
  illinois: {
    name: "Illinois", abbr: "IL", slug: "illinois",
    heroLede: "Illinois premier sweepstakes slots & fish tables online — Chicago, Aurora, Naperville, Rockford, Joliet.",
    metaDescription: "Play Fire Kirin, Juwa, Orion Stars in Illinois. 50% welcome bonus.",
    cities: [
      { name: "Chicago", slug: "chicago", descriptionSnippet: "Chicago online fish tables & slots" },
      { name: "Aurora", slug: "aurora", descriptionSnippet: "Aurora IL games" },
      { name: "Naperville", slug: "naperville", descriptionSnippet: "Naperville IL slots" },
      { name: "Rockford", slug: "rockford", descriptionSnippet: "Rockford IL sweepstakes" },
      { name: "Joliet", slug: "joliet", descriptionSnippet: "Joliet IL fish tables" },
    ],
  },
  pennsylvania: {
    name: "Pennsylvania", abbr: "PA", slug: "pennsylvania",
    heroLede: "Pennsylvania online sweepstakes casino — Philadelphia, Pittsburgh, Allentown, Erie, Reading.",
    metaDescription: "Play Fire Kirin, Juwa, Orion Stars in Pennsylvania. 50% welcome bonus.",
    cities: [
      { name: "Philadelphia", slug: "philadelphia", descriptionSnippet: "Philly online fish table games" },
      { name: "Pittsburgh", slug: "pittsburgh", descriptionSnippet: "Pittsburgh PA slots" },
      { name: "Allentown", slug: "allentown", descriptionSnippet: "Allentown PA games" },
      { name: "Erie", slug: "erie", descriptionSnippet: "Erie PA sweepstakes" },
    ],
  },
  michigan: {
    name: "Michigan", abbr: "MI", slug: "michigan",
    heroLede: "Michigan online sweepstakes games — Detroit, Grand Rapids, Warren, Sterling Heights, Lansing.",
    metaDescription: "Play Fire Kirin, Juwa, Orion Stars in Michigan. 50% welcome bonus.",
    cities: [
      { name: "Detroit", slug: "detroit", descriptionSnippet: "Detroit MI online fish tables" },
      { name: "Grand Rapids", slug: "grand-rapids", descriptionSnippet: "Grand Rapids MI slots" },
      { name: "Warren", slug: "warren", descriptionSnippet: "Warren MI sweepstakes" },
      { name: "Lansing", slug: "lansing", descriptionSnippet: "Lansing MI games" },
    ],
  },
  nevada: {
    name: "Nevada", abbr: "NV", slug: "nevada",
    heroLede: "Vegas-style online sweepstakes slots & fish tables — Las Vegas, Reno, Henderson, Sparks.",
    metaDescription: "Play Vegas Sweeps, Fire Kirin, Juwa in Nevada. 50% welcome bonus.",
    cities: [
      { name: "Las Vegas", slug: "las-vegas", descriptionSnippet: "Vegas online slots & fish table jackpots" },
      { name: "Reno", slug: "reno", descriptionSnippet: "Reno NV sweepstakes games" },
      { name: "Henderson", slug: "henderson", descriptionSnippet: "Henderson NV slots" },
      { name: "Sparks", slug: "sparks", descriptionSnippet: "Sparks NV games" },
    ],
  },
  arizona: {
    name: "Arizona", abbr: "AZ", slug: "arizona",
    heroLede: "Arizona online fish table games & slots — Phoenix, Tucson, Mesa, Chandler, Scottsdale.",
    metaDescription: "Play Fire Kirin, Juwa, Orion Stars in Arizona. 50% welcome bonus.",
    cities: [
      { name: "Phoenix", slug: "phoenix", descriptionSnippet: "Phoenix AZ online fish tables" },
      { name: "Tucson", slug: "tucson", descriptionSnippet: "Tucson AZ sweepstakes" },
      { name: "Mesa", slug: "mesa", descriptionSnippet: "Mesa AZ slots" },
      { name: "Scottsdale", slug: "scottsdale", descriptionSnippet: "Scottsdale AZ games" },
    ],
  },
} as const;

export type StateSlug = keyof typeof GEO_STATES;

export function getStateData(stateSlug: string): StateData | null {
  return (GEO_STATES as Record<string, StateData>)[stateSlug] ?? null;
}

export function getCityData(stateSlug: string, citySlug: string): CityData | null {
  const state = getStateData(stateSlug);
  if (!state) return null;
  return state.cities.find((c) => c.slug === citySlug) ?? null;
}

export function allStateSlugs(): string[] {
  return Object.keys(GEO_STATES);
}

export function allCityParams(): { state: string; city: string }[] {
  return Object.entries(GEO_STATES).flatMap(([stateSlug, stateData]) =>
    stateData.cities.map((city) => ({ state: stateSlug, city: city.slug }))
  );
}
