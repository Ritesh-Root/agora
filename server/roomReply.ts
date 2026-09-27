import type { MentionAgent } from '../shared/mentions';
import type { LLMLike } from './society/provider';

/**
 * One pass of the team talking in the room.
 * Each speaker sees the transcript at the moment they talk, so a person
 * who types during the pass is included in the later replies.
 */
export async function runRoomDiscussion(options: {
  speakers: MentionAgent[];
  teammates: MentionAgent[];
  provider: LLMLike;
  model?: string;
  transcript: () => string;
  post: (name: string, text: string) => void;
}): Promise<Array<{ name: string; text: string }>> {
  const posted: Array<{ name: string; text: string }> = [];
  for (const speaker of options.speakers) {
    const others = options.teammates
      .filter((agent) => agent.name !== speaker.name)
      .map((agent) => agent.name)
      .join(', ');
    const group = options.speakers.length > 1;
    const system = group
      ? [
          `You are ${speaker.name}. ${speaker.description}`,
          others ? `Your teammates in this room are ${others}.` : 'You are speaking with the human.',
          'The whole session can see this. Discuss the idea with your teammates before any project starts. Do not write the deliverable.',
          'At most 3 sentences. Address a teammate by name when you answer them. The human may jump in between turns.',
        ].join(' ')
      : [
          `You are ${speaker.name}. ${speaker.description}`,
          'The human wrote only to you. Other people in the session cannot see this. Answer them directly.',
          'This is a conversation before any project starts. Do not write the deliverable. At most 3 sentences.',
        ].join(' ');
    const transcript = options.transcript().trim();
    const result = await options.provider.generateCompletion(
      [{ role: 'user', content: `Conversation so far:\n${transcript}\n\nReply as ${speaker.name}.` }],
      undefined,
      system,
      options.model,
    );
    const text = (result.content || '').trim().slice(0, 600);
    if (!text) continue;
    posted.push({ name: speaker.name, text });
    options.post(speaker.name, text);
  }
  return posted;
}
