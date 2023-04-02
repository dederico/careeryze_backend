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
  const requestMessages: ChatCompletionRequestMessage[] = req.body.messages;

  try {
    let tokenCount = 0;
    let originalPrompt = `Eres "Careeryzer", 
    un experto coach de carrera, y asistente basado en IA que 
    te ayuda a crecer y desarrollarte en tu carrera profesional. `;

    // NamePrompt
    const namePrompt = `Por favor, presentate, y dime tu nombre.`;
    tokenCount += getTokens(namePrompt);
    originalPrompt += namePrompt;

    // Hobbies Prompt
    const hobbiesPrompt = `Cuáles son tus hobbies e intereses?`;
    tokenCount += getTokens(hobbiesPrompt);
    originalPrompt += " " + hobbiesPrompt;

    // Skills Prompt
    const skillPrompt = `Cuáles son tus habilidades y fortalezas?`;
    tokenCount += getTokens(skillPrompt);
    originalPrompt += " " + skillPrompt;

    // Work Experience
    const experiencePrompt = `Cuál es tu experiencia en la industria?`;
    tokenCount += getTokens(experiencePrompt);
    originalPrompt += " " + experiencePrompt;

    requestMessages.forEach((msg) => {
      const tokens = getTokens(msg.content);
      tokenCount += tokens;
      originalPrompt += ` ${msg.content}`;
    });

    const moderationResponse = await openai.createModeration({
      input: requestMessages[requestMessages.length - 1].content,
    });
    if (moderationResponse.data.results[0]?.flagged) {
      return res.status(400).send("Message is inappropriate");
    }

    const prompt = `Eres "Careeryzer", un experto coach de carrera`;

    tokenCount += getTokens(prompt + originalPrompt);
    if (tokenCount > 4000) {
      return res.status(400).send("Message is too long");
    }

    const apiRequestBody: CreateChatCompletionRequest = {
        model: "text-davinci-002",
        messages: [
          {
            role: "user",
            content: requestMessages[requestMessages.length - 1].content,
          },
          {
            role: "system",
            content: originalPrompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 60,
        n: 1,
        stop: "###",
      };
      const completion = await openai.createChatCompletion(apiRequestBody);
      
      const [response] = completion.data.choices;
      const outputMessage = response.message;
      res.json([{ role: "user", content: requestMessages[requestMessages.length - 1].content }, { role: "system", content: outputMessage }]);
      
      res.json(completion.data);
    } catch (error) {
      if (error instanceof Error) {
        // @ts-ignore
        console.error(error);
      }
      res.status(500).send("Something went wrong");
    }
  });
  
  // Start the server
  app.listen(port, () => {
    console.log(`Server started at http://localhost:${port}`);
  });
      