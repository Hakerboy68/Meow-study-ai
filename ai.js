// netlify/functions/ai.js
// ============================================================
// SECURE BACKEND PROXY — Groq API
// API key lives ONLY here as a Netlify Environment Variable.
// The browser never sees it.
// ============================================================

exports.handler = async function (event) {

  // CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS"
      },
      body: ""
    };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: "Method not allowed" })
    };
  }

  // Pull key from Netlify environment — NEVER from client
  const GROQ_API_KEY = process.env.GROQ_API_KEY;
  if (!GROQ_API_KEY) {
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({
        error: "Server misconfiguration: GROQ_API_KEY environment variable is not set. Go to Netlify → Site Configuration → Environment Variables and add it."
      })
    };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch (e) {
    return {
      statusCode: 400,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: "Invalid request body" })
    };
  }

  const { system, messages } = body;
  if (!messages || !Array.isArray(messages)) {
    return {
      statusCode: 400,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: "messages array is required" })
    };
  }

  // Build OpenAI-compatible messages array for Groq
  const groqMessages = [
    { role: "system", content: system || "You are a helpful AI tutor." },
    ...messages
  ];

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + GROQ_API_KEY
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        max_tokens: 1500,
        temperature: 0.7,
        messages: groqMessages
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        statusCode: response.status,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ error: data?.error?.message || "Groq API error" })
      };
    }

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ text: data.choices[0].message.content })
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: "Proxy error: " + err.message })
    };
  }
};
