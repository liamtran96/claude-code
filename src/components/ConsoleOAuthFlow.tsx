import React, { useCallback, useEffect, useRef, useState } from 'react';

import {
  type AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
  logEvent
} from 'src/services/analytics/index.js';
import { installOAuthTokens } from '../cli/handlers/auth.js';
import { useTerminalSize } from '../hooks/useTerminalSize.js';
import { setClipboard } from '../ink/termio/osc.js';
import { useTerminalNotification } from '../ink/useTerminalNotification.js';
import { Box, Link, Text } from '../ink.js';
import { useKeybinding } from '../keybindings/useKeybinding.js';
import { getSSLErrorHint } from '../services/api/errorUtils.js';
import { sendNotification } from '../services/notifier.js';
import { OAuthService } from '../services/oauth/index.js';
import { getOauthAccountInfo, validateForceLoginOrg } from '../utils/auth.js';
import { logError } from '../utils/log.js';
import { getSettings_DEPRECATED } from '../utils/settings/settings.js';

import { Select } from './CustomSelect/select.js';
import { KeyboardShortcutHint } from './design-system/KeyboardShortcutHint.js';
import { Spinner } from './Spinner.js';
import TextInput from './TextInput.js';

type Props = {
  onDone(): void;
  startingMessage?: string;
  mode?: 'login' | 'setup-token';
  forceLoginMethod?: 'claudeai' | 'console';
};

type OAuthStatus =
  | { state: 'idle' }
  | { state: 'platform_setup' }
  | { state: 'openapi_setup' }
  | { state: 'ready_to_start' }
  | { state: 'waiting_for_login'; url: string }
  | { state: 'creating_api_key' }
  | { state: 'about_to_retry'; nextState: OAuthStatus }
  | { state: 'success'; token?: string }
  | { state: 'error'; message: string; toRetry?: OAuthStatus };

const PASTE_HERE_MSG = 'Paste code here if prompted > ';

/* ──────────────────────────────────────────────────────────────
   Small, meaningful UI components
   ────────────────────────────────────────────────────────────── */

function LoginMethodSelector({
  startingMessage,
  setOAuthStatus,
  setLoginWithClaudeAi
}: {
  startingMessage?: string;
  setOAuthStatus: (status: OAuthStatus) => void;
  setLoginWithClaudeAi: (value: boolean) => void;
}) {
  const message =
    startingMessage ??
    'Claude Code can be used with your Claude subscription or billed based on API usage through your Console account.';

  const options = [
    {
      label: (
        <Text>
          Claude account with subscription ·{' '}
          <Text dimColor>Pro, Max, Team, or Enterprise</Text>
        </Text>
      ),
      value: 'claudeai'
    },
    {
      label: (
        <Text>
          Anthropic Console account · <Text dimColor>API usage billing</Text>
        </Text>
      ),
      value: 'console'
    },
    {
      label: (
        <Text>
          3rd-party platform ·{' '}
          <Text dimColor>Amazon Bedrock, Microsoft Foundry, or Vertex AI</Text>
        </Text>
      ),
      value: 'platform'
    },
    {
      label: (
        <Text>
          OpenAI-compatible API ·{' '}
          <Text dimColor>Ollama local, Groq, OpenAI, Together.ai, etc.</Text>
        </Text>
      ),
      value: 'openapi'
    }
  ];

  return (
    <Box flexDirection="column" gap={1} marginTop={1}>
      <Text bold>{message}</Text>
      <Text>Select login method:</Text>
      <Box>
        <Select
          options={options}
          onChange={(value) => {
            if (value === 'platform') {
              logEvent('tengu_oauth_platform_selected', {});
              setOAuthStatus({ state: 'platform_setup' });
            } else if (value === 'openapi') {
              logEvent('tengu_oauth_openapi_selected', {});
              setOAuthStatus({ state: 'openapi_setup' });
            } else {
              setOAuthStatus({ state: 'ready_to_start' });
              if (value === 'claudeai') {
                logEvent('tengu_oauth_claudeai_selected', {});
                setLoginWithClaudeAi(true);
              } else {
                logEvent('tengu_oauth_console_selected', {});
                setLoginWithClaudeAi(false);
              }
            }
          }}
        />
      </Box>
    </Box>
  );
}

function PlatformSetupInfo() {
  return (
    <Box flexDirection="column" gap={1} marginTop={1}>
      <Text bold>Using 3rd-party platforms</Text>
      <Box flexDirection="column" gap={1}>
        <Text>
          Claude Code supports Amazon Bedrock, Microsoft Foundry, and Vertex AI.
          Set the required environment variables, then restart Claude Code.
        </Text>
        <Text>
          If you are part of an enterprise organization, contact your
          administrator for setup instructions.
        </Text>

        <Box flexDirection="column" marginTop={1}>
          <Text bold>Documentation:</Text>
          <Text>
            · Amazon Bedrock:{' '}
            <Link url="https://code.claude.com/docs/en/amazon-bedrock">
              https://code.claude.com/docs/en/amazon-bedrock
            </Link>
          </Text>
          <Text>
            · Microsoft Foundry:{' '}
            <Link url="https://code.claude.com/docs/en/microsoft-foundry">
              https://code.claude.com/docs/en/microsoft-foundry
            </Link>
          </Text>
          <Text>
            · Vertex AI:{' '}
            <Link url="https://code.claude.com/docs/en/google-vertex-ai">
              https://code.claude.com/docs/en/google-vertex-ai
            </Link>
          </Text>
        </Box>

        <Box marginTop={1}>
          <Text dimColor>
            Press <Text bold>Enter</Text> to go back to login options.
          </Text>
        </Box>
      </Box>
    </Box>
  );
}

function OpenAPISetupInfo() {
  return (
    <Box flexDirection="column" gap={1} marginTop={1}>
      <Text bold>Using OpenAI-compatible APIs</Text>
      <Box flexDirection="column" gap={1}>
        <Text>
          Claude Code now supports OpenAI-compatible endpoints. Perfect for
          local models (Ollama) or hosted providers like Groq, Together.ai,
          OpenAI, Fireworks, etc.
        </Text>

        <Text bold>For Ollama local (example):</Text>
        <Text>
          1. Run <Text bold>ollama serve</Text> in a separate terminal
        </Text>
        <Text>
          2. Set these environment variables before starting Claude Code:
        </Text>
        <Text> OPENAI_API_BASE=http://localhost:11434/v1</Text>
        <Text> OPENAI_API_KEY=ollama</Text>

        <Text>
          For other providers check their docs for the correct base URL and API
          key.
        </Text>
        <Text>Restart Claude Code after setting the variables.</Text>

        <Box marginTop={1}>
          <Text dimColor>
            Press <Text bold>Enter</Text> to go back to login options.
          </Text>
        </Box>

        <Box flexDirection="column" marginTop={1}>
          <Text bold>Documentation:</Text>
          <Text>
            · Ollama: <Link url="https://ollama.com">https://ollama.com</Link>
          </Text>
        </Box>
      </Box>
    </Box>
  );
}

function WaitingForLogin({
  forcedMethodMessage,
  showPastePrompt,
  pastedCode,
  setPastedCode,
  cursorOffset,
  setCursorOffset,
  textInputColumns,
  handleSubmitCode,
  url
}: {
  forcedMethodMessage: string | null;
  showPastePrompt: boolean;
  pastedCode: string;
  setPastedCode: (value: string) => void;
  cursorOffset: number;
  setCursorOffset: (offset: number) => void;
  textInputColumns: number;
  handleSubmitCode: (value: string, url: string) => void;
  url: string;
}) {
  return (
    <Box flexDirection="column" gap={1}>
      {forcedMethodMessage && (
        <Box>
          <Text dimColor>{forcedMethodMessage}</Text>
        </Box>
      )}

      {!showPastePrompt && (
        <Box>
          <Spinner />
          <Text>Opening browser to sign in…</Text>
        </Box>
      )}

      {showPastePrompt && (
        <Box>
          <Text>{PASTE_HERE_MSG}</Text>
          <TextInput
            value={pastedCode}
            onChange={setPastedCode}
            onSubmit={(value) => handleSubmitCode(value, url)}
            cursorOffset={cursorOffset}
            onChangeCursorOffset={setCursorOffset}
            columns={textInputColumns}
            mask="*"
          />
        </Box>
      )}
    </Box>
  );
}

function SuccessMessage({
  mode,
  token
}: {
  mode: 'login' | 'setup-token';
  token?: string;
}) {
  if (mode === 'setup-token' && token) return null;

  const email = getOauthAccountInfo()?.emailAddress;
  return (
    <Box flexDirection="column">
      {email && (
        <Text dimColor>
          Logged in as <Text>{email}</Text>
        </Text>
      )}
      <Text color="success">
        Login successful. Press <Text bold>Enter</Text> to continue…
      </Text>
    </Box>
  );
}

function ErrorMessage({
  message,
  toRetry
}: {
  message: string;
  toRetry?: OAuthStatus;
}) {
  return (
    <Box flexDirection="column" gap={1}>
      <Text color="error">OAuth error: {message}</Text>
      {toRetry && (
        <Box marginTop={1}>
          <Text color="permission">
            Press <Text bold>Enter</Text> to retry.
          </Text>
        </Box>
      )}
    </Box>
  );
}

/* ──────────────────────────────────────────────────────────────
   Main OAuth Flow Component
   ────────────────────────────────────────────────────────────── */

export function ConsoleOAuthFlow({
  onDone,
  startingMessage,
  mode = 'login',
  forceLoginMethod: forceLoginMethodProp
}: Props): React.ReactNode {
  const settings = getSettings_DEPRECATED() || {};
  const forceLoginMethod = forceLoginMethodProp ?? settings.forceLoginMethod;
  const orgUUID = settings.forceLoginOrgUUID;

  const forcedMethodMessage =
    forceLoginMethod === 'claudeai'
      ? 'Login method pre-selected: Subscription Plan (Claude Pro/Max)'
      : forceLoginMethod === 'console'
        ? 'Login method pre-selected: API Usage Billing (Anthropic Console)'
        : null;

  const terminal = useTerminalNotification();

  const [oauthStatus, setOAuthStatus] = useState<OAuthStatus>(() => {
    if (
      mode === 'setup-token' ||
      forceLoginMethod === 'claudeai' ||
      forceLoginMethod === 'console'
    ) {
      return { state: 'ready_to_start' };
    }
    return { state: 'idle' };
  });

  const [pastedCode, setPastedCode] = useState('');
  const [cursorOffset, setCursorOffset] = useState(0);
  const [oauthService] = useState(() => new OAuthService());
  const [loginWithClaudeAi, setLoginWithClaudeAi] = useState(
    () => mode === 'setup-token' || forceLoginMethod === 'claudeai'
  );

  const [showPastePrompt, setShowPastePrompt] = useState(false);
  const [urlCopied, setUrlCopied] = useState(false);

  const textInputColumns =
    useTerminalSize().columns - PASTE_HERE_MSG.length - 1;

  // Handle manual code paste (when user types and presses Enter)
  const handleSubmitCode = useCallback(
    async (value: string, url: string) => {
      try {
        const [authorizationCode, state] = value.split('#');
        if (!authorizationCode || !state) {
          setOAuthStatus({
            state: 'error',
            message: 'Invalid code. Please make sure the full code was copied',
            toRetry: { state: 'waiting_for_login', url }
          });
          return;
        }

        logEvent('tengu_oauth_manual_entry', {});
        oauthService.handleManualAuthCodeInput({ authorizationCode, state });
      } catch (err: unknown) {
        logError(err);
        setOAuthStatus({
          state: 'error',
          message: (err as Error).message,
          toRetry: { state: 'waiting_for_login', url }
        });
      }
    },
    [oauthService]
  );

  // ... (the rest of your hooks - startOAuth, useEffects, useKeybindings - are exactly the same as before)
  // For brevity I only show the fixed render part here.
  // If you need the full hook section again just tell me.

  return (
    <Box flexDirection="column" gap={1}>
      {/* URL copy helper when browser doesn't open */}
      {oauthStatus.state === 'waiting_for_login' && showPastePrompt && (
        <Box flexDirection="column" key="urlToCopy" gap={1} paddingBottom={1}>
          <Box paddingX={1}>
            <Text dimColor>
              Browser didn&apos;t open? Use the url below to sign in{' '}
            </Text>
            {urlCopied ? (
              <Text color="success">(Copied!)</Text>
            ) : (
              <Text dimColor>
                <KeyboardShortcutHint shortcut="c" action="copy" parens />
              </Text>
            )}
          </Box>
          <Link url={oauthStatus.url}>
            <Text dimColor>{oauthStatus.url}</Text>
          </Link>
        </Box>
      )}

      {/* Long-lived token display for setup-token mode */}
      {mode === 'setup-token' &&
        oauthStatus.state === 'success' &&
        oauthStatus.token && (
          <Box key="tokenOutput" flexDirection="column" gap={1} paddingTop={1}>
            <Text color="success">
              ✓ Long-lived authentication token created successfully!
            </Text>
            <Box flexDirection="column" gap={1}>
              <Text>Your OAuth token (valid for 1 year):</Text>
              <Text color="warning">{oauthStatus.token}</Text>
              <Text dimColor>
                Store this token securely. You won&apos;t be able to see it
                again.
              </Text>
              <Text dimColor>
                Use this token by setting: export
                CLAUDE_CODE_OAUTH_TOKEN=&lt;token&gt;
              </Text>
            </Box>
          </Box>
        )}

      <Box paddingLeft={1} flexDirection="column" gap={1}>
        {oauthStatus.state === 'idle' && (
          <LoginMethodSelector
            startingMessage={startingMessage}
            setOAuthStatus={setOAuthStatus}
            setLoginWithClaudeAi={setLoginWithClaudeAi}
          />
        )}

        {oauthStatus.state === 'platform_setup' && <PlatformSetupInfo />}
        {oauthStatus.state === 'openapi_setup' && <OpenAPISetupInfo />}

        {oauthStatus.state === 'waiting_for_login' && (
          <WaitingForLogin
            forcedMethodMessage={forcedMethodMessage}
            showPastePrompt={showPastePrompt}
            pastedCode={pastedCode}
            setPastedCode={setPastedCode}
            cursorOffset={cursorOffset}
            setCursorOffset={setCursorOffset}
            textInputColumns={textInputColumns}
            handleSubmitCode={handleSubmitCode}
            url={oauthStatus.url}
          />
        )}

        {oauthStatus.state === 'creating_api_key' && (
          <Box flexDirection="column" gap={1}>
            <Box>
              <Spinner />
              <Text>Creating API key for Claude Code…</Text>
            </Box>
          </Box>
        )}

        {oauthStatus.state === 'about_to_retry' && (
          <Text color="permission">Retrying…</Text>
        )}

        {oauthStatus.state === 'success' && (
          <SuccessMessage mode={mode} token={oauthStatus.token} />
        )}

        {oauthStatus.state === 'error' && (
          <ErrorMessage
            message={oauthStatus.message}
            toRetry={oauthStatus.toRetry}
          />
        )}
      </Box>
    </Box>
  );
}
