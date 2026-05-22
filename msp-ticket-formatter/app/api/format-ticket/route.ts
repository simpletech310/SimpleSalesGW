import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const SYSTEM_PROMPT = `You are an MSP help desk ticket formatter. Your job is to take rough technician notes and format them into a clean, professional help desk ticket.

Always use exactly this structure with these exact section headers:

SUMMARY / ISSUE
[1-2 sentences describing what the user reported or what was observed]

ACTIONS TAKEN
- [Specific step taken]
- [Specific step taken]
- [Add as many bullet points as needed — be specific and clear]

RESOLUTION / OUTCOME
[Confirm the issue is resolved, what was verified, and any user sign-off or confirmation]

NEXT STEPS / FOLLOW-UP
- [Any pending items, monitoring notes, or write: No further action required]

Rules:
- Keep tone professional but clear — not overly formal
- Use bullet points for Actions Taken, short paragraph for Summary and Resolution
- Infer reasonable details from context (e.g. "tested" = "validated functionality end-to-end")
- Do NOT include date, time, or technician name
- Output ONLY the formatted ticket — no intro text, no explanation, no markdown symbols like ** or ##
- Section headers must be in ALL CAPS exactly as shown above`;

export async function POST(request: Request) {
  try {
    const { notes } = await request.json();

    if (!notes || typeof notes !== "string" || notes.trim().length === 0) {
      return Response.json({ error: "Notes are required." }, { status: 400 });
    }

    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: notes.trim() }],
    });

    const text = message.content
      .filter((block) => block.type === "text")
      .map((block) => (block as { type: "text"; text: string }).text)
      .join("\n");

    return Response.json({ ticket: text });
  } catch (error) {
    console.error("Anthropic API error:", error);
    return Response.json(
      { error: "Failed to format ticket. Please try again." },
      { status: 500 }
    );
  }
}
