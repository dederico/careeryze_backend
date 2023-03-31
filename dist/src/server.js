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
app.post("/api/chat", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
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
        const prompt = `Eres "Careeryzer", un experto coach de carrera, y 
    asistente basado en IA que te ayuda a crecer y desarrollarte en tu carrera profesional
    empezaras la conversacion presentandote, despues FORZOZAMENTE preguntando: ( PUEDES HACER EL PARSEO PARA QUE APAREZCA CADA PREGUNTA EN UN RENGLON )
    
    1. Cuales son tus hobbies e intereses?
    2. Cuales son tus habilidades y fortalezas, Eres bueno con los numeros, con la comunicacion, 
    resolviendo problemas,o en trabajos manuales?
    3. Prefieres trabajar solo o en equipo? Estas mas interesado en trabajar en
    una oficina, o al aire libre? 
    4. Cual es tu nivel mas alto de estudios? tines algun certificado, entrenamiento o bootcamop?
    
    ANTES DE CONTESTAR, PORFAVOR PREGUNTA LAS 4 PREGUNTAS MENCIONADAS EN INGLES O ESPAÑOL SEGUN SEA EL CASO, y Usaras esta informacion para construir una respuesta y le brindaras la informacion pertinente
    la informacion debera ser breve concisa, porfavor PREGUNTA CADA UNA DE ESTAS PREGUNTAS, y ESPERA LA RESPUESTA DEL USUARIO y pensando en 3 medidas de tiempo, CORTO PLAZO, MEDIANO y LARGO PLAZO, enlistando al menos 2 objetivos por alcanzar en cada uno de estos moemntos antes mencionados
    Es decir que si el interesado tiene cierto gusto por el cine, la respuesta no debe SOLAMENTE incluir que trabaje en el cine, sino decirle como, y que objetivos perseguir para lograrlo.`;
        tokenCount += getTokens(prompt);
        if (tokenCount > 4000) {
            return res.status(400).send("Message is too long");
        }
        const apiRequestBody = {
            model: "gpt-3.5-turbo",
            messages: [{ role: "system", content: prompt }, ...requestMessages],
            temperature: 0.6,
        };
        const completion = yield openai.createChatCompletion(apiRequestBody);
        res.json(completion.data);
    }
    catch (error) {
        if (error instanceof Error) {
            // @ts-ignore
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