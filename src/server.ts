import express, { Request, Response } from "express";
import cors from "cors";
import {
  ChatCompletionRequestMessage,
  CreateChatCompletionRequest,
  Configuration,
  OpenAIApi,
} from "openai";
import dotenv from "dotenv";
import bodyParser from "body-parser";
import GPT3TokenizerImport from "gpt3-tokenizer";

const GPT3Tokenizer: typeof GPT3TokenizerImport =
  typeof GPT3TokenizerImport === "function"
    ? GPT3TokenizerImport
    : (GPT3TokenizerImport as any).default;

const tokenizer = new GPT3Tokenizer({ type: "gpt3" });

function getTokens(input: string): number {
  const tokens = tokenizer.encode(input);
  return tokens.text.length;
}

dotenv.config();

const port = process.env.PORT || 80;
const app = express();
app.use(bodyParser.json());
app.use(
  cors({
    origin: "*",
  })
);

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

// Define an object to keep track of the conversation state
interface ConversationState {
  currentQuestion: number;
  questions: string[];
  answers: string[];
}

// Initialize the conversation state
const initialState: ConversationState = {
  currentQuestion: 0,
  questions: [
    "Cuáles son tus hobbies e intereses?",
    "Cuáles son tus habilidades y fortalezas? Eres bueno con los números, con la comunicación, resolviendo problemas, o en trabajos manuales?",
    "Prefieres trabajar solo o en equipo? Estás más interesado en trabajar en una oficina, o al aire libre?",
    "Cuál es tu nivel más alto de estudios? Tienes algún certificado, entrenamiento o bootcamp?",
  ],
  answers: [],
};

// Define a function to update the prompt based on the user's responses
function getPrompt(state: ConversationState): string {
  const question = state.questions[state.currentQuestion];
  const answer = state.answers[state.currentQuestion] || "";
  return `${question}\n${answer}\n`;
}

// Define a function to advance to the next question in the conversation
function advanceConversation(state: ConversationState): void {
  state.currentQuestion++;
}

// Define a function to check if the conversation is complete
function isConversationComplete(state: ConversationState): boolean {
  return state.currentQuestion >= state.questions.length;
}

// Initialize the conversation state
let conversationState = initialState;

// Define the chat endpoint
app.post("/api/chat", async (req: Request, res: Response) => {
  const requestMessages: ChatCompletionRequestMessage[] = req.body.messages;

  try {
    let tokenCount = 0;

    requestMessages.forEach((msg) => {
      const tokens = getTokens(msg.content);
      tokenCount += tokens;
    });

    const moderationResponse = await openai.createModeration({
      input: requestMessages[requestMessages.length - 1].content,
    });
    if (moderationResponse.data.results[0]?.flagged) {
      return res.status(400).send("Message is inappropriate");
    }

    const prompt = getPrompt(conversationState);

    tokenCount += getTokens(prompt);
    if (tokenCount > 4000) {
      return res.status(400).send("Message is too long");
    }

    const apiRequestBody: CreateChatCompletionRequest = {
      model: "gpt-3.5-turbo",
      messages: [{ role: "system", content: prompt }, ...requestMessages],
      temperature: 0.6,
    };
    const completion = await openai.createCompletion(apiRequestBody);

    const response = completion.data.choices[0]?.text?.trim() ?? '';
    conversationState.answers[conversationState.currentQuestion] = response;
    advanceConversation(conversationState);

    if (isConversationComplete(conversationState)) {
      conversationState = initialState;
    }

    res.json(completion.data);
  } catch (error) {
    if (error instanceof Error) {
      console.error(error);
    }
    res.status(500).send("Something went wrong");
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server started at http://localhost:${port}`);
});
