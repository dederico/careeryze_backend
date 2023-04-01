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
  input = input.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
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
  "What are your hobbies and interests?",
  "What are your skills and strengths? Are you good with numbers, communication, problem solving, or hands-on work?",
  "Do you prefer to work alone or in a team? Are you more interested in working in an office or outdoors?",
  "What is your highest level of education? Do you have any certificates, trainings, or bootcamps?",
];

// Define a function to get the next question based on the current index
function getNextQuestion(currentIndex: number): string {
  if (currentIndex < questions.length) {
    const question = questions[currentIndex].replace(/[\r\n]+/g, "");
    return question;
  }
  return "We're done with the questions. Is there anything else I can help you with?";
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
        model: "text-davinci-002",
        messages: [
          { role: "system", content: " Gracias por responser todas las preguntas"},
          ...requestMessages.map(({ role, content }) => ({ role, content: content.replace(/[\r\n]+/g, "") }))
        ],
        max_tokens: 150,
        temperature: 0.5,
        n: 1,
        stream: false,
        stop: ["\n"],
        presence_penalty: 0.6,
        frequency_penalty: 0.6,
      };
      const completion = await openai.createCompletion(apiRequestBody);

      currentQuestionIndex++;
      res.json({ message: completion.data.choices[0].text });
    }

    // Otherwise, if we have finished all the questions, just send a confirmation message
    const apiRequestBody: CreateChatCompletionRequest = {
      model: "text-davinci-002",
      messages: [

        {role: "system", content: "Gracias por responder todas las preguntas."},
        ...requestMessages.map(({ role, content }) => ({ role, content: content.replace(/[\r\n]+/g, "") }))
      ],
      max_tokens: 100,
      temperature: 0.5,
      n: 1,
      stream: false,
      stop: ["\n"],
      presence_penalty: 0.6,
      frequency_penalty: 0.6,
    };
    const completion = await openai.createCompletion(apiRequestBody);

    res.json({ message: completion.data.choices[0].text });

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
