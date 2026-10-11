/** Commands about the assistant itself: going back to standby and listing what it can do. */
import { replies } from '../replies.js';

export const sleep = {
  id: 'sleep',
  patterns: [/^(?:stop listening|go to sleep|sleep|go to standby|stand ?by|that'?s all|that will be all|that is all|goodbye|good bye|bye|never ?mind|dismissed?|stand down|you can go|stop)$/],
  handler: () => ({ ok: true }),
  speak: replies.sleep,
  // Tells the assistant to drop out of follow-up listening once the reply has been spoken.
  sleep: true,
};

export const help = {
  id: 'help',
  patterns: [/^(?:what can you do|what do you do|what are your commands|what commands (?:do you (?:know|have)|are there)|help(?: me)?|how do (?:i|you) (?:use|work)(?: you)?|what can i (?:say|ask)|list (?:your )?commands)$/],
  handler: () => ({ ok: true }),
  speak: replies.help,
};
