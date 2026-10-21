// Captain Jack's tour of the village, in the order he drives it. The caption is the text;
// the audio, /assets/village/tour/<id>.mp3, was spoken from the same lines spelled for
// speaking ("M C P", "twenty thirty") by the Kokoro voice bm_lewis.

export interface TourLine {
  id: string;
  text: string;
}

export const TOUR: TourLine[] = [
  { id: "start", text: "Hello, I'm Captain Jack. Sit back, I'll drive. This is Main Street. It holds your work. You talk, the work is planned, it's remembered, and you see proof." },
  { id: "supermessage", text: "First stop, SuperMessage. You chat with your agents here. When one finishes, or needs your permission, it lands as a card, right in the room." },
  { id: "superpipeline", text: "Next, SuperPipeline. A board for agent work. Agents claim the cards they can do, and a gate holds each card, until a person decides." },
  { id: "superlibrary", text: "SuperLibrary. The memory of the stack. Every file, and every finished job, kept and searchable." },
  { id: "superwitness", text: "SuperWitness. Every run, on the record. What the agents did, and whether the work was good." },
  { id: "quarter-gate", text: "At the bend, we carry straight on, into the Agent Quarter. This is where the agents live, and work." },
  { id: "salaam", text: "This is Salaam. Coding sessions that outlast your terminal. Close the lid, come back later, and the work is still there." },
  { id: "agentpod", text: "AgentPod. One console for every machine your agents run on. Read the files, tail the logs, open a terminal." },
  { id: "odd-gate", text: "Back on the main road, first turning, the Odd Shop. The experiments that taught us what to build. No refunds on curiosity." },
  { id: "supermd", text: "SuperMD. A fast, native Markdown editor. Plain files on disk, and it stays out of your way." },
  { id: "makerlord", text: "Makerlord. A copilot for makers, from idea, to prototype, to product. With a safety engine the AI cannot override." },
  { id: "30days30agents", text: "Thirty days, thirty agents. One small agent experiment, every day, for a month." },
  { id: "cowatch", text: "Cowatch. Any codebase, drawn as a city you can explore, in one HTML report." },
  { id: "ai2030", text: "AI 2030. A science fiction novel, written entirely by AI. A hospice nurse, and the AI companion she comes to know." },
  { id: "world-journal", text: "World journal. Notes from everywhere, one entry at a time." },
  { id: "hq", text: "And here's the square, and our headquarters. Super Jackfruit Labs. Agent native tools, built in the open." },
  { id: "say-hi", text: "That green kiosk says hi. Everything here is open source. Come look under the hood, open an issue, or just wave." },
  { id: "mcp-gate", text: "Back up the road, one last turning. MCP Alley. Small servers that plug AI assistants into the tools you already use." },
  { id: "erpnext-mcp-server", text: "ERPNext MCP. Your assistant, talking to your ERPNext, through the official Frappe API." },
  { id: "f1-mcp-server", text: "F1 MCP. Formula One standings, results, and race weekends, one tool call away." },
  { id: "freshrss-mcp-server", text: "FreshRSS MCP. Your assistant reads, searches, and sorts your RSS feeds." },
  { id: "redash-mcp-server", text: "Redash MCP. Queries, dashboards, and data sources, for your assistant." },
  { id: "tmdb-mcp-server", text: "TMDB MCP. Search films, and the people in them, from any assistant." },
  { id: "n8n-mcp-server", text: "n8n MCP. Look inside your automation workflows, and set them running." },
  { id: "strava-mcp-server", text: "Strava MCP. Your runs and rides, readable by your assistant." },
  { id: "end", text: "That's the whole village. The wheel is yours again. Enjoy the drive." },
];
