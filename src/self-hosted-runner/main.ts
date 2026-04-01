export async function selfHostedRunnerMain(args: string[]) {
  const [command] = args;

  switch (command) {
    case 'start':
      return startSelfHosted();
    default:
      return startSelfHosted(); // default behavior
  }
}

async function startSelfHosted() {
  console.log('🤖 Registering self-hosted runner...');

  await register();

  console.log('📡 Polling for jobs...');

  while (true) {
    await poll();
    await sleep(5000);
  }
}

// ---- helpers ----

async function register() {
  console.log('Registered');
}

async function poll() {
  console.log('Polling...');
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
