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

// Define an array of questions
const questions = [
  "Cuáles son tus hobbies e intereses?",
  "Cuáles son tus habilidades y fortalezas? Eres bueno con los números, con la comunicación, resolviendo problemas o en trabajos manuales?",
  "Prefieres trabajar solo o en equipo? Estás más interesado en trabajar en una oficina o al aire libre?",
  "Cuál es tu nivel más alto de estudios? Tienes algún certificado, entrenamiento o bootcamp?",
];

// Define a function to get the next question based on the current index
function getNextQuestion(currentIndex: number): string {
  if (currentIndex < questions.length) {
    return questions[currentIndex];
  }
  return "Ya hemos terminado con las preguntas. ¿Hay algo más en lo que pueda ayudarte?";
}

// Define a variable to keep track of the current question index
let currentQuestionIndex = 0;

// Define the app.post endpoint
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

    // If we haven't finished all the questions, get the next question and update the current question index
    if (currentQuestionIndex < questions.length) {
      const prompt = getNextQuestion(currentQuestionIndex);
      tokenCount += getTokens(prompt);
      if (tokenCount > 4000) {
        return res.status(400).send("Message is too long");
      }

      const apiRequestBody: CreateChatCompletionRequest = {
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: prompt },
          ...requestMessages,
        ],
        temperature: 0.6,
      };
      const completion = await openai.createChatCompletion(apiRequestBody);

      currentQuestionIndex++;
      res.json(completion.data);
    } else {
      // If we have finished all the questions, just send a confirmation message
      const apiRequestBody: CreateChatCompletionRequest = {
        model: "davinci",
        messages: [
          { role: "system", content: "Gracias por responder todas las preguntas." },
          ...requestMessages,
        ],
        temperature: 0.6,
      };
      const completion = await openai.createChatCompletion(apiRequestBody);

      res.json(completion.data);
    }
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

