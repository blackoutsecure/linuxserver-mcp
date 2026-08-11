export type Image = {
  name: string;
  displayName?: string;
  description?: string;
  logoUrl?: string;
  architectures?: string[];
  tags?: string[];
  categories?: string[];
  latestVersion?: string;
  lastBuild?: string;
  sourceLinks: string[];
};
export type RequestResult = {
  title: string;
  status: string;
  discussionUrl: string;
  comments?: number;
  communitySignals?: {
    upvotes?: number;
    hasMaintainerResponse?: boolean | null;
    isDuplicateCandidate?: boolean;
  };
  requestInterpretation: string;
  nextBestAction: string;
};
export type Pipeline = {
  recommendation: string;
  reason: string;
  nextBestAction: string;
  openRequests: Array<{ title: string; url: string; status: string }>;
  closedRequests: Array<{ title: string; url: string; status: string }>;
  knownIssueContext: Array<{ title: string; url: string }>;
  disclaimer: string;
};
export type Audit = {
  overall: string;
  score: number;
  checks: Array<{ id: string; title: string; status: string; message: string }>;
  recommendations: string[];
  disclaimer: string;
  sourceLinks: string[];
};
