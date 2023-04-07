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

    const prompt =
      `Hello, Welcome to Careeryze chatbot (early stage for manufacturing only), your career advisor if you haven’t gone to college. I can provide you a couple recommended career paths with short answers to four questions: 1) What are your hobbies and interests? 2) What are your current skills and strengths? 3) Do you prefer working independently or in a team? 4) What is your highest level of education? Please enter in the format question number. your short answer.

Please enter your answers to the above questions in the following format:

Hobbies and interests: running
Skills and strengths: problem solver
Work preferences: in a team
Highest level of education: some high school
Act as career guidance expert specializing in non-college-educated job seekers and knowledgeable in manufacturing. Build three 20 years into the future recommended career paths based on my profile. Indicate the additional training, certifications, and experience in each respective field. Indicate the expected monthly income in USD dollars in the Mexican market for each role in each path. Include one option in the manufacturing industry. Add a column with the yearly % growth projections over the next 20 years of each job. Table format. At the end of each table, add the Total 20-year earnings range if I follow the path in USD. Only reliable sources are used. Here is my profile:

Hobbies and interests:
Skills and strengths:
Work preferences:
Highest level of education:
Please replace the blank spaces with your answers to the questions. When you're finished, please enter 7.`;

    tokenCount += getTokens(prompt);
    if (tokenCount > 4000) {
      return res.status(400).send("Message is too long");
    }

    const apiRequestBody: CreateChatCompletionRequest = {
      model: "gpt-3.5-turbo",
      messages: [{ role: "system", content: prompt }, ...requestMessages],
      temperature: 0.6,
    };
    const completion = await openai.createChatCompletion(apiRequestBody);

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
