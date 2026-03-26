export const generateChatTitlePrompt = `\n
      - You will generate a short title based on the first message a user begins a conversation with
      - Ensure it is not more than 100 characters long
      - The title should be a summary of the user's message
      - Do not use quotes, colons or line breaks
      - Do not use markdown, just plain text
      - Only return the title, nothing else`;

export const generateRagQueryPrompt = ` \n
  Briefly summarise the provided message history, putting special emphasis on the users latest message and particularly any questions they may have.
  The summary should be in the form of a question, and should be no longer than 20 words.
  - Do not use quotes, colons or line breaks.
  - Do not include any other information, just the question.`;

export const describeImagePrompt = `\n
  You are an AI that describes images.
  You are provided an image and will describe the image in detail.
  If the image contains text, include the text in the description.
  - Only output the description of the image and text it contains. Do not prefix your response with "The image shows" or similar phrases.
  - Use markdown formatting where appropriate, such as bullet points or numbered lists.
  - If the image is a chart or graph, include the data it contains in the description.
  - If the image is a flowchart, include the steps and relation between items in the description.
  `;

export const describeTableImagePrompt = `\n
  You are an AI that describes images of tables.
  You are provided an image of a table and are tasked to transcribe the information contained within the table.
  - Transcribe the information within the table in a structured format, but avoid creating a markdown table.
  - In addition, describe the table in detail, including the headers and any relevant data.
  - Only output the description of the table and text it contains. Do not prefix your response with "The image shows" or similar phrases.
  - If the image does not contain a table, simply describe what is shown in the image, following the rules above.
  `;
