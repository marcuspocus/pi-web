import { appendText, appendThinking, normalizeMessage, textMessage } from "./chatMessages";
import type { ChatLine } from "./components/shared";
import { appendShellChunk, finalizeShellMessage, shellStartMessage } from "./shellMessages";
import type { SessionUiEvent } from "./sessionSocket";

export function applyTranscriptEvent(messages: ChatLine[], event: SessionUiEvent): ChatLine[] | undefined {
  if (event.type === "message.append") return appendNormalized(messages, event.message);
  if (event.type === "assistant.delta") return appendText(messages, "assistant", event.text);
  if (event.type === "assistant.thinking.delta") return appendThinking(messages, event.text);
  if (event.type === "tool.start") return appendNormalized(messages, { role: "assistant", content: [{ type: "toolCall", name: event.toolName, arguments: event.args }] });
  if (event.type === "tool.end") return appendNormalized(messages, { role: "toolResult", toolName: event.toolName, content: event.content ?? [{ type: "text", text: event.text }], isError: event.isError });
  if (event.type === "shell.start") return [...messages, shellStartMessage(event.command, event.excludeFromContext)];
  if (event.type === "shell.chunk") return appendShellChunk(messages, event.chunk);
  if (event.type === "shell.end") return finalizeShellMessage(messages, event);
  if (event.type === "command.output") return [...messages, textMessage(event.level === "error" ? "system" : "tool", event.message)];
  if (event.type === "session.error") return [...messages, textMessage("system", event.message)];
  if (event.type === "message.end") return event.message === undefined ? undefined : applyFinalMessage(messages, event.message);
  return undefined;
}

function applyFinalMessage(messages: ChatLine[], rawMessage: unknown): ChatLine[] | undefined {
  const ended = normalizeMessage(rawMessage)[0];
  if (ended === undefined) return undefined;
  const skillReadIndex = findMatchingSkillRead(messages, ended);
  if (skillReadIndex >= 0) return [...messages.slice(0, skillReadIndex), ended, ...messages.slice(skillReadIndex + 1)];
  const last = messages.at(-1);
  if (last?.role !== ended.role) return [...messages, ended];
  if (ended.role === "assistant" || sameMessageText(last, ended)) return [...messages.slice(0, -1), ended];
  return [...messages, ended];
}

function findMatchingSkillRead(messages: ChatLine[], ended: ChatLine): number {
  const endedReads = skillReads(ended);
  if (endedReads.length === 0) return -1;
  for (let index = messages.length - 1; index >= 0; index--) {
    const message = messages[index];
    if (message?.role !== "skill") continue;
    const reads = skillReads(message);
    if (sameSkillReads(reads, endedReads)) return index;
  }
  return -1;
}

function skillReads(message: ChatLine | undefined): SkillRead[] {
  if (message === undefined) return [];
  return message.parts.filter((part): part is SkillRead => part.type === "skillRead");
}

type SkillRead = Extract<ChatLine["parts"][number], { type: "skillRead" }>;

function sameSkillReads(left: SkillRead[], right: SkillRead[]): boolean {
  return left.length === right.length && left.every((read, index) => sameSkillRead(read, right[index]));
}

function sameSkillRead(left: SkillRead, right: SkillRead | undefined): boolean {
  if (right === undefined) return false;
  return normalizeSkillPath(left.path) === normalizeSkillPath(right.path) || left.name === right.name;
}

function normalizeSkillPath(path: string): string {
  return path.replace(/\\/g, "/");
}

function sameMessageText(left: ChatLine, right: ChatLine): boolean {
  return messageText(left) === messageText(right);
}

function messageText(message: ChatLine): string {
  return message.parts
    .filter((part): part is Extract<ChatLine["parts"][number], { type: "text" }> => part.type === "text")
    .map((part) => part.text)
    .join("\n\n");
}

function appendNormalized(messages: ChatLine[], rawMessage: unknown): ChatLine[] {
  return normalizeMessage(rawMessage).reduce(appendLine, messages);
}

function appendLine(messages: ChatLine[], line: ChatLine): ChatLine[] {
  const last = messages.at(-1);
  if (line.role === "skill" && sameSkillReads(skillReads(last), skillReads(line))) return messages;
  if (last?.role === line.role && line.role !== "skill") return [...messages.slice(0, -1), { ...last, parts: [...last.parts, ...line.parts] }];
  return [...messages, line];
}
