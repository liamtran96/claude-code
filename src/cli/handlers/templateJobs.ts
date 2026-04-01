export async function templatesMain(args: string[]) {
  const cmd = args[0];

  switch (cmd) {
    case 'new':
      return handleNew(args.slice(1));
    case 'list':
      return handleList(args.slice(1));
    case 'reply':
      return handleReply(args.slice(1));
    default:
      console.error(`Unknown template command: ${cmd}`);
      process.exit(1);
  }
}

// ---- handlers ----

async function handleNew(args: string[]) {
  const [name] = args;
  console.log('Create template:', name);
}

async function handleList() {
  console.log('List templates');
}

async function handleReply(args: string[]) {
  const [id] = args;
  console.log('Reply to template:', id);
}
