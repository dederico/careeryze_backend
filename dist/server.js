var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import express from "express";
import cors from "cors";
import { Configuration, OpenAIApi, } from "openai";
import dotenv from "dotenv";
import bodyParser from "body-parser";
import GPT3TokenizerImport from "gpt3-tokenizer";
const GPT3Tokenizer = typeof GPT3TokenizerImport === "function"
    ? GPT3TokenizerImport
    : GPT3TokenizerImport.default;
const tokenizer = new GPT3Tokenizer({ type: "gpt3" });
function getTokens(input) {
    const tokens = tokenizer.encode(input);
    return tokens.text.length;
}
dotenv.config();
const port = process.env.PORT || 80;
const app = express();
app.use(bodyParser.json());
app.use(cors({
    origin: "*",
}));
const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);
// Initialize the conversation state
const initialState = {
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
function getPrompt(state) {
    const question = state.questions[state.currentQuestion];
    const answer = state.answers[state.currentQuestion] || "";
    return `${question}\n${answer}\n`;
}
// Define a function to advance to the next question in the conversation
function advanceConversation(state) {
    state.currentQuestion++;
}
// Define a function to check if the conversation is complete
function isConversationComplete(state) {
    return state.currentQuestion >= state.questions.length;
}
// Initialize the conversation state
let conversationState = initialState;
// Define the chat endpoint
app.post("/api/chat", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d;
    const requestMessages = req.body.messages;
    try {
        let tokenCount = 0;
        requestMessages.forEach((msg) => {
            const tokens = getTokens(msg.content);
            tokenCount += tokens;
        });
        const moderationResponse = yield openai.createModeration({
            input: requestMessages[requestMessages.length - 1].content,
        });
        if ((_a = moderationResponse.data.results[0]) === null || _a === void 0 ? void 0 : _a.flagged) {
            return res.status(400).send("Message is inappropriate");
        }
        const prompt = getPrompt(conversationState);
        tokenCount += getTokens(prompt);
        if (tokenCount > 4000) {
            return res.status(400).send("Message is too long");
        }
        const apiRequestBody = {
            model: "gpt-3.5-turbo",
            messages: [{ role: "system", content: prompt }, ...requestMessages],
            temperature: 0.6,
        };
        const completion = yield openai.createCompletion(apiRequestBody);
        const response = (_d = (_c = (_b = completion.data.choices[0]) === null || _b === void 0 ? void 0 : _b.text) === null || _c === void 0 ? void 0 : _c.trim()) !== null && _d !== void 0 ? _d : '';
        conversationState.answers[conversationState.currentQuestion] = response;
        advanceConversation(conversationState);
        if (isConversationComplete(conversationState)) {
            conversationState = initialState;
        }
        res.json(completion.data);
    }
    catch (error) {
        if (error instanceof Error) {
            console.error(error);
        }
        res.status(500).send("Something went wrong");
    }
}));
// Start the server
app.listen(port, () => {
    console.log(`Server started at http://localhost:${port}`);
});
//# sourceMappingURL=server.js.map