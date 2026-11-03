"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles, Send, Quote, AlertCircle, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/primitives";
import { Select } from "@/components/ui/fields";
import { cn } from "@/lib/utils";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: { title: string; chunk_id?: string; similarity: number }[];
  pending?: boolean;
}

/**
 * Interface du tuteur IA.
 * Aucune réponse n'est fabriquée côté navigateur : si l'API signifie que le
 * tuteur n'est pas configuré, l'interface l'affiche tel quel.
 */
export function AiChat({
  configured,
  conversations,
  courses,
  defaultCourseId,
  quota,
}: {
  configured: boolean;
  conversations: { id: string; title: string }[];
  courses: { id: string; title: string }[];
  defaultCourseId?: string;
  quota: { used: number; limit: number };
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [courseId, setCourseId] = useState(defaultCourseId ?? "");
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(Math.max(quota.limit - quota.used, 0));
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function send(event: React.FormEvent) {
    event.preventDefault();
    const question = input.trim();
    if (!question || sending) return;

    setError(null);
    setInput("");
    const userMessage: ChatMessage = { id: `u-${Date.now()}`, role: "user", content: question };
    const pendingMessage: ChatMessage = {
      id: `a-${Date.now()}`,
      role: "assistant",
      content: "",
      pending: true,
    };
    setMessages((current) => [...current, userMessage, pendingMessage]);
    setSending(true);

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: question,
          courseId: courseId || undefined,
          conversationId,
        }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setMessages((current) => current.filter((message) => message.id !== pendingMessage.id));
        setError(payload.message ?? "Le tuteur n'a pas pu répondre.");
        return;
      }

      setConversationId(payload.conversationId);
      setRemaining((value) => Math.max(value - 1, 0));
      setMessages((current) =>
        current.map((message) =>
          message.id === pendingMessage.id
            ? {
                ...message,
                pending: false,
                content: payload.content,
                citations: payload.citations ?? [],
              }
            : message,
        ),
      );
    } catch {
      setMessages((current) => current.filter((message) => message.id !== pendingMessage.id));
      setError("Connexion interrompue. Vérifiez votre réseau et réessayez.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
      {/* Conversations */}
      <aside className="order-2 rounded-2xl border border-night-100 bg-white p-3 lg:order-1">
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => {
            setMessages([]);
            setConversationId(undefined);
            setError(null);
          }}
        >
          <Plus className="h-4 w-4" aria-hidden />
          Nouvelle conversation
        </Button>

        <div className="mt-3">
          <label htmlFor="course-select" className="mb-1.5 block text-xs font-medium text-night-500">
            Formation de référence {configured ? "" : "(tuteur inactif)"}
          </label>
          <Select
            id="course-select"
            value={courseId}
            onChange={(event) => setCourseId(event.target.value)}
          >
            <option value="">Aucune (question générale)</option>
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.title}
              </option>
            ))}
          </Select>
          <p className="mt-1.5 text-[11px] leading-snug text-night-300">
            Avec une formation sélectionnée, le tuteur répond à partir de ses documents validés.
          </p>
        </div>

        {conversations.length > 0 && (
          <div className="mt-4 border-t border-night-100 pt-3">
            <p className="px-1 text-[11px] font-semibold uppercase tracking-wider text-night-300">
              Conversations récentes
            </p>
            <ul className="mt-1.5 space-y-0.5">
              {conversations.slice(0, 8).map((conversation) => (
                <li key={conversation.id}>
                  <a
                    href={`/app/tuteur-ia?conversation=${conversation.id}`}
                    className="block truncate rounded-lg px-2 py-1.5 text-xs text-night-500 hover:bg-night-50"
                  >
                    {conversation.title}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </aside>

      {/* Zone de conversation */}
      <section className="order-1 flex min-h-[560px] flex-col rounded-2xl border border-night-100 bg-white lg:order-2">
        <header className="flex items-center justify-between border-b border-night-100 px-5 py-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gold-50 text-gold-600">
              <Sparkles className="h-4 w-4" aria-hidden />
            </span>
            <div>
              <p className="text-sm font-semibold">DIGINIGER AI Tutor</p>
              <p className="text-[11px] text-night-400">
                {configured ? "Réponses fondées sur vos cours" : "Non configuré sur cette installation"}
              </p>
            </div>
          </div>
          <span
            className={cn(
              "rounded-full px-2.5 py-1 text-[11px] font-medium",
              remaining > 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700",
            )}
          >
            {remaining} / {quota.limit} messages
          </span>
        </header>

        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-5">
          {!configured && (
            <Alert tone="warning" title="Tuteur IA non activé">
              La clé du fournisseur de modèles n&apos;est pas configurée sur ce serveur. Aucune
              réponse simulée n&apos;est affichée : ajoutez{" "}
              <code className="rounded bg-white px-1">OPENAI_API_KEY</code> pour activer le tuteur.
            </Alert>
          )}

          {messages.length === 0 && configured && (
            <div className="py-10 text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gold-50 text-gold-600">
                <Sparkles className="h-6 w-6" aria-hidden />
              </span>
              <p className="mt-4 font-semibold">Posez votre première question</p>
              <p className="mx-auto mt-1.5 max-w-sm text-sm text-night-400">
                Exemple : « Explique-moi la différence entre TVA collectée et TVA déductible ».
                Sélectionnez une formation pour des réponses ancrées dans le cours.
              </p>
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}
            >
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
                  message.role === "user"
                    ? "bg-electric-500 text-white"
                    : "border border-night-100 bg-mist text-night-700",
                )}
              >
                {message.pending ? (
                  <span className="flex items-center gap-2 text-night-400">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    Le tuteur réfléchit…
                  </span>
                ) : (
                  <>
                    <p className="whitespace-pre-wrap">{message.content}</p>
                    {message.citations && message.citations.length > 0 && (
                      <div className="mt-3 border-t border-night-200 pt-2">
                        <p className="flex items-center gap-1 text-[11px] font-medium text-night-400">
                          <Quote className="h-3 w-3" aria-hidden />
                          Sources du cours
                        </p>
                        <ul className="mt-1 space-y-0.5">
                          {message.citations.map((citation) => (
                            <li key={citation.chunk_id} className="text-[11px] text-night-400">
                              {citation.title} · pertinence{" "}
                              {Math.round(citation.similarity * 100)} %
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>

        {error && (
          <div className="px-5 pb-3">
            <Alert tone="error">
              <span className="flex items-start gap-1.5">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                {error}
              </span>
            </Alert>
          </div>
        )}

        <form onSubmit={send} className="border-t border-night-100 p-4">
          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  send(event);
                }
              }}
              rows={1}
              maxLength={2000}
              disabled={!configured || sending || remaining === 0}
              placeholder={
                !configured
                  ? "Tuteur inactif"
                  : remaining === 0
                    ? "Quota quotidien atteint"
                    : "Écrivez votre question…"
              }
              aria-label="Votre question"
              className="max-h-40 min-h-[44px] flex-1 resize-y rounded-xl border border-night-200 px-3.5 py-3 text-sm placeholder:text-night-300 focus:border-electric-500 focus:outline-none focus:ring-2 focus:ring-electric-100 disabled:bg-night-50"
            />
            <Button
              type="submit"
              size="md"
              loading={sending}
              disabled={!configured || !input.trim() || remaining === 0}
            >
              <Send className="h-4 w-4" aria-hidden />
              <span className="hidden sm:inline">Envoyer</span>
            </Button>
          </div>
          <p className="mt-2 text-[11px] text-night-300">
            Le tuteur peut se tromper. Vérifiez les points importants avec votre formateur.
            Chaque échange est journalisé.
          </p>
        </form>
      </section>
    </div>
  );
}
