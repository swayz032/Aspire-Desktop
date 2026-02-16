export type RiskTier = 'green' | 'yellow' | 'red';
export type EvidenceType = 'evidence-backed' | 'estimated';

export interface BusinessProfile {
  industry: string;
  stage: 'startup' | 'growth' | 'established' | 'enterprise';
  connectedTools: string[];
  companyName: string;
  employeeCount?: number;
}

export interface DailyQuote {
  id: string;
  quote: string;
  author: string;
  source?: string;
}

export interface GrowthLever {
  id: string;
  title: string;
  whyItMatters: string;
  whyYouSeeThis: string;
  roiExpectation: {
    type: 'time_saved' | 'cash_recovered' | 'revenue_potential';
    value: string;
    timeframe?: string;
  };
  riskTier: RiskTier;
  evidenceType: EvidenceType;
  packId?: string;
}

export interface MarketAngle {
  id: string;
  title: string;
  description: string;
  bullets: string[];
  whenItFits: string[];
  risksTradeoffs: string[];
  riskTier: RiskTier;
  evidenceType: EvidenceType;
}

export interface AdvisoryPack {
  id: string;
  name: string;
  description: string;
  includes: string[];
  requiredTools?: string[];
  templates: number;
  agentConfigs: number;
  installed?: boolean;
}

export interface RecommendedTool {
  id: string;
  name: string;
  icon: string;
  whatAspireUnlocks: string;
  connected: boolean;
  category: 'payments' | 'communication' | 'calendar' | 'crm' | 'accounting';
}

export interface RecommendedAgent {
  id: string;
  name: string;
  role: string;
  capabilities: string[];
  riskTier: RiskTier;
  avatarColor: string;
  configInstalled?: boolean;
}

export interface DraftArtifact {
  id: string;
  title: string;
  type: 'playbook' | 'template' | 'script' | 'sequence' | 'config' | 'agent_config' | 'tool_config';
  createdAt: string;
  sourceAction: string;
  status: 'draft' | 'pending_review';
}

export interface AdvisoryState {
  businessProfile: BusinessProfile;
  dailyQuote: DailyQuote;
  quoteHidden: boolean;
  growthLevers: GrowthLever[];
  marketAngles: MarketAngle[];
  advisoryPacks: AdvisoryPack[];
  recommendedTools: RecommendedTool[];
  recommendedAgents: RecommendedAgent[];
  draftArtifacts: DraftArtifact[];
}
