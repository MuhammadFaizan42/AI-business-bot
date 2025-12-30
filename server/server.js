import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import pkg from "pg";
import OpenAI from "openai";

dotenv.config();
const app = express();

app.use(cors());
app.use(bodyParser.json());

const { Pool } = pkg;
const pool = new Pool({
  user: "postgres",
  host: "localhost",
  database: "Chatbotdb",
  password: "Saam7262",
  port: 5432,
});

/*const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
}); */

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});



// ================== UTILITIES ==================

function extractKeywords(question) {
  return question
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(" ")
    .filter(w => w.length > 2);
}


// ================== SCHEMA READER ==================

async function getDatabaseSchema() {
  const res = await pool.query(`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
    ORDER BY table_name
  `);

  const schema = {};
  res.rows.forEach(row => {
    if (!schema[row.table_name]) schema[row.table_name] = [];
    schema[row.table_name].push(row.column_name);
  });

  return schema;
}


// ================== DYNAMIC SEARCH ENGINE ==================

async function dynamicSearch(schema, keywords) {
  const results = {};

  for (const table in schema) {
    const columns = schema[table];

    const searchableCols = columns.filter(
      c => !["id", "created_at", "updated_at"].includes(c)
    );

    if (searchableCols.length === 0) continue;

    const conditions = searchableCols
      .map((c, i) => `LOWER(${c}) LIKE $${i + 1}`)
      .join(" OR ");

    const values = searchableCols.map(() => `%${keywords.join(" ")}%`);

    try {
      const res = await pool.query(
        `SELECT * FROM ${table} WHERE ${conditions} LIMIT 5`,
        values
      );

      if (res.rows.length > 0) {
        results[table] = res.rows;
      }
    } catch (err) {
      console.log(`Skipped table: ${table}`);
    }
  }

  return results;
}

// ================== Exact Intent ==================

async function extractIntent(question, schema) {
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `
You are given a database schema.
Identify which table and column the user is asking about.
Return JSON only:
{ "table": "...", "column": "..." }
Schema:
${JSON.stringify(schema, null, 2)}
`
      },
      { role: "user", content: question }
    ],
  });

  return JSON.parse(response.choices[0].message.content);
}



// ================== API ==================

app.post("/api/ask", async (req, res) => {
  try {
    const question = req.body.question;
    console.log("USER QUESTION:", question);

    const schema = await getDatabaseSchema();

    // 🧠 AI decides table + column
    const intent = await extractIntent(question, schema);
    console.log("AI INTENT:", intent);

    if (!intent.table || !intent.column) {
      return res.json({ answer: "No data found in database." });
    }

    // 🗄️ DB QUERY
    const dbRes = await pool.query(
      `SELECT ${intent.column} FROM ${intent.table} LIMIT 5`
    );

    if (dbRes.rows.length === 0) {
      return res.json({ answer: "No data found in database." });
    }

    // 🗣️ Natural response
    const completion = await openai.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [
    { role: "system", content: "Answer using database result only." },
    { role: "user", content: `Q: ${question}\nData:\n${JSON.stringify(dbRes.rows)}` }
  ],
});


    res.json({ answer: completion.choices[0].message.content });

  } catch (err) {
    console.error(err);
    res.json({ answer: "Server error" });
  }
});

// ================== START SERVER ==================

app.listen(8080, () => console.log("Server running on http://localhost:8080"));
