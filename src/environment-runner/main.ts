export async function environmentRunnerMain(args: string[]) {
  const [command, ...rest] = args;

  switch (command) {
    case 'start':
      return startRunner(rest);
    case 'once':
      return runOnce(rest);
    default:
      console.error(`Unknown environment-runner command: ${command}`);
      process.exit(1);
  }
}

async function startRunner(_args: string[]) {
  console.log('🌍 Starting environment runner...');

  setInterval(() => {
    console.log('Polling for jobs...');
  }, 5000);
}

async function runOnce(_args: string[]) {
  console.log('Run single job');
}
