export type Image = {
  name: string;
  displayName?: string;
  description?: string;
  logoUrl?: string;
  architectures?: string[];
  tags?: string[];
  categories?: string[];
  latestVersion?: string;
  firstBuild?: string;
  lastBuild?: string;
  sourceLinks: string[];
};

export type RequestResult = {
  title: string;
  status: 'open' | 'closed' | 'unknown';
  discussionUrl: string;
  createdBy?: string;
  createdDate?: string;
  lastActivityDate?: string;
  comments?: number;
  communitySignals?: {
    upvotes?: number;
    hasMaintainerResponse?: boolean | null;
    isDuplicateCandidate?: boolean;
  };
  requestInterpretation:
    | 'possible_pending_request'
    | 'closed_request_found'
    | 'possible_duplicate'
    | 'related_request'
    | 'not_enough_context';
  nextBestAction: string;
};

export type AuditCheck = {
  id: string;
  title: string;
  status: 'pass' | 'warn' | 'fail' | 'not_applicable';
  message: string;
  sourceLinks?: string[];
};

export type AuditOutput = {
  imageName: string;
  overall: 'pass' | 'warn' | 'fail';
  score: number;
  checks: AuditCheck[];
  recommendations: string[];
  disclaimer: string;
  sourceLinks: string[];
};
