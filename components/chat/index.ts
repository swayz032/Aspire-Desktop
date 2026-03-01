/**
 * Chat Component Barrel Export
 *
 * Shared types, utilities, and components for the unified
 * chat system across all 6 Aspire agent chat surfaces.
 */

// Types
export type {
  AgentId,
  FileAttachment,
  AgentActivityEvent,
  ActiveRun,
  AgentChatMessage,
  OrchestratorResponse,
} from './types';

export { AGENT_COLORS } from './types';

// Activity builder
export { buildActivityFromResponse, resetEventCounter } from './buildActivity';

// Shared UI components
export { MessageBubble } from './MessageBubble';
export { ActivityTimeline } from './ActivityTimeline';
export { ThinkingIndicator } from './ThinkingIndicator';
export { ChatInputBar } from './ChatInputBar';

// Wave 6: Premium interaction components
export {
  ChainOfThought,
  ChainOfThoughtHeader,
  ChainOfThoughtContent,
  ChainOfThoughtStep,
  ChainOfThoughtSearchResults,
  ChainOfThoughtSearchResult,
  ChainOfThoughtImage,
} from './ChainOfThought';
export type { StepStatus } from './ChainOfThought';

export {
  Attachments,
  Attachment,
  AttachmentPreview,
  AttachmentInfo,
  AttachmentRemove,
  AttachmentEmpty,
  formatFileSize,
  getAttachmentLabel,
  getMediaCategory,
} from './Attachments';

export {
  Reasoning,
  ReasoningTrigger,
  ReasoningContent,
  useReasoning,
} from './Reasoning';
