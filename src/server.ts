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
console.log("Initialized tokenizer:", tokenizer);


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
console.log("Initialized configuration:", configuration);
const openai = new OpenAIApi(configuration);
console.log("Initialized OpenAI API:", openai);


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
console.log("Initialized initial conversation state:", initialState);


// Define a function to update the prompt based on the user's responses
function getPrompt(state: ConversationState): string {
  const question = state.questions[state.currentQuestion];
  const answer = state.answers[state.currentQuestion] || "";
  const prompt = `${question}\n${answer}\n`.replace(/[\r\n]+/g, "");
  console.log("Updated prompt:", prompt);
  return prompt;
}

// Define a function to advance to the next question in the conversation
function advanceConversation(state: ConversationState): void {
  state.currentQuestion++;
  console.log("Advanced conversation to question:", state.currentQuestion);

}

// Define a function to check if the conversation is complete
function isConversationComplete(state: ConversationState): boolean {
  const isComplete = state.currentQuestion >= state.questions.length;
  console.log("Conversation is complete:", isComplete);
  return isComplete;
}

// Initialize the conversation state
let conversationState = initialState;
console.log("Initialized conversation state:", conversationState);


// Define the chat endpoint
app.post("/api/chat", async (req: Request, res: Response) => {
  const requestMessages: ChatCompletionRequestMessage[] = req.body.messages;
  console.log("Received request messages:", requestMessages);

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

    const prompt = getPrompt(conversationState).replace(/\r?\n|\r/g, "");

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

    const botResponse = completion.data.choices[0]?.text?.trim() ?? '';

    conversationState.answers[conversationState.currentQuestion] = botResponse;
    advanceConversation(conversationState);

    let finalResponse = botResponse;

    // Check if the conversation is complete and construct final response
    if (isConversationComplete(conversationState)) {
      conversationState = initialState;
      const answers = conversationState.answers.join("\n");
      finalResponse = `¡Gracias por responder a nuestras preguntas! Aquí está un resumen de tus respuestas:\n${answers}`;
    }

    res.json({ response: finalResponse });
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
