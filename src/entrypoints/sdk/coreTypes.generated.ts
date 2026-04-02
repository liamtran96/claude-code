export type SDKMessage = {
  type: string;
  uuid?: string;
  stdout?: string;
  [key: string]: unknown;
};

export type SDKUserMessage = SDKMessage;
export type SDKResultMessage = SDKMessage;
export type SDKResultSuccess = SDKMessage;
export type SDKSessionInfo = Record<string, unknown>;

export type SDKAssistantMessage = Extract<SDKMessage, { type: 'assistant' }>;
