# AI SQL Generator

An Electron application that allows you to interact with a PostgreSQL database using natural language queries. The app uses AI (OpenAI GPT) to translate natural language to SQL.

## Features

- Connect to a PostgreSQL database
- Automatically retrieves database schema (tables and columns)
- Generate SQL queries from natural language using AI
- Execute generated SQL queries against your database
- View query results in a tabular format

## Prerequisites

- Node.js (v14 or higher)
- A PostgreSQL database
- An OpenAI API key

## Installation

1. Clone this repository
2. Install dependencies:
   ```
   npm install
   ```
3. Create a `.env` file based on the `.env.example` file:
   ```
   cp .env.example .env
   ```
4. Edit the `.env` file with your PostgreSQL connection details and OpenAI API key

## Usage

1. Start the application:
   ```
   npm start
   ```
2. Ensure the database connection is successful (you should see "Database: Connected" in the top right)
3. Enter a natural language query in the text area (e.g., "Get the highest earning customer")
4. Click "Generate SQL" to have the AI create a SQL query based on your input
5. Review the generated SQL and click "Run Query" to execute it
6. View the results in the table below

## Development

- Run in development mode:
  ```
  NODE_ENV=development npm start
  ```
- Build the application:
  ```
  npm run make
  ```

## License

MIT 