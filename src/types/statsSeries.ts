export type StatsSeriesRange = "7d" | "30d" | "90d";

export type StatsDailyPoint = {
  date: string;
  value: number;
};

export type StatsReactionWeekPoint = {
  week: string;
  likes: number;
  dislikes: number;
};

export type StatsPriceBucket = {
  label: string;
  min: number;
  max: number;
  count: number;
};

export type StatsDailySnapshotRow = {
  date: string;
  activeProperties: number;
  activePublications: number;
  medianPrice: number;
  priceDropCount: number;
};

export type StatsSeriesData = {
  range: StatsSeriesRange;
  snapshots: StatsDailySnapshotRow[];
  newProperties: StatsDailyPoint[];
  scrapes: StatsDailyPoint[];
  deactivations: StatsDailyPoint[];
  reactions: StatsReactionWeekPoint[];
  priceHistogram: StatsPriceBucket[];
};
