type WorkerFn = (arg?: string) => Promise<void> | void;

const workers: Record<string, WorkerFn> = {
  example: async (arg?: string) => {
    console.log('Running example worker with arg:', arg);
  },

  cleanup: async () => {
    console.log('Running cleanup worker...');
  }
};

export function registerWorker(name: string, fn: WorkerFn) {
  workers[name] = fn;
}

export async function runDaemonWorker(name?: string) {
  if (!name) {
    console.error('❌ No worker name provided');
    process.exit(1);
  }

  const worker = workers[name];

  if (!worker) {
    console.error(`❌ Unknown worker: ${name}`);
    console.error(`Available workers: ${Object.keys(workers).join(', ')}`);
    process.exit(1);
  }

  try {
    await worker(process.argv[3]); // optional extra arg
    process.exit(0);
  } catch (err) {
    console.error(`❌ Worker "${name}" failed:`, err);
    process.exit(1);
  }
}
