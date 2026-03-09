// ai.js — Netlify Serverless Function (secure Groq proxy)
// Accessed at: /.netlify/functions/ai
// GROQ_API_KEY must be set in Netlify → Environment Variables

const https = require("https");

function httpsPost(url, headers, body) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname,
      method: "POST",
      headers: { ...headers, "Content-Length": Buffer.byteLength(body) }
    };
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => resolve({ status: res.statusCode, body: data }));
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};

exports.handler = async function (event) {

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: CORS, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  const GROQ_API_KEY = process.env.GROQ_API_KEY;
  if (!GROQ_API_KEY) {
    return {
      statusCode: 500, headers: CORS,
      body: JSON.stringify({ error: "GROQ_API_KEY not set. Go to Netlify → Site Settings → Environment Variables → Add GROQ_API_KEY" })
    };
  }

  let parsed;
  try {
    parsed = JSON.parse(event.body || "{}");
  } catch (e) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Invalid JSON body" }) };
  }

  const { system, messages } = parsed;
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "messages array required" }) };
  }

  const groqMessages = [
    { role: "system", content: system || "You are a helpful AI tutor for Indian students." },
    ...messages
  ];

  const reqBody = JSON.stringify({
    model: "llama-3.3-70b-versatile",
    max_tokens: 1500,
    temperature: 0.7,
    messages: groqMessages
  });

  try {
    const result = await httpsPost(
      "https://api.groq.com/openai/v1/chat/completions",
      { "Content-Type": "application/json", "Authorization": "Bearer " + GROQ_API_KEY },
      reqBody
    );

    let groqData;
    try {
      groqData = JSON.parse(result.body);
    } catch (e) {
      return { statusCode: 502, headers: CORS, body: JSON.stringify({ error: "Bad response from Groq: " + result.body.slice(0, 300) }) };
    }

    if (result.status !== 200) {
      return { statusCode: result.status, headers: CORS, body: JSON.stringify({ error: groqData?.error?.message || "Groq error " + result.status }) };
    }

    const text = groqData?.choices?.[0]?.message?.content;
    if (!text) {
      return { statusCode: 502, headers: CORS, body: JSON.stringify({ error: "Empty Groq response. Raw: " + result.body.slice(0, 300) }) };
    }

    return { statusCode: 200, headers: CORS, body: JSON.stringify({ text }) };

  } catch (err) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "Network error: " + err.message }) };
  }
};

