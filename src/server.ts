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

app.post("/api/chat", async (req: Request, res: Response) => {

  const questions = [
    "Cuáles son tus hobbies e intereses?",
    "Cuáles son tus habilidades y fortalezas? Eres bueno con los números, con la comunicación, resolviendo problemas, o en trabajos manuales?",
    "Prefieres trabajar solo o en equipo? Estás más interesado en trabajar en una oficina, o al aire libre?",
    "Cuál es tu nivel más alto de estudios? Tienes algún certificado, entrenamiento o bootcamp?",
  ];

  const requestMessages: ChatCompletionRequestMessage[] = [];
  for (let i = 0; i < questions.length; i++) {
    const question = questions[i];

    // Ask the user the current question
    requestMessages.push({
      role: "user",
      content: question,
    });

    // Wait for the user's answer
    const answer = await new Promise<string>((resolve) => {
      app.post("/api/answer", (req: Request, res: Response) => {
        const answer = req.body.answer;
        resolve(answer);
        res.end();
      });
    });

    // Add the user's answer to the request messages
    requestMessages.push({
      role: "user",
      content: answer,
    });
  }

  try {
    // Use the request messages to generate the prompt
    const prompt = requestMessages
      .map((msg) => msg.content)
      .join("\n");

    // Create the chat completion request
    const apiRequestBody: CreateChatCompletionRequest = {
      model: "text-davinci-002",
      messages: [{ role: "system", content: prompt }],
      temperature: 0.6,
    };
    const completion = await openai.createChatCompletion(apiRequestBody);

    res.json(completion.data);
  } catch (error) {
    console.error(error);
    res.status(500).send("Something went wrong");
  }
  // Use the request messages to generate the prompt
  const prompt = requestMessages
    .map((msg) => msg.content)
    .join("\n");

  // Create the chat completion request
  const apiRequestBody: CreateChatCompletionRequest = {
    model: "text-davinci-002",
    messages: [{ role: "system", content: prompt }],
    temperature: 0.6,
  };
  const completion = await openai.createChatCompletion(apiRequestBody);

  res.json(completion.data);

  const moderationResponse = await openai.createModeration({
    input: requestMessages[requestMessages.length - 1].content,
  });
  if (moderationResponse.data.results[0]?.flagged) {
    return res.status(400).send("Message is inappropriate");
  }

});

// Start the server
app.listen(port, () => {
  console.log(`Server started at http://localhost:${port}`);
});
